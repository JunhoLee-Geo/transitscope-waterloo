"""Prepare a separately dated official GTFS network; never recompute historical DA values."""
import argparse
from collections import Counter, defaultdict
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import tempfile
import zipfile

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, LineString, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
TABLES = ['stops', 'routes', 'trips', 'stop_times', 'calendar', 'calendar_dates', 'shapes', 'feed_info', 'frequencies']


def require(test, message):
    if not test:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def seconds(value):
    parts = str(value).split(':')
    require(len(parts) == 3 and all(p.isdigit() for p in parts), f'Invalid GTFS time: {value}')
    h, m, s = map(int, parts)
    require(m < 60 and s < 60, f'Invalid GTFS time: {value}')
    return h * 3600 + m * 60 + s


def active_services(calendar, exceptions, day):
    day = date.fromisoformat(day)
    stamp = day.strftime('%Y%m%d')
    result = set()
    if not calendar.empty:
        require(not calendar.service_id.duplicated().any(), 'Duplicate calendar service ID')
        weekday = day.strftime('%A').lower()
        require(calendar[weekday].isin(['0', '1']).all(), 'Invalid weekly calendar flag')
        result = set(calendar.loc[(calendar.start_date <= stamp) & (calendar.end_date >= stamp) & (calendar[weekday] == '1'), 'service_id'])
    if not exceptions.empty:
        require(not exceptions.duplicated(['service_id', 'date']).any(), 'Duplicate calendar exception')
        require(exceptions.exception_type.isin(['1', '2']).all(), 'Invalid calendar exception type')
        daily = exceptions[exceptions.date == stamp]
        result.update(daily.loc[daily.exception_type == '1', 'service_id'])
        result.difference_update(daily.loc[daily.exception_type == '2', 'service_id'])
    return result


def frequency_class(count, hours=12):
    require(hours > 0 and count >= 0, 'Invalid frequency input')
    rate = count / hours
    return 'No service' if count == 0 else 'High' if rate > 4 else 'Moderate' if rate >= 2 else 'Low'


def canonical_stop_times(frame):
    frame = frame.drop_duplicates().copy()
    require(not frame.duplicated(['trip_id', 'stop_sequence']).any(), 'Conflicting trip/stop_sequence records')
    frame['_sequence'] = pd.to_numeric(frame.stop_sequence, errors='raise')
    require((frame._sequence >= 0).all() and (frame._sequence % 1 == 0).all(), 'Invalid stop sequence')
    require(not frame.duplicated(['trip_id', '_sequence']).any(), 'Equivalent duplicate stop sequence')
    return frame.sort_values(['trip_id', '_sequence'])


def trip_events(rows, frequencies, start, end):
    """Count boardable, nonterminal departures; exact frequency templates expand once."""
    rows = rows.sort_values('_sequence')
    times = [seconds(v) for v in rows.departure_time]
    require(all(a <= b for a, b in zip(times, times[1:])), 'Trip departures are not monotonic')
    offsets = [0]
    if not frequencies.empty:
        offsets = []
        intervals = []
        for record in frequencies.to_dict('records'):
            require(record.get('exact_times', '0') == '1', 'Non-exact frequency service requires expected-service analysis; no synthetic scheduled departures exported')
            a, b = seconds(record['start_time']), seconds(record['end_time'])
            headway = int(record['headway_secs'])
            require(headway > 0 and a < b, 'Invalid frequency interval')
            require(not any(a < d and b > c for c, d in intervals), 'Overlapping frequency intervals')
            intervals.append((a, b))
            offsets.extend(t - times[0] for t in range(a, b, headway))
    result = Counter()
    # Last stop has no onward segment: do not imply a boardable departure there.
    for position, row in enumerate(rows.to_dict('records')[:-1]):
        pickup = row.get('pickup_type', '') or '0'
        require(pickup in ('0', '1', '2', '3'), 'Invalid pickup_type')
        if pickup != '0':
            continue  # no pickup or demand-responsive arrangements excluded, reported
        for offset in offsets:
            if start <= times[position] + offset < end:
                result[row['stop_id']] += 1
    return result


