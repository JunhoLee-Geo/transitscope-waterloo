import importlib.util
from pathlib import Path
import unittest
import pandas as pd

spec=importlib.util.spec_from_file_location('gtfs',Path(__file__).resolve().parents[1]/'scripts/prepare_gtfs.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)


class GTFSTests(unittest.TestCase):
    def rows(self, departures=('07:00:00','08:00:00','09:00:00')):
        return g.canonical_stop_times(pd.DataFrame({'trip_id':['t']*3,'stop_id':['a','b','c'],'stop_sequence':['1','2','3'],'departure_time':list(departures),'pickup_type':['0']*3}))

    def test_calendar_weekday_exceptions_override(self):
        cal=pd.DataFrame([dict(service_id='regular',start_date='20261101',end_date='20261130',tuesday='1'),dict(service_id='expired',start_date='20261001',end_date='20261031',tuesday='1')])
        exc=pd.DataFrame([dict(service_id='regular',date='20261124',exception_type='2'),dict(service_id='special',date='20261124',exception_type='1')])
        self.assertEqual(g.active_services(cal,exc,'2026-11-24'),{'special'})
        self.assertEqual(g.active_services(pd.DataFrame(),exc,'2026-11-24'),{'special'})

    def test_times_beyond_midnight_not_wrapped(self):
        self.assertEqual(g.seconds('25:10:00'),90600)
        self.assertEqual(g.trip_events(self.rows(('24:00:00','25:00:00','26:00:00')),pd.DataFrame(),7*3600,19*3600),{})
        with self.assertRaises(ValueError):g.seconds('24:60:00')

    def test_window_boundaries_terminal_and_pickup(self):
        events=g.trip_events(self.rows(('07:00:00','19:00:00','20:00:00')),pd.DataFrame(),25200,68400)
        self.assertEqual(events,{'a':1})
        rows=self.rows(); rows.loc[0,'pickup_type']='1'
        self.assertEqual(g.trip_events(rows,pd.DataFrame(),25200,68400),{'b':1})

    def test_duplicate_event_keys_and_repeat_visits(self):
        rows=self.rows(); duplicate=pd.concat([rows,rows.iloc[:1]],ignore_index=True)
        self.assertEqual(len(g.canonical_stop_times(duplicate)),3)
        duplicate.loc[3,'departure_time']='07:01:00'
        with self.assertRaisesRegex(ValueError,'Conflicting'):g.canonical_stop_times(duplicate)
        rows.loc[1,'stop_id']='a'
        self.assertEqual(g.trip_events(rows,pd.DataFrame(),25200,68400),{'a':2})

    def test_exact_frequency_offsets_and_no_template_double_count(self):
        rows=self.rows(('06:00:00','06:10:00','06:20:00'))
        freq=pd.DataFrame([dict(start_time='07:00:00',end_time='08:00:00',headway_secs='1800',exact_times='1')])
        self.assertEqual(g.trip_events(rows,freq,25200,27600),{'a':2,'b':1})

    def test_nonexact_and_overlapping_frequencies_rejected(self):
        freq=pd.DataFrame([dict(start_time='07:00:00',end_time='08:00:00',headway_secs='600',exact_times='0')])
        with self.assertRaisesRegex(ValueError,'Non-exact'):g.trip_events(self.rows(),freq,25200,68400)
        freq['exact_times']='1'
        with self.assertRaisesRegex(ValueError,'Overlapping'):g.trip_events(self.rows(),pd.concat([freq,freq]),25200,68400)

    def test_frequency_thresholds(self):
        self.assertEqual([g.frequency_class(n) for n in [0,1,23,24,48,49]],['No service','Low','Low','Moderate','Moderate','High'])


if __name__=='__main__':unittest.main()
