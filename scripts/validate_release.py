"""Read-only release data audit; writes only validation reports, never spatial data.

Run from any directory with the project's data dependencies installed:
  python scripts/validate_release.py --source-dir /path/to/original-analysis
Source input must contain the original data/processed GeoPackages and CSV.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import platform
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely

ROOT = Path(__file__).resolve().parents[1]
TOLERANCE = 1e-7


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'), parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'Nonfinite JSON: {value}')))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(source_dir, archive_dir):
    data_dir = ROOT / 'public/data'
    historical = read_json(data_dir / 'manifest.json')
    network = read_json(data_dir / 'transit/manifest.json')
    paths = sorted(data_dir.rglob('*.geojson'))
    before = {str(path.relative_to(data_dir)): sha256(path) for path in paths}
    report = {'checked_at_utc': datetime.now(timezone.utc).isoformat(), 'status': 'passed',
              'environment': {'python': platform.python_version(), 'geopandas': gpd.__version__, 'shapely': shapely.__version__},
              'coordinate_note': 'RFC7946 GeoJSON longitude/latitude; reader identifies EPSG:4326. Numeric bounds and source transformations corroborate CRS; coordinates alone cannot prove a datum.',
              'layers': {}, 'original_source_comparisons': {}, 'limitations': []}
    frames = {}
    for path in paths:
        key = str(path.relative_to(data_dir)).replace('\\', '/')
        obj = read_json(path)
        require(obj.get('type') == 'FeatureCollection' and bool(obj.get('features')), f'{key}: empty/non-collection')
        ids = [feature.get('id') for feature in obj['features']]
        require(all(isinstance(i, (str, int)) and not isinstance(i, bool) and str(i) for i in ids), f'{key}: missing ID')
        require(len(ids) == len(set(ids)), f'{key}: duplicate ID')
        frame = gpd.read_file(path)
        require(frame.crs and frame.crs.to_epsg() == 4326, f'{key}: not EPSG4326')
        require(frame.geometry.notna().all() and (~frame.geometry.is_empty).all() and frame.geometry.is_valid.all(), f'{key}: invalid/empty geometry')
        bounds = frame.total_bounds.tolist()
        require(all(math.isfinite(v) for v in bounds), f'{key}: nonfinite bounds')
        require(-81.1 < bounds[0] <= bounds[2] < -79.9 and 43.0 < bounds[1] <= bounds[3] < 44.0, f'{key}: outside Waterloo vicinity')
        nulls = {name: int(frame[name].isna().sum()) for name in frame.columns if name != 'geometry'}
        blank = {name: int(frame[name].map(lambda x: isinstance(x, str) and not x.strip()).sum()) for name in frame.columns if name != 'geometry'}
        expected = historical['layers'].get(path.name) if path.parent == data_dir else network['outputs'].get(path.name)
        require(expected is not None, f'{key}: output missing from manifest')
        require(len(frame) == expected['features'], f'{key}: count mismatch')
        expected_hash = expected.get('output_sha256', expected.get('sha256'))
        require(sha256(path) == expected_hash, f'{key}: manifest hash mismatch')
        report['layers'][key] = {'features': len(frame), 'geometry_types': frame.geom_type.value_counts().to_dict(), 'crs': frame.crs.to_string(), 'bounds': bounds,
                                'invalid_geometries': 0, 'duplicate_ids': 0, 'nulls_by_field': nulls, 'blank_strings_by_field': blank, 'sha256': sha256(path), 'bytes': path.stat().st_size, 'manifest_hash_matches': True}
        frames[key] = frame

    for filename, layer_name, output in [('waterloo_da_population.gpkg', 'waterloo_da_population', 'da-population.geojson'), ('waterloo_accessibility.gpkg', 'da_accessibility', 'da-accessibility.geojson'), ('waterloo_accessibility.gpkg', 'priority_underserved', 'priority-underserved.geojson')]:
        source_path = source_dir / 'data/processed' / filename
        require(source_path.exists(), f'Original source input unavailable: {filename}')
        expected_hash = historical['inputs_sha256'][f'data\\processed\\{filename}']
        require(sha256(source_path) == expected_hash, f'{filename}: original hash mismatch')
        source = gpd.read_file(source_path, layer=layer_name).set_index('DAUID').sort_index()
        exported = frames[output].set_index('DAUID').sort_index()
        require(source.index.equals(exported.index), f'{output}: source identifiers differ')
        compared = [field for field in source.columns if field != 'geometry']
        for field in compared:
            require(source[field].tolist() == exported[field].tolist(), f'{output}: original attribute mismatch in {field}')
        distance = source.to_crs(26917).geometry.hausdorff_distance(exported.to_crs(26917).geometry)
        require(float(distance.max()) < 0.1, f'{output}: source geometry changed >0.1m')
        report['original_source_comparisons'][output] = {'source_file': f'data/processed/{filename}', 'source_layer': layer_name, 'original_sha256_matches': True,
                                                       'attributes_equal': True, 'fields_compared': compared, 'maximum_geometry_hausdorff_difference_metres': float(distance.max())}

    da = frames['da-accessibility.geojson']
    require(not da.drop(columns='geometry').isna().any().any(), 'Historical DAs: missing attributes')
    population, access400, access800 = da.Population, da.pop_access_400, da.pop_access_800
    require((population >= 0).all() and (access400 >= -TOLERANCE).all() and (access800 >= access400-TOLERANCE).all() and (access800 <= population+TOLERANCE).all(), 'Coverage nesting/range failure')
    require(((population-access800-da.Pop_Beyond_800).abs() <= TOLERANCE).all(), 'Beyond800 arithmetic mismatch')
    for distance in [400, 800]:
        expected = da[f'pop_access_{distance}'] / population * 100
        positive = population > 0
        require(((expected[positive]-da.loc[positive, f'Pct_Access_{distance}']).abs() < TOLERANCE).all(), f'Percent{distance} arithmetic mismatch')
    expected_priority = set(da.loc[(da.Pct_Access_800 < 50) & (da.Pop_Beyond_800 >= 500), 'DAUID'])
    require(expected_priority == set(frames['priority-underserved.geojson'].DAUID), 'Priority classification mismatch')
    observations = {'study_population': float(population.sum()), 'dissemination_areas': len(da), 'population_within_400m': float(access400.sum()),
                    'population_within_800m': float(access800.sum()), 'population_beyond_800m': float(da.Pop_Beyond_800.sum()), 'priority_das': len(expected_priority)}
    references = dict(study_population=587165, dissemination_areas=766, population_within_400m=437870, population_within_800m=506721, population_beyond_800m=80444, priority_das=52)
    report['historical_references'] = {key: {'observed': value, 'reference_rounded': references[key], 'difference_from_rounded_reference': value-references[key], 'matches_reported_precision': round(value)==references[key]} for key,value in observations.items()}
    require(all(item['matches_reported_precision'] for item in report['historical_references'].values()), 'Historical reference discrepancy')
    report['historical_numeric_roundoff'] = {'minimum_beyond800': float(da.Pop_Beyond_800.min()), 'maximum_pct800': float(da.Pct_Access_800.max()), 'validation_tolerance': TOLERANCE}
    summary = pd.DataFrame(read_json(data_dir/'municipality-summary.json')).set_index('FullName')
    original_csv = pd.read_csv(source_dir/'data/processed/municipality_accessibility.csv').set_index('FullName')
    report['municipalities'] = []
    require(set(da.FullName) == set(summary.index) == set(original_csv.index), 'Municipality membership mismatch')
    for name, group in da.groupby('FullName'):
        sums = {'Population': float(group.Population.sum()), 'Pop_Access_400': float(group.pop_access_400.sum()), 'Pop_Access_800': float(group.pop_access_800.sum())}
        for key,value in sums.items():
            require(abs(value-summary.loc[name,key]) < TOLERANCE and abs(value-original_csv.loc[name,key]) < TOLERANCE, f'{name}: {key} differs from municipality summaries')
        report['municipalities'].append({'name': name, 'da_count': len(group), 'population': sums['Population'], 'within400': sums['Pop_Access_400'], 'within800': sums['Pop_Access_800'],
                                         'weighted_percent400': sums['Pop_Access_400']/sums['Population']*100, 'weighted_percent800': sums['Pop_Access_800']/sums['Population']*100,
                                         'beyond800': sums['Population']-sums['Pop_Access_800'], 'priority_das': int(group.DAUID.isin(expected_priority).sum()), 'original_and_exported_csv_totals_match': True})

    stops = frames['transit/stops.geojson']
    require(network['service_date']=='2026-11-24' and network['window_start']=='07:00' and network['window_end']=='19:00' and network['timezone']=='America/Toronto', 'Unexpected release service/window metadata')
    require((stops.service_date == network['service_date']).all(), 'Stop service date mismatch')
    require((stops.departures_per_hour-stops.scheduled_departures/12).abs().max() < TOLERANCE, 'Stop frequency calculation mismatch')
    def classify(rate):
        return 'No service' if rate == 0 else 'Low' if rate < 2 else 'Moderate' if rate <= 4 else 'High'
    require(stops.departures_per_hour.map(classify).equals(stops.frequency_class), 'Stop class mismatch')
    require(not stops[['stop_id','stop_name','municipality','scheduled_departures','departures_per_hour','frequency_class','service_date','provider','source_url']].isna().any().any(), 'Missing critical stop attributes')
    report['network'] = {'service_date': network['service_date'], 'window': [network['window_start'],network['window_end']], 'timezone': network['timezone'], 'class_counts': stops.frequency_class.value_counts().to_dict(), 'feeds': []}
    for feed in network['feeds']:
        archive = archive_dir/feed['archive']
        require(archive.exists() and sha256(archive)==feed['sha256'], f"{feed['feed_id']}: archive absent/hash mismatch")
        with zipfile.ZipFile(archive) as z:
            require(z.testzip() is None, 'GTFS ZIP corruption')
            trips=pd.read_csv(z.open('trips.txt'),dtype=str)
            cal=pd.read_csv(z.open('calendar_dates.txt'),dtype=str)
            events=pd.read_csv(z.open('stop_times.txt'),dtype=str,keep_default_na=False)
            # These exact archived inputs are exception-only and have no frequency templates.
            require('calendar.txt' not in z.namelist() and 'frequencies.txt' not in z.namelist(), 'Release snapshot verifier needs extension for changed GTFS table structure')
        date=network['service_date'].replace('-','')
        active=set(cal.loc[(cal.date==date)&(cal.exception_type=='1'),'service_id'])
        selected=events[events.trip_id.isin(trips.loc[trips.service_id.isin(active),'trip_id'])].copy()
        selected['seq']=selected.stop_sequence.astype(int)
        selected['seconds']=selected.departure_time.map(lambda value: sum(int(part)*mult for part,mult in zip(value.split(':'),[3600,60,1])))
        selected=selected[(selected.seq<selected.groupby('trip_id').seq.transform('max')) & selected.pickup_type.isin(['','0']) & selected.seconds.ge(25200) & selected.seconds.lt(68400)]
        counts=selected.groupby('stop_id').size().to_dict()
        exported=stops[stops.feed_id==feed['feed_id']]
        require(all(row.scheduled_departures==counts.get(row.stop_id,0) for _,row in exported.iterrows()), 'Independent GTFS stop counts differ')
        require(exported.scheduled_departures.sum()==len(selected), 'Independent GTFS total differs')
        report['network']['feeds'].append({'feed_id': feed['feed_id'], 'source_url':feed['download_url'], 'downloaded_at_utc':feed['downloaded_at_utc'], 'archive_sha256':feed['sha256'], 'archive_hash_matches':True, 'boarding_stops':len(exported), 'independent_boardable_departures':len(selected), 'every_stop_count_matches':True})
    cover400=frames['transit/coverage-400m.geojson'].geometry.union_all()
    cover800=frames['transit/coverage-800m.geojson'].geometry.union_all()
    high=frames['transit/high-frequency-400m.geojson'].geometry.union_all()
    require(stops.geometry.map(cover400.covers).all(), 'Stop outside400 buffer')
    # Independent reprojection can introduce sub-millimetre boundary slivers.
    projected = {key: frames[key].to_crs(26917).geometry.union_all() for key in ['transit/coverage-400m.geojson', 'transit/coverage-800m.geojson', 'transit/high-frequency-400m.geojson']}
    a, b, c = projected.values()
    outside = {'coverage400_outside800_m2': a.difference(b).area, 'high400_outside400_m2': c.difference(a).area}
    report['network']['nesting_roundoff'] = {**outside, 'distance_tolerance_m': 0.001, 'area_tolerance_m2': 0.001}
    require(b.buffer(0.001).covers(a) and a.buffer(0.001).covers(c) and max(outside.values()) < 0.001, 'Buffer nesting exceeds numerical tolerance')
    report['network']['buffer_nesting_and_stop_inclusion'] = True
    report['historical_analysis_date'] = {'value':'2026-09-09', 'evidence':'Original notebook 06_service_frequency and project data inventory; historical GTFS archive unavailable, so date is an analysis record, not proof of historical feed identity.'}
    report['limitations'] = ['Historical GTFS archive not recovered; high-frequency historical population coverage not verified.', 'Straight-line buffer / uniform population-density assumptions remain; validation does not prove walking accessibility.', 'Current GTFS is scheduled service, not live observations.', 'Optional GTFS blank parent_station and route labels for zero-service stops are expected; all null/blank counts are reported.', 'Original analysis repository has no software/data licence file in the inspected clone; redistribution requires separate rights review. This audit is not a legal determination.', 'Current municipal outlines are contextual, not verified as historical or definitive legal boundaries.']
    require(before == {str(path.relative_to(data_dir)):sha256(path) for path in paths}, 'A spatial input changed during validation')
    report['spatial_inputs_unchanged'] = True
    return report


def write_reports(report):
    out=ROOT/'docs'
    (out/'release-data-validation.json').write_text(json.dumps(report,ensure_ascii=False,allow_nan=False,indent=2)+'\n',encoding='utf-8')
    lines=['# Release spatial data validation', '', f"Checked: {report['checked_at_utc']}", '', '**Result: passed.** All spatial inputs remained unchanged.', '', report['coordinate_note'], '', '| Layer | Features | Geometry | CRS | SHA256 matches manifest |', '|---|---:|---|---|---|']
    for name,layer in report['layers'].items():
        lines.append(f"| {name} | {layer['features']} | {', '.join(layer['geometry_types'])} | {layer['crs']} | Yes |")
    lines += ['', 'Every layer has nonempty valid geometry, unique feature IDs and longitude/latitude bounds in the Waterloo vicinity. Full null/blank counts, file hashes, bounds and environment versions are in the JSON report.', '', '## Historical reconciliation', '', 'All preserved source attributes match the original GeoPackage by DAUID exactly. Reprojected geometry differences stay below0.1m (coordinate rounding, no simplification). Municipality population/coverage sums match both original and exported CSV totals within1e-7 residents. Rates are population-weighted, not averaged DA percentages.', '', '| Metric | Observed | Rounded reference | Match |', '|---|---:|---:|---|']
    for name,item in report['historical_references'].items():
        lines.append(f"| {name} | {item['observed']} | {item['reference_rounded']} | Yes |")
    lines += ['', 'Fractional differences from rounded reference values are expected rounding, not discrepancies. Tiny source floating-point noise (negative beyond800 around2e-12 and percentage800 just above100) is preserved; validation uses1e-7 tolerance. Priority52DA IDs exactly match the documented <50% access and ≥500 beyond800 rule.', '', '## Separate GTFS snapshot', '', 'Manifest and stop attributes agree on2026-11-24,07:00–19:00,America/Toronto. Archive hashes and ZIP integrity match. Independent stop-time grouping reproduces every exported stop departure count. All rates equal departures/12 and every frequency class matches its thresholds. Current400/800/high-frequency buffers are nested and include their relevant stops.', '']
    for feed in report['network']['feeds']:
        lines.append(f"- {feed['feed_id']}: {feed['boarding_stops']} boarding stops; {feed['independent_boardable_departures']} independently counted departures; all stop counts match.")
    lines += ['', '## Reproduce', '', 'Run `python scripts/validate_release.py --source-dir /path/to/original-analysis --archive-dir data/raw/gtfs-phase3` with requirements-data.txt dependencies. The default source directory is the local sibling work/source-repository checkout. Missing original files/archives fail explicitly; the validator never fabricates a successful comparison.', '', '## Limitations', '']+[f'- {text}' for text in report['limitations']]
    (out/'release-data-validation.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir',type=Path,default=ROOT.parents[1]/'work/source-repository')
    parser.add_argument('--archive-dir',type=Path,default=ROOT/'data/raw/gtfs-phase3')
    args=parser.parse_args()
    result=validate(args.source_dir,args.archive_dir)
    write_reports(result)
    print(f"PASS: {len(result['layers'])} GeoJSON layers; historical source reconciliation, municipal totals, priority criteria, GTFS counts/classes and buffer nesting. Inputs unchanged.")
