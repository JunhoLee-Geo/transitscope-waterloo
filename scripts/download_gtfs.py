"""Download NEW official snapshots into a new directory; never overwrite an archive.

This cannot recover the exact Phase 3 snapshots if the mutable URLs have changed.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile
import pandas as pd


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True,help='New empty/nonexistent snapshot directory')
    args=parser.parse_args()
    if args.output.exists() and any(args.output.iterdir()):
        raise ValueError('Use a new empty directory; existing snapshots are immutable')
    payloads=[]
    for name,number in [('bus',1),('lrt',2)]:
        url=f'https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/{number}'
        with urllib.request.urlopen(url,timeout=60) as response:
            data=response.read()
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if archive.testzip(): raise ValueError('Corrupt archive')
            dates=[]
            for filename,fields in [('calendar_dates.txt',['date']),('calendar.txt',['start_date','end_date'])]:
                if filename in archive.namelist():
                    frame=pd.read_csv(archive.open(filename),dtype=str)
                    for field in fields: dates.extend(frame[field].dropna().tolist())
            if not dates: raise ValueError('No service validity dates')
        now=datetime.now(timezone.utc)
        meta={'feed_id':name,'provider':'Grand River Transit / Regional Municipality of Waterloo',
              'download_url':url,'downloaded_at_utc':now.isoformat(),'download_date':now.date().isoformat(),
              'archive':name+'.zip','sha256':hashlib.sha256(data).hexdigest(),
              'calendar_service_span':{'start':min(dates),'end':max(dates)},
              'limitations':['Mutable official endpoint; newly acquired snapshot, not a verified historical source.','Calendar span is not a guarantee that every date operates.']}
        payloads.append((data,meta))
    args.output.mkdir(parents=True,exist_ok=True)
    for data,meta in payloads:(args.output/meta['archive']).write_bytes(data)
    (args.output/'sources.json').write_text(json.dumps({'historical_feed_recovered':False,'feeds':[meta for _,meta in payloads]},indent=2),encoding='utf-8')
    print(args.output/'sources.json')


if __name__=='__main__': main()
