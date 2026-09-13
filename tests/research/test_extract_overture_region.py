"""Offline resource and ownership checks; these do not prove network or data quality."""
import importlib.util
import json
from pathlib import Path
import tempfile
import struct
import time
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "scripts/research/extract-overture-region.py"
spec = importlib.util.spec_from_file_location("overture_extract", SOURCE)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class RegionalExtractionTests(unittest.TestCase):
    def setUp(self):
        # This suite owns only its newly created child, never an existing artifact.
        reader.OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix="offline-proof-", dir=reader.OUTPUT_ROOT)
        self.root = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def test_inclusive_degenerate_and_arabian_region(self):
        self.assertEqual(reader.validate_region([25.19,25.21,55.27,55.29])["minimumLatitude"],25.19)
        self.assertEqual(reader.validate_region([90,90,180,180])["maximumLongitude"],180)

    def test_nonfinite_boolean_inverted_wrap_and_world_fail(self):
        for values in ([True,1,0,1],[float("nan"),1,0,1],[0,float("inf"),0,1],
                       [1,0,0,1],[0,1,179,-179],[-91,-90,0,1],[0,1,180,181],
                       [-90,90,-180,180],[0,1,0],["0",1,0,1]):
            with self.subTest(values=values), self.assertRaises(ValueError):
                reader.validate_region(values)

    def test_all16_exact_release_sources_no_wildcard(self):
        self.assertEqual(len(reader.SOURCES),16)
        self.assertEqual(len(set(reader.SOURCES)),16)
        for index,url in enumerate(reader.SOURCES):
            self.assertTrue(url.startswith(reader.SOURCE_PREFIX + f"part-{index:05d}-"))
            self.assertTrue(url.endswith("-c000.zstd.parquet"))
            self.assertNotIn("*",url)

    def test_exclusive_output_keeps_preexisting_bytes(self):
        path = self.root / "artifact.json"
        count,digest = reader.write_json_new(path,{"name":"فندق"})
        self.assertEqual(count,len(path.read_bytes()))
        self.assertEqual(digest,reader.digest(path))
        original = path.read_bytes()
        with self.assertRaises(FileExistsError):
            reader.write_json_new(path,{"name":"overwrite"})
        self.assertEqual(path.read_bytes(),original)

    def test_oversize_and_nonfinite_do_not_create_file(self):
        path = self.root / "too-big.json"
        with self.assertRaises(ValueError):
            reader.write_json_new(path,{"value":"x"*300},100)
        self.assertFalse(path.exists())
        with self.assertRaises(ValueError):
            reader.write_json_new(path,{"value":float("nan")})
        self.assertFalse(path.exists())

    def test_owned_run_unique_no_overwrite(self):
        first = reader.create_run_directory(self.root)
        second = reader.create_run_directory(self.root)
        self.assertNotEqual(first,second)
        self.assertEqual(first.parent,self.root)
        self.assertTrue(first.name.startswith("region-"))

    def test_time_and_disk_guards(self):
        self.assertEqual(reader.guard_run(self.root,time.monotonic()-reader.MAX_SECONDS-1,reader.MIN_FREE),
                         "wall_deadline")
        self.assertEqual(reader.guard_run(self.root,time.monotonic(),reader.MIN_FREE-1),"disk_reserve")
        self.assertIsNone(reader.guard_run(self.root,time.monotonic(),reader.MIN_FREE))

    def test_log_and_total_bounds(self):
        (self.root/"stdout.log").write_bytes(b"x"*65537)
        self.assertEqual(reader.guard_run(self.root,time.monotonic(),reader.MIN_FREE),"log_byte_bound")
        # Reduce only test threshold, never production limits.
        with patch.object(reader,"MAX_RUN_BYTES",1):
            (self.root/"stdout.log").write_bytes(b"x")
            (self.root/"other").write_bytes(b"x")
            self.assertEqual(reader.guard_run(self.root,time.monotonic(),reader.MIN_FREE),"run_byte_bound")

    def test_caps_are_explicit_not_network_claim(self):
        self.assertIn("LIMIT 501",reader.QUERY)
        self.assertNotIn("SELECT *",reader.QUERY)
        self.assertEqual(reader.LIMIT,500)
        self.assertEqual(reader.MAX_OUTPUT,4*1024*1024)
        self.assertIn('"hardNetworkByteCap": False',SOURCE.read_text(encoding="utf-8"))

    def test_reparse_attribute_rejected(self):
        info=type("Info",(),{"st_mode":0,"st_file_attributes":0x400})()
        with patch.object(Path,"lstat",return_value=info), self.assertRaises(ValueError):
            reader.reject_reparse(self.root)

    def test_exact_wkb_point_both_endian_and_geographic_edges(self):
        for endian,marker in (("<",1),(">",0)):
            for longitude,latitude in ((55.273123456,25.192123456),(-180,-90),(180,90)):
                value=bytes([marker])+struct.pack(endian+"Idd",1,longitude,latitude)
                self.assertEqual(reader.point_coordinates(value),(longitude,latitude))

    def test_wkb_rejects_null_type_dimensions_length_nonfinite_and_range(self):
        valid=bytes([1])+struct.pack("<Idd",1,46.677,24.708)
        bad=[None,"text",valid[:-1],valid+b"x",bytes([2])+valid[1:]]
        for kind in (2,1001,2001,0x20000001,0x80000001):
            bad.append(bytes([1])+struct.pack("<Idd",kind,46.677,24.708))
        for longitude,latitude in ((float("nan"),0),(0,float("inf")),(181,0),(0,-91)):
            bad.append(bytes([1])+struct.pack("<Idd",1,longitude,latitude))
        for value in bad:
            with self.subTest(value=value), self.assertRaises(ValueError):
                reader.point_coordinates(value)

    @unittest.skipUnless((reader.TOOL_ROOT/"runtime/duckdb").exists(),"admitted isolated DuckDB tool required")
    def test_native_exact_point_filters_precede_sentinel_and_include_edges(self):
        con=reader.configure(self.root)
        try:
            con.execute("CREATE TABLE fixture(geometry GEOMETRY('OGC:CRS84'))")
            outside=bytes([1])+struct.pack("<Idd",1,55.26999999,25.2)
            left=bytes([1])+struct.pack("<Idd",1,55.27,25.192)
            right=bytes([0])+struct.pack(">Idd",1,55.282,25.204)
            con.executemany("INSERT INTO fixture VALUES (ST_SetCRS(ST_GeomFromWKB(?),'OGC:CRS84'))",
                            [(outside,)]*501+[(left,)]*500+[(right,)])
            rows=con.execute("SELECT point_longitude(ST_AsWKB(geometry)),point_latitude(ST_AsWKB(geometry)) FROM fixture "
                "WHERE point_longitude(ST_AsWKB(geometry))>=55.27 AND point_longitude(ST_AsWKB(geometry))<=55.282 "
                "AND point_latitude(ST_AsWKB(geometry))>=25.192 AND point_latitude(ST_AsWKB(geometry))<=25.204 LIMIT 501").fetchall()
            self.assertEqual(len(rows),501)
            self.assertIn((55.27,25.192),rows)
            self.assertIn((55.282,25.204),rows)
            self.assertIn("bbox.xmax >= ? AND bbox.xmin <= ?",reader.QUERY)
            self.assertNotIn("CAST(geometry AS BLOB)",reader.QUERY)
            self.assertLess(reader.QUERY.index("AND point_longitude"),reader.QUERY.index("LIMIT 501"))
            with self.assertRaises(Exception):
                con.execute("SELECT point_longitude(NULL)").fetchall()
        finally:
            con.close()


if __name__ == "__main__":
    unittest.main()
