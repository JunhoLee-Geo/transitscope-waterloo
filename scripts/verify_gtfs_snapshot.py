import json,zipfile
import pandas as pd
from pathlib import Path
root=Path('.')
exports=json.loads((root/'public/data/transit/stops.geojson').read_text(encoding='utf-8'))
for name in ['bus','lrt']:
 with zipfile.ZipFile(root/f'data/raw/gtfs-phase3/{name}.zip') as z:
  trips=pd.read_csv(z.open('trips.txt'),dtype=str)
  cal=pd.read_csv(z.open('calendar_dates.txt'),dtype=str)
  st=pd.read_csv(z.open('stop_times.txt'),dtype=str,keep_default_na=False)
 active=set(cal.loc[(cal.date=='20261124') & (cal.exception_type=='1'),'service_id'])
 valid_trips=trips.loc[trips.service_id.isin(active),'trip_id']
 st=st[st.trip_id.isin(valid_trips)].copy(); st['seq']=st.stop_sequence.astype(int)
 st['seconds']=st.departure_time.map(lambda s:sum(int(p)*m for p,m in zip(s.split(':'),[3600,60,1])))
 selected=st[(st.seq<st.groupby('trip_id').seq.transform('max')) & st.pickup_type.isin(['','0']) & st.seconds.ge(25200) & st.seconds.lt(68400)]
 counts=selected.groupby('stop_id').size().to_dict()
 actual={f['properties']['stop_id']:f['properties']['scheduled_departures'] for f in exports['features'] if f['properties']['feed_id']==name}
 assert all(actual[k]==counts.get(k,0) for k in actual)
 assert sum(actual.values())==len(selected)
 print(name,'independent groupby matched all',len(actual),'stops;',len(selected),'departures')
print(next(f['properties'] for f in exports['features'] if f['id']=='bus:4236'))