def compact(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')


def geojson(path, features):
    ids = [f['id'] for f in features]
    require(len(ids) == len(set(ids)), f'Duplicate exported ID: {path.name}')
    for f in features:
        geom = shape(f['geometry'])
        require(geom.is_valid and not geom.is_empty, f'Invalid export geometry: {f["id"]}')
        x1, y1, x2, y2 = geom.bounds
        require(-81.2 < x1 <= x2 < -79.8 and 43 < y1 <= y2 < 44.2, 'Unexpected network extent')
    compact(path, {'type': 'FeatureCollection', 'features': features})
    reread = json.loads(path.read_text(encoding='utf-8'))
    require(len(reread['features']) == len(features), 'Serialized feature count changed')
    for original, loaded in zip(features, reread['features']):
        require(original['id'] == loaded['id'] and original['properties'] == loaded['properties'], 'Serialized feature attributes changed')
        require(shape(original['geometry']).equals_exact(shape(loaded['geometry']), 0), 'Serialized coordinates changed')
    return {'features': len(features), 'bytes': path.stat().st_size, 'sha256': sha(path), 'invalid_geometries': 0, 'crs': 'EPSG:4326'}


def feature(identifier, geometry, properties):
    return {'type': 'Feature', 'id': identifier, 'geometry': mapping(geometry), 'properties': properties}


def read_feed(path):
    with zipfile.ZipFile(path) as archive:
        require(archive.testzip() is None, 'Corrupt ZIP')
        names = {Path(n).name: n for n in archive.namelist() if not n.endswith('/')}
        require(len(names) == len([n for n in archive.namelist() if not n.endswith('/')]), 'Duplicate archive basenames')
        result = {name: pd.read_csv(archive.open(names[name + '.txt']), dtype=str, keep_default_na=False) if name + '.txt' in names else pd.DataFrame() for name in TABLES}
        result['agency'] = pd.read_csv(archive.open(names['agency.txt']), dtype=str, keep_default_na=False)
    for name in ('stops', 'routes', 'trips', 'stop_times'):
        require(not result[name].empty, f'Missing required table {name}')
    require(not result['calendar'].empty or not result['calendar_dates'].empty, 'No service calendar')
    for table, key in [('stops', 'stop_id'), ('routes', 'route_id'), ('trips', 'trip_id')]:
        require(result[table][key].ne('').all() and not result[table][key].duplicated().any(), f'Invalid {key}')
    require(set(result['trips'].route_id) <= set(result['routes'].route_id), 'Unknown route reference')
    require(set(result['stop_times'].trip_id) <= set(result['trips'].trip_id), 'Unknown trip reference')
    require(set(result['stop_times'].stop_id) <= set(result['stops'].stop_id), 'Unknown stop reference')
    if not result['frequencies'].empty:
        require(set(result['frequencies'].trip_id) <= set(result['trips'].trip_id), 'Unknown frequency trip')
    services = set(result['calendar'].get('service_id', [])) | set(result['calendar_dates'].get('service_id', []))
    require(set(result['trips'].service_id) <= services, 'Unknown service reference')
    return result


def process_feed(meta, directory, day, start, end, municipalities):
    path = directory / meta['archive']
    require(sha(path) == meta['sha256'], f'Archive hash mismatch: {path.name}')
    tables = read_feed(path)
    require(set(tables['agency'].agency_timezone) == {'America/Toronto'}, 'Review unsupported agency timezone')
    active = active_services(tables['calendar'], tables['calendar_dates'], day)
    trips = tables['trips'][tables['trips'].service_id.isin(active)]
    require(not trips.empty, f'No active trips for {meta["feed_id"]} on {day}')
    raw = tables['stop_times'][tables['stop_times'].trip_id.isin(trips.trip_id)]
    times = canonical_stop_times(raw)
    require(set(trips.trip_id) <= set(times.trip_id), 'Active trip has no stop times')
    grouped = {k: v for k, v in times.groupby('trip_id')}
    freq = {k: v for k, v in tables['frequencies'].groupby('trip_id')} if not tables['frequencies'].empty else {}
    counts, serving = Counter(), defaultdict(set)
    route_lookup = tables['routes'].set_index('route_id').to_dict('index')
    for trip in trips.to_dict('records'):
        rows = grouped[trip['trip_id']]
        events = trip_events(rows, freq.get(trip['trip_id'], pd.DataFrame()), start, end)
        counts.update(events)
        for stop_id in events:
            serving[stop_id].add(trip['route_id'])
    stops = tables['stops'].copy()
    stops['location_type'] = stops.get('location_type', pd.Series('', index=stops.index)).replace('', '0')
    require(stops.location_type.isin(['0', '1', '2', '3', '4']).all(), 'Unknown location type')
    parent = stops.get('parent_station', pd.Series('', index=stops.index))
    require(set(parent[parent != '']) <= set(stops.stop_id), 'Unknown parent station')
    boarding = stops[stops.location_type == '0'].copy()
    require(set(counts) <= set(boarding.stop_id), 'Service events reference nonboarding locations')
    stop_features = []
    points = gpd.GeoSeries(gpd.points_from_xy(pd.to_numeric(boarding.stop_lon), pd.to_numeric(boarding.stop_lat)), crs=4326)
    require(points.is_valid.all(), 'Invalid stop coordinates')
    for row, point in zip(boarding.to_dict('records'), points):
        matches = municipalities[municipalities.geometry.covers(point)].FullName.tolist()
        routes = sorted(serving[row['stop_id']])
        count = counts[row['stop_id']]
        props = {'stop_id': row['stop_id'], 'stop_name': row['stop_name'], 'feed_id': meta['feed_id'],
                 'parent_station': row.get('parent_station', ''), 'municipality': matches[0] if len(matches) == 1 else None,
                 'scheduled_departures': count, 'departures_per_hour': count / ((end-start)/3600), 'frequency_class': frequency_class(count, (end-start)/3600),
                 'route_ids': ', '.join(routes), 'route_labels': ', '.join(route_lookup[r].get('route_short_name', r) or r for r in routes),
                 'service_date': day, 'window_start': '07:00', 'window_end': '19:00', 'provider': meta['provider'], 'source_url': meta['download_url']}
        stop_features.append(feature(meta['feed_id'] + ':' + row['stop_id'], point, props))
    # Shapes are source line geometry, not straight connectors guessed from stop order.
    shapes, route_features, missing_shapes = {}, [], []
    if not tables['shapes'].empty:
        shapes_frame = tables['shapes'].drop_duplicates().copy()
        shapes_frame['_sequence'] = pd.to_numeric(shapes_frame.shape_pt_sequence, errors='raise')
        require(not shapes_frame.duplicated(['shape_id', '_sequence']).any(), 'Conflicting shape point sequence')
        for sid, group in shapes_frame.groupby('shape_id'):
            group = group.sort_values('_sequence')
            coords = list(zip(pd.to_numeric(group.shape_pt_lon), pd.to_numeric(group.shape_pt_lat)))
            if len(set(coords)) >= 2:
                shapes[sid] = LineString(coords)
    for rid, group in trips.groupby('route_id'):
        for sid in sorted(set(group.get('shape_id', []))):
            if sid not in shapes:
                missing_shapes.append({'route_id': rid, 'shape_id': sid})
                continue
            record = route_lookup[rid]
            props = {k: record.get(k, '') for k in ['route_short_name', 'route_long_name', 'route_type']}
            props.update({'route_id': rid, 'shape_id': sid, 'feed_id': meta['feed_id'], 'service_date': day, 'provider': meta['provider'], 'source_url': meta['download_url']})
            route_features.append(feature(f'{meta["feed_id"]}:{rid}:{sid}', shapes[sid], props))
    after24 = int(times.departure_time.map(seconds).ge(86400).sum())
    report = {'tables': {k: {'present': not v.empty, 'rows': len(v)} for k, v in tables.items()}, 'active_service_ids': len(active), 'active_trips': len(trips),
              'active_stop_time_rows': len(raw), 'identical_duplicate_rows_removed': len(raw)-len(times), 'times_at_or_beyond_24h': after24,
              'boarding_locations': len(stop_features), 'excluded_nonboarding_locations': len(stops)-len(boarding),
              'scheduled_boardable_departures': sum(counts.values()), 'classification_counts': dict(Counter(f['properties']['frequency_class'] for f in stop_features)),
              'municipality_unassigned': sum(f['properties']['municipality'] is None for f in stop_features),
              'selected_routes': len(set(trips.route_id)), 'route_shape_features': len(route_features), 'missing_shapes': missing_shapes,
              'nonstandard_pickup_rows': int((times.get('pickup_type', pd.Series('0', index=times.index)).replace('', '0') != '0').sum()),
              'terminal_rows_excluded': len(trips), 'archive_unchanged': sha(path) == meta['sha256']}
    return stop_features, route_features, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, default=ROOT/'data/raw/gtfs-phase3/sources.json')
    parser.add_argument('--service-date', default='2026-11-24')
    args = parser.parse_args()
    provenance = json.loads(args.sources.read_text(encoding='utf-8-sig'))
    municipalities = gpd.read_file(ROOT/'public/data/municipalities.geojson').to_crs(4326)
    all_stops, all_routes, reports = [], [], {}
    route_keys = set()
    for meta in provenance['feeds']:
        stops, routes, report = process_feed(meta, args.sources.parent, args.service_date, seconds('07:00:00'), seconds('19:00:00'), municipalities)
        # GRT feeds belong to one agency: reject route overlap rather than double-count.
        keys = {(f['properties']['route_id'], f['properties']['route_type']) for f in routes}
        require(not route_keys.intersection(keys), 'Overlapping route identities across feeds require manual reconciliation')
        route_keys.update(keys)
        all_stops.extend(stops); all_routes.extend(routes); reports[meta['feed_id']] = report
    require(len({f['id'] for f in all_stops}) == len(all_stops), 'Duplicate feed namespace')
    limitations = [
        'Newly downloaded official snapshot; not the original historical accessibility input.',
        'Counts are boardable nonterminal scheduled departures, not realtime arrivals or destination-specific headways.',
        'pickup_type 1/2/3 excluded; terminal rows excluded. This differs from the original all-stop-event method.',
        '07:00 inclusive to 19:00 exclusive, agency local service day America/Toronto; 24+ hours never wrap to the same morning.',
        'No calendar.txt, frequencies.txt or feed_info.txt in these downloaded feeds; service spans derive from calendar_dates.',
        'General buffers include all feed boarding locations, including zero-service stops; high-frequency buffer uses >4 departures/hour.',
        'Straight-line proximity ignores pedestrian barriers. No DA population statistics were recalculated or joined.',
        'Station parents are not independently counted; individual platforms are kept. Feeds and stop IDs remain namespaced.',
        'Non-exact frequency templates fail explicitly; expected-service estimation is not silently represented as scheduled service.',
    ]
    with tempfile.TemporaryDirectory(prefix='transitscope-gtfs-') as tmp:
        stage = Path(tmp)
        outputs = {'stops.geojson': geojson(stage/'stops.geojson', all_stops), 'routes.geojson': geojson(stage/'routes.geojson', all_routes)}
        for name, distance, high in [('coverage-400m',400,False),('coverage-800m',800,False),('high-frequency-400m',400,True)]:
            selected = [f for f in all_stops if not high or f['properties']['frequency_class'] == 'High']
            features = []
            if selected:
                points = gpd.GeoSeries([shape(f['geometry']) for f in selected], crs=4326).to_crs(26917)
                union = points.buffer(distance, quad_segs=32).union_all()
                require(union.is_valid, 'Invalid buffer union')
                web = gpd.GeoSeries([union],crs=26917).to_crs(4326).iloc[0]
                features = [feature(name, web, {'distance_m':distance, 'stop_count':len(selected), 'service_date':args.service_date, 'population_analysis':'not performed', 'method':'dissolved straight-line buffers; 32 segments per quadrant'})]
            outputs[name+'.geojson'] = geojson(stage/(name+'.geojson'), features)
        manifest = {'historical_feed_recovered':False, 'dataset_kind':'separate official network snapshot', 'service_date':args.service_date,
                    'window_start':'07:00', 'window_end':'19:00', 'timezone':'America/Toronto', 'feeds':provenance['feeds'],
                    'classification':{'High':'>4/hour','Moderate':'2–4/hour inclusive','Low':'>0 and <2/hour','No service':'0 in selected window'},
                    'processing':reports, 'outputs':outputs, 'limitations':limitations,
                    'municipality_sha256':sha(ROOT/'public/data/municipalities.geojson')}
        compact(stage/'manifest.json', manifest)
        dest=ROOT/'public/data/transit'; dest.mkdir(parents=True,exist_ok=True)
        for path in stage.iterdir():
            pending=dest/(path.name+'.pending'); pending.write_bytes(path.read_bytes()); pending.replace(dest/path.name)
    compact(ROOT/'docs/gtfs-validation.json', manifest)
    lines=['# Phase 3 GTFS validation', '', f'Selected service date: **{args.service_date}**, 07:00–19:00 America/Toronto.', '', 'The source archives are official newly acquired snapshots, not verified historical inputs.', '', '| Feed | Boarding stops | Active trips | Departures in window | High / Moderate / Low / No service | Route shapes |', '|---|---:|---:|---:|---|---:|']
    for key,r in reports.items():
        c=r['classification_counts']; lines.append(f'| {key} | {r["boarding_locations"]} | {r["active_trips"]} | {r["scheduled_boardable_departures"]} | '+ ' / '.join(str(c.get(k,0)) for k in ['High','Moderate','Low','No service'])+f' | {r["route_shape_features"]} |')
    lines += ['', '| Output | Features | Bytes | Invalid geometries |', '|---|---:|---:|---:|']
    lines += [f'| {n} | {v["features"]} | {v["bytes"]} | 0 |' for n,v in outputs.items()]
    lines += ['', 'All coordinates are EPSG:4326. Buffer calculation uses EPSG:26917; full source coordinates are retained and JSON is compact. No analytical population results were changed. All exported IDs are unique and JSON attributes round-trip exactly. Checksums, optional-table presence, service filtering, 24+ times and omitted terminal/pickup rows are recorded in [gtfs-validation.json](gtfs-validation.json).', '', '## Interpretation and limits', ''] + ['- '+s for s in limitations]
    (ROOT/'docs/gtfs-validation.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'feeds':reports,'outputs':outputs},indent=2))


if __name__ == '__main__':
    main()

