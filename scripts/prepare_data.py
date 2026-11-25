"""Validate historical outputs and export web GeoJSON without recomputing analysis.

Run from the project root:
  .venv/Scripts/python scripts/prepare_data.py --source-dir ../../work/source-repository
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import platform
import subprocess
import tempfile
import os
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio
import shapely
from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = 'https://github.com/JunhoLee-Geo/Waterloo-transit-accessibility'
LAYERS = [
    ('waterloo_da_population.gpkg', 'waterloo_da_population', 'da-population.geojson'),
    ('waterloo_accessibility.gpkg', 'da_accessibility', 'da-accessibility.geojson'),
    ('waterloo_accessibility.gpkg', 'priority_underserved', 'priority-underserved.geojson'),
]


def check(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')


def round_coordinates(value, decimals):
    if isinstance(value, (list, tuple)):
        return [round_coordinates(v, decimals) for v in value]
    return round(value, decimals)


def scalar(value):
    if pd.isna(value):
        return None
    if hasattr(value, 'item'):
        value = value.item()
    check(not isinstance(value, float) or math.isfinite(value), 'Non-finite attribute found')
    return value


def export_layer(frame, output, id_field, report):
    check(frame.crs is not None, f'{output.name}: missing CRS')
    check(id_field in frame and frame[id_field].notna().all(), f'{output.name}: missing ID')
    check(frame[id_field].map(lambda value: isinstance(value, str) and bool(value.strip())).all(), f'{output.name}: empty/non-string ID')
    check(len(frame) > 0, f'{output.name}: empty layer')
    check(not frame[id_field].duplicated().any(), f'{output.name}: duplicate IDs')
    check(not frame.geometry.isna().any() and not frame.geometry.is_empty.any(), f'{output.name}: missing/empty geometry')
    original = frame.copy()
    invalid = ~frame.geometry.is_valid
    repairs = []
    for index in frame.index[invalid]:
        before = frame.loc[index, 'geometry']
        after = shapely.make_valid(before)
        check(after.geom_type in ('Polygon', 'MultiPolygon') and not after.is_empty, 'Repair produced non-polygon geometry; review manually')
        repairs.append({'id': str(frame.loc[index, id_field]), 'reason': shapely.is_valid_reason(before), 'before_area': before.area, 'after_area': after.area, 'area_crs': frame.crs.to_string()})
        frame.loc[index, 'geometry'] = after
    check(frame.geometry.is_valid.all(), 'Invalid geometry after repair')
    check(frame.geometry.geom_type.isin(['Polygon', 'MultiPolygon']).all(), 'Unexpected geometry type')
    web = frame.to_crs('EPSG:4326')
    features = []
    # Try six decimal places (~0.11 m latitude); retain higher precision if rounding
    # introduces topology errors. This changes display coordinates, never statistics.
    used_precision = 6
    for precision in (6, 7, 8, 9, None):
        features = []
        valid = True
        for _, row in web.iterrows():
            geometry = mapping(row.geometry)
            if precision is not None:
                geometry['coordinates'] = round_coordinates(geometry['coordinates'], precision)
            polygon = shape(geometry)
            if not polygon.is_valid or polygon.is_empty:
                valid = False
                break
            props = {key: scalar(row[key]) for key in web.columns if key != web.geometry.name}
            features.append({'type': 'Feature', 'id': str(row[id_field]), 'properties': props, 'geometry': geometry})
        if valid:
            used_precision = precision
            break
    check(valid, 'Cannot export valid geometry without manual review')
    collection = {'type': 'FeatureCollection', 'features': features}
    write_json(output, collection)
    loaded = json.loads(output.read_text(encoding='utf-8'))
    check(len(loaded['features']) == len(frame), 'Export count differs')
    for (_, row), feature in zip(web.iterrows(), loaded['features']):
        check(feature['id'] == str(row[id_field]), 'Export ID differs')
        for column in web.columns:
            if column != web.geometry.name:
                check(feature['properties'][column] == scalar(row[column]), f'Attribute changed: {column}')
    reread = gpd.read_file(output)
    check(reread.geometry.is_valid.all() and not reread.geometry.is_empty.any(), 'Round-trip geometry failed')
    check(reread.crs.to_epsg() == 4326, 'Export CRS incorrect')
    projected = reread.to_crs('EPSG:26917')
    metric_original = frame.to_crs('EPSG:26917')
    distances = [a.hausdorff_distance(b) for a, b in zip(metric_original.geometry, projected.geometry)]
    check(max(distances) <= 0.2, 'Coordinate optimization exceeds 0.2 metre displacement limit')
    bounds = [float(v) for v in reread.total_bounds]
    check(-81 < bounds[0] < bounds[2] < -80 and 43 < bounds[1] < bounds[3] < 44, 'Unexpected geographic extent')
    report.update({
        'features': len(frame), 'source_crs': original.crs.to_string(), 'output_crs': 'EPSG:4326',
        'source_geometry_types': original.geometry.geom_type.value_counts().to_dict(),
        'source_invalid_geometries': int(invalid.sum()), 'missing_geometries': int(original.geometry.isna().sum()),
        'empty_geometries': int(original.geometry.is_empty.sum()), 'repairs': repairs,
        'output_invalid_geometries': int((~reread.geometry.is_valid).sum()),
        'duplicate_ids': int(frame[id_field].duplicated().sum()),
        'nulls_by_field': {col: int(original[col].isna().sum()) for col in original.columns if col != original.geometry.name},
        'source_dtypes': {col: str(original[col].dtype) for col in original.columns if col != original.geometry.name},
        'attribute_roundtrip_exact': True, 'fields_renamed': {},
        'coordinate_decimal_places': used_precision, 'geometry_simplification': 'None',
        'maximum_hausdorff_change_metres': max(distances), 'distance_check_crs': 'EPSG:26917',
        'bounds': bounds, 'output_bytes': output.stat().st_size, 'output_sha256': digest(output),
    })
    return frame


def validate_analytical(frame):
    fields = ['Population', 'pop_access_400', 'pop_access_800', 'Pop_Beyond_800',
              'Pct_Access_400', 'Pct_Access_800', 'da_area', 'access_400_area',
              'access_800_area', 'access_400_ratio', 'access_800_ratio', 'Pct_Beyond_800']
    for field in fields:
        check(field in frame and pd.api.types.is_numeric_dtype(frame[field]) and
              frame[field].notna().all() and frame[field].map(math.isfinite).all(),
              f'Missing/non-finite/non-numeric {field}')
    check('FullName' in frame and frame.FullName.map(lambda x: isinstance(x, str) and bool(x.strip())).all(), 'Missing municipality')
    tolerance = 1e-7
    check((frame.Population >= 0).all(), 'Negative population')
    for radius in (400, 800):
        check(frame[f'Pct_Access_{radius}'].between(-1e-9, 100 + 1e-9).all(), 'Coverage outside tolerance')
        value = frame[f'pop_access_{radius}']
        check(((value >= -tolerance) & (value <= frame.Population + tolerance)).all(), 'Covered population outside total')
    check((frame.pop_access_400 <= frame.pop_access_800 + tolerance).all(), '400m population exceeds 800m')
    check(((frame.Population - frame.pop_access_800 - frame.Pop_Beyond_800).abs() <= tolerance).all(), 'Beyond-800m population inconsistent')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True, help='Read-only source repository checkout')
    parser.add_argument('--municipalities', type=Path, help='Optional authoritative municipal GeoJSON (not a DA dissolve)')
    parser.add_argument('--municipalities-source', type=Path, help='Retrieval metadata including source URL, date and SHA256')
    args = parser.parse_args()
    source = args.source_dir.resolve()
    check(not ROOT.is_relative_to(source), 'Outputs must not be inside the source repository')
    with tempfile.TemporaryDirectory(prefix='transitscope-prepare-') as temporary:
        run_preparation(args, source, Path(temporary))


def run_preparation(args, source, stage):
    out = stage / 'data'
    out.mkdir()
    municipal_metadata = None
    source_commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    reports, frames, input_hashes = {}, {}, {}
    for filename, layer, output in LAYERS:
        path = source / 'data/processed' / filename
        input_hashes[str(path.relative_to(source))] = digest(path)
        frame = gpd.read_file(path, layer=layer, fid_as_index=True)
        # GeoPackage primary keys are retained explicitly; DAUID remains the stable web ID.
        frame.insert(0, 'fid', frame.index.astype('int64'))
        frame = frame.reset_index(drop=True)
        for field in ('DAUID', 'DGUID', 'PRUID'):
            check(frame[field].notna().all() and frame[field].map(lambda x: isinstance(x, str) and bool(x.strip())).all(), f'{layer}: {field} must be non-null strings')
        check(frame['Population'].notna().all() and pd.api.types.is_numeric_dtype(frame['Population']) and frame.Population.map(math.isfinite).all(), 'Population must be finite, numeric and complete')
        if layer != 'waterloo_da_population':
            validate_analytical(frame)
        reports[output] = {'source_file': str(path.relative_to(source)), 'source_layer': layer, 'source_bytes': path.stat().st_size}
        frames[layer] = export_layer(frame, out / output, 'DAUID', reports[output])
    baseline = frames['waterloo_da_population'].set_index('DAUID')
    accessibility = frames['da_accessibility'].set_index('DAUID')
    priority = frames['priority_underserved'].set_index('DAUID')
    check(set(baseline.index) == set(accessibility.index), 'DA population/accessibility ID mismatch')
    check(baseline.Population.sort_index().equals(accessibility.Population.sort_index()), 'Population differs between layers')
    for field in ['Population', 'pop_access_400', 'pop_access_800', 'Pop_Beyond_800', 'Pct_Access_400', 'Pct_Access_800']:
        check(pd.api.types.is_numeric_dtype(accessibility[field]) and accessibility[field].notna().all(), f'Missing/non-numeric {field}')
    check((accessibility.Population >= 0).all(), 'Negative population')
    for radius in (400, 800):
        check(accessibility[f'Pct_Access_{radius}'].between(-1e-9, 100 + 1e-9).all(), 'Coverage outside tolerance')
    selected = accessibility[(accessibility.Pct_Access_800 < 50) & (accessibility.Pop_Beyond_800 >= 500)]
    check(set(selected.index) == set(priority.index), 'Priority subset differs from documented criterion')
    # Compare the entire priority attribute subset, ignoring layer-local primary keys.
    for column in accessibility.columns:
        if column not in ('geometry', 'fid'):
            check(accessibility.loc[priority.index, column].equals(priority[column]), f'Priority attributes differ: {column}')
    comparisons = []
    observed = {'study_population': float(accessibility.Population.sum()), 'dissemination_areas': len(accessibility),
                'population_within_400m': float(accessibility.pop_access_400.sum()), 'population_within_800m': float(accessibility.pop_access_800.sum()),
                'population_beyond_800m': float(accessibility.Pop_Beyond_800.sum()), 'priority_das': len(priority)}
    targets = dict(zip(observed, [587165, 766, 437870, 506721, 80444, 52]))
    for key, value in observed.items():
        target = targets[key]
        comparisons.append({'metric': key, 'observed': value, 'historical_rounded_target': target, 'difference': value - target, 'matches_at_reported_precision': round(value) == target})
    comparisons.append({'metric': 'population_within_400m_high_frequency', 'observed': None, 'historical_rounded_target': 164777, 'status': 'Not verifiable: no frequency analytical dataset committed; notebook saved output only'})
    csv_path = source / 'data/processed/municipality_accessibility.csv'
    input_hashes[str(csv_path.relative_to(source))] = digest(csv_path)
    table = pd.read_csv(csv_path)
    check(table.FullName.notna().all() and not table.FullName.duplicated().any(), 'Municipality CSV IDs invalid')
    write_json(out / 'municipality-summary.json', [{key: scalar(value) for key, value in row.items()} for row in table.to_dict('records')])
    csv_checks = []
    for _, row in table.iterrows():
        selected = accessibility[accessibility.FullName == row.FullName]
        for csv_col, da_col in [('Population', 'Population'), ('Pop_Access_400', 'pop_access_400'), ('Pop_Access_800', 'pop_access_800')]:
            delta = float(selected[da_col].sum() - row[csv_col])
            csv_checks.append({'municipality': row.FullName, 'field': csv_col, 'csv': row[csv_col], 'da_sum_minus_csv': delta})
    if args.municipalities:
        municipal_path = args.municipalities.resolve()
        check(municipal_path != ROOT / 'public/data/municipalities.geojson', 'Use raw municipal snapshot, not generated output')
        check(args.municipalities_source is not None, 'Municipalities require retrieval metadata')
        municipal_metadata = json.loads(args.municipalities_source.read_text(encoding='utf-8-sig'))
        check(municipal_metadata.get('sha256') == digest(municipal_path), 'Municipal snapshot checksum mismatch')
        check(all(municipal_metadata.get(key) for key in ['source_url', 'retrieved_date', 'snapshot_caveat']), 'Missing municipal provenance')
        municipal = gpd.read_file(municipal_path)
        check('FullName' in municipal and set(municipal.FullName) == set(table.FullName), 'Municipality labels differ from seven source municipalities')
        input_hashes['municipalities_external'] = digest(municipal_path)
        reports['municipalities.geojson'] = {'source_file': municipal_path.name, 'source_bytes': municipal_path.stat().st_size, 'note': 'Contemporary official contextual boundaries; historical DA assignment retained unchanged'}
        export_layer(municipal, out / 'municipalities.geojson', 'FullName', reports['municipalities.geojson'])
        check(digest(municipal_path) == input_hashes['municipalities_external'], 'Municipal source bytes changed')
    check(all(digest(source / name) == value for name, value in input_hashes.items() if name != 'municipalities_external'), 'Source bytes changed during preparation')
    report = {'source_url': SOURCE_URL, 'source_commit': source_commit, 'inputs_sha256': input_hashes,
              'environment': {'python': platform.python_version(), 'geopandas': gpd.__version__, 'pandas': pd.__version__, 'shapely': shapely.__version__, 'pyogrio': pyogrio.__version__},
              'municipal_source': municipal_metadata, 'layers': reports, 'historical_comparisons': comparisons, 'municipality_csv_comparisons': csv_checks,
              'source_numeric_roundoff_preserved': {'minimum_Pop_Beyond_800': float(accessibility.Pop_Beyond_800.min()), 'maximum_Pct_Access_800': float(accessibility.Pct_Access_800.max())},
              'limitations': ['Source analytical attributes preserved, not recomputed.', 'Uniform DA population distribution and straight-line buffer assumptions remain.', 'No GTFS-based layers generated.', 'Original source licence absent; review redistribution terms before publication.']}
    write_json(out / 'manifest.json', report)
    write_json(stage / 'data-validation.json', report)
    lines = ['# Phase 2 data validation report', '', 'Generated by `scripts/prepare_data.py`; source files were read only and SHA-256 checked before/after.', '', f'Source commit: `{source_commit}`.', '', '## Spatial validation', '', '| Export | Features | Source CRS | Invalid before / after | Bytes | Coordinate precision | Maximum display displacement (m) |', '|---|---:|---|---|---:|---|---:|']
    for name, info in reports.items():
        lines.append(f"| {name} | {info['features']} | {info['source_crs']} | {info['source_invalid_geometries']} / {info['output_invalid_geometries']} | {info['output_bytes']:,} | {info['coordinate_decimal_places']} | {info['maximum_hausdorff_change_metres']:.6f} |")
    lines += ['', f"Geometry repairs applied: {sum(len(info['repairs']) for info in reports.values())}; individual IDs and reasons are recorded in JSON.", '', 'All outputs use EPSG:4326 longitude/latitude. No missing/empty geometry or duplicate DAUIDs were found. Full field-level types/null counts, bounds, repairs and hashes are in [data-validation.json](data-validation.json). All original attributes, including GeoPackage fid, survive JSON round-trip exactly. No fields were renamed; GeoJSON feature IDs use DAUID for DA layers and FullName for municipalities. No simplification was applied. Compact JSON and coordinate precision reduction reduce transfer size without changing analytical numbers.', '', '## Historical comparisons', '', '| Metric | Actual available data | Historical rounded target | Difference |', '|---|---:|---:|---:|']
    for item in comparisons:
        lines.append(f"| {item['metric']} | {item.get('observed')} | {item['historical_rounded_target']} | {item.get('difference', 'Not independently verifiable')} |")
    lines += ['', 'Targets are comparisons only, never used to adjust attributes. Historical agreement is evaluated per metric in the JSON report; differences are shown above. The high-frequency population target cannot be verified from a committed spatial dataset.', '', '## Municipality table', '', 'The summary JSON preserves the CSV values. CSV population estimates are rounded; the JSON report records each difference from the unrounded DA sum. Stop counts are retained as historical table values, not independently validated against absent stop points.', '', '## Numerical and methodological limits', '', f"Original floating-point extrema retained: {report['source_numeric_roundoff_preserved']}. Tiny negative values/percentages above 100 are numerical noise; UI presentation may clamp only within documented tolerance. No source numbers were edited.", '', 'Population layer IDs and populations match the accessibility layer. Priority membership exactly matches coverage <50% and estimated beyond-800 m population ≥500; its attributes match the parent layer. The script fails for missing CRS/IDs, duplicate IDs, missing/empty geometry, unrepaired geometry, invalid exports, altered attributes or unexpected extent. Geometry fixes use make_valid only when necessary and record each affected ID and area.', '', 'GeoPackage geometry is transformed for display, not reanalysed. Six-decimal rounding is attempted, with increased precision when required to preserve valid polygons. The maximum Hausdorff change is measured with both geometries in EPSG:26917, in metres; exports exceeding 0.2 metres fail. Municipal boundaries, when included, are contemporary context and do not replace historical municipality assignments.', '', '## Reproduce', '', '```powershell', 'uv venv --python 3.12 .venv', 'uv pip install --python .venv/Scripts/python.exe -r requirements-data.txt', '.venv/Scripts/python.exe scripts/prepare_data.py --source-dir ../../work/source-repository --municipalities data/reference/municipalities.geojson --municipalities-source data/reference/municipalities-source.json', '```', '', 'Omit both municipality arguments for a DA-only run. Municipal provenance is required when including that layer. The source checkout must be obtained separately; raw data is not overwritten. Source checksums and software versions are recorded in the manifest.']
    (stage / 'data-validation.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    # Publish only after all inputs, exports and cross-layer checks passed. Each file
    # replacement is atomic; validation failures never overwrite accepted outputs.
    for path in out.iterdir():
        destination = ROOT / 'public/data' / path.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        pending = destination.with_suffix(destination.suffix + '.pending')
        pending.write_bytes(path.read_bytes())
        os.replace(pending, destination)
    if not args.municipalities:
        stale = ROOT / 'public/data/municipalities.geojson'
        if stale.exists():
            stale.unlink()
    for name in ['data-validation.json', 'data-validation.md']:
        destination = ROOT / 'docs' / name
        pending = destination.with_suffix(destination.suffix + '.pending')
        pending.write_bytes((stage / name).read_bytes())
        os.replace(pending, destination)
    print(json.dumps({'exports': {k: v['features'] for k, v in reports.items()}, 'comparisons': comparisons}, indent=2))


if __name__ == '__main__':
    main()
