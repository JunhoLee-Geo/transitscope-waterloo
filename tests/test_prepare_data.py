"""Negative-path and round-trip checks; synthetic geometries exist only in tests."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import geopandas as gpd
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_data', ROOT / 'scripts/prepare_data.py')
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


class PreparationTests(unittest.TestCase):
    def frame(self):
        return gpd.GeoDataFrame({'DAUID': ['001'], 'Population': [123.45]}, geometry=[Polygon([(-80.5,43.4),(-80.49,43.4),(-80.49,43.41),(-80.5,43.41),(-80.5,43.4)])], crs=4326)

    def export(self, frame):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.geojson'
            report = {}
            prep.export_layer(frame, path, 'DAUID', report)
            return json.loads(path.read_text()), report

    def test_duplicate_and_blank_identifiers_rejected(self):
        frame = self.frame()
        frame.loc[1] = frame.loc[0]
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            self.export(frame)
        frame = self.frame()
        frame.loc[0, 'DAUID'] = ' '
        with self.assertRaisesRegex(ValueError, 'empty/non-string'):
            self.export(frame)

    def test_missing_crs_rejected(self):
        frame = self.frame().set_crs(None, allow_override=True)
        with self.assertRaisesRegex(ValueError, 'missing CRS'):
            self.export(frame)

    def test_invalid_polygon_repaired_and_reported(self):
        frame = self.frame()
        frame.loc[0, 'geometry'] = Polygon([(-80.5,43.4),(-80.49,43.41),(-80.49,43.4),(-80.5,43.41),(-80.5,43.4)])
        result, report = self.export(frame)
        self.assertEqual(report['source_invalid_geometries'], 1)
        self.assertEqual(report['output_invalid_geometries'], 0)
        self.assertEqual(len(report['repairs']), 1)
        self.assertEqual(result['features'][0]['properties']['Population'], 123.45)
        self.assertEqual(result['features'][0]['id'], '001')

    def test_displacement_units_are_metres_even_for_geographic_input(self):
        frame = self.frame()
        frame.geometry = frame.translate(xoff=0.00000023)
        _, report = self.export(frame)
        self.assertEqual(report['distance_check_crs'], 'EPSG:26917')
        self.assertGreater(report['maximum_hausdorff_change_metres'], 0.001)
        self.assertLess(report['maximum_hausdorff_change_metres'], 0.2)

    def test_nonfinite_analytical_value_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Missing/non-finite'):
            prep.validate_analytical(self.frame().assign(Population=float('inf')))

    def test_population_consistency_rejected(self):
        frame = self.frame().assign(pop_access_400=50., pop_access_800=40., Pop_Beyond_800=83.45,
            Pct_Access_400=40., Pct_Access_800=32., da_area=1., access_400_area=.4,
            access_800_area=.32, access_400_ratio=.4, access_800_ratio=.32, Pct_Beyond_800=68., FullName='Example')
        with self.assertRaisesRegex(ValueError, '400m population exceeds'):
            prep.validate_analytical(frame)
        frame['pop_access_400'] = 30.
        frame['Pop_Beyond_800'] = 1.
        with self.assertRaisesRegex(ValueError, 'Beyond-800m population inconsistent'):
            prep.validate_analytical(frame)

    def test_failed_validation_leaves_published_files_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source'
            processed = source / 'data/processed'
            processed.mkdir(parents=True)
            for name in ['waterloo_da_population.gpkg', 'waterloo_accessibility.gpkg']:
                (processed / name).write_bytes(b'test fixture')
            root = Path(directory) / 'project'
            out = root / 'public/data'
            out.mkdir(parents=True)
            sentinel = out / 'da-population.geojson'
            sentinel.write_text('accepted prior output')
            stage = Path(directory) / 'stage'
            stage.mkdir()
            args = SimpleNamespace(municipalities=None, municipalities_source=None)
            def staged_export(frame, path, *unused):
                path.write_text('staged candidate')
                return frame
            with patch.object(prep, 'ROOT', root), patch.object(prep.subprocess, 'check_output', return_value='fixture-commit'), patch.object(prep.gpd, 'read_file', side_effect=lambda *args, **kwargs: self.frame().assign(DGUID='fixture', PRUID='35')), patch.object(prep, 'export_layer', side_effect=staged_export), patch.object(prep, 'validate_analytical', side_effect=ValueError('injected invalid input')):
                with self.assertRaisesRegex(ValueError, 'injected invalid input'):
                    prep.run_preparation(args, source, stage)
            self.assertEqual(sentinel.read_text(), 'accepted prior output')
            self.assertEqual((stage / 'data/da-population.geojson').read_text(), 'staged candidate')


if __name__ == '__main__':
    unittest.main()

