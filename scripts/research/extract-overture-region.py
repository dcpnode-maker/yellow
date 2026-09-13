"""Order472: bounded, native-only publisher-range discovery extraction.

No PMS writes, whole-Parquet restore, provider credentials or automatic installs.
A result is regional source evidence, not a confirmed hotel, rate or compset.
The supervisor bounds time/local storage; it does NOT impose a hard network cap.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import stat
import struct
import subprocess
import sys
import time
from datetime import datetime, timezone
from uuid import uuid4

TOOL_ROOT = Path(r"E:\yellow\toolchains\duckdb-1.5.5-python313")
OUTPUT_ROOT = Path(r"E:\yellow\market-discovery\order472")
WHEEL_SHA256 = "6826504277dba513c0c5d71d828456c94d729c9d2482f94b2e289f90a9167e28"
HTTPFS_SHA256 = "65661c40463e74751993e8a7cb7b4c8906be9218319616a0bdfc1b4ae9ffdf9a"
SOURCE_PREFIX = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/"
SOURCE_FILES = [
    "part-00000-c7e47654-8483-5b8f-b183-7ba73334f7a5-c000.zstd.parquet",
    "part-00001-01525d53-9fbf-5f59-aa2a-c557934aeb8a-c000.zstd.parquet",
    "part-00002-06d0251d-44ae-5400-ab29-cb4457570b0d-c000.zstd.parquet",
    "part-00003-9e8cf04e-9fcc-5346-af85-9883ac4821d8-c000.zstd.parquet",
    "part-00004-e1b1066c-7a59-5692-b21d-7e03fafaf0a4-c000.zstd.parquet",
    "part-00005-c7ae3183-76f1-5b61-bf21-1bc92b346aff-c000.zstd.parquet",
    "part-00006-b9b7213b-ab21-565f-b7f2-a76b5761049c-c000.zstd.parquet",
    "part-00007-738c130e-9a4b-5d01-b521-a3d872c8cef9-c000.zstd.parquet",
    "part-00008-48f1e796-6516-5a3b-b151-9c452711a6cd-c000.zstd.parquet",
    "part-00009-75d418fc-b352-5e47-8ce5-3bc2ca931c6e-c000.zstd.parquet",
    "part-00010-828dba08-070e-5e87-b87c-239c122a6836-c000.zstd.parquet",
    "part-00011-2adaedca-dc2e-5b18-9021-4627dfef54bc-c000.zstd.parquet",
    "part-00012-09c98cd6-92ec-5fdb-9b89-0e796ab59604-c000.zstd.parquet",
    "part-00013-9e35ed5a-ddda-5467-ac77-0d15242eb9fc-c000.zstd.parquet",
    "part-00014-5fafa875-a2eb-5f25-80ec-8c003f666ae6-c000.zstd.parquet",
    "part-00015-9dc40db3-3b1d-5e75-b9b5-1c218b3f1743-c000.zstd.parquet"
]
SOURCES = tuple(SOURCE_PREFIX + name for name in SOURCE_FILES)
LIMIT = 500
MAX_OUTPUT = 4 * 1024 * 1024
MAX_RUN_BYTES = 270 * 1024 * 1024
MIN_FREE = 2 * 1024 * 1024 * 1024
MAX_SECONDS = 120
REGION_KEYS = ("minimumLatitude", "maximumLatitude", "minimumLongitude", "maximumLongitude")
QUERY = """SELECT id, names.primary AS name,
point_longitude(ST_AsWKB(geometry)) AS longitude,
point_latitude(ST_AsWKB(geometry)) AS latitude, to_json(addresses) AS addresses,
to_json(websites) AS websites, to_json(categories) AS categories,
operating_status AS operatingStatus, confidence, to_json(sources) AS sources,
filename AS sourceObject
FROM read_parquet(?, filename=true, hive_partitioning=false)
WHERE bbox.xmax >= ? AND bbox.xmin <= ? AND bbox.ymax >= ? AND bbox.ymin <= ?
AND point_longitude(ST_AsWKB(geometry)) >= ? AND point_longitude(ST_AsWKB(geometry)) <= ?
AND point_latitude(ST_AsWKB(geometry)) >= ? AND point_latitude(ST_AsWKB(geometry)) <= ?
LIMIT 501"""


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def validate_region(values: list[float]) -> dict[str, float]:
    if len(values) != 4 or any(type(v) not in (float, int) or not math.isfinite(v) for v in values):
        raise ValueError("Four finite coordinates required")
    lat_min, lat_max, lon_min, lon_max = values
    if not (-90 <= lat_min <= lat_max <= 90 and -180 <= lon_min <= lon_max <= 180):
        raise ValueError("Region must be inclusive and non-wrapping")
    # One bounded regional request, never an accidental whole-world query.
    if lat_max - lat_min > 1 or lon_max - lon_min > 1:
        raise ValueError("Region side exceeds one degree; subdivide explicitly")
    return dict(zip(REGION_KEYS, values))


def point_coordinates(value: object) -> tuple[float, float]:
    """Decode source geometry faithfully, not its float32 enclosing bbox anchors."""
    if not isinstance(value, (bytes, bytearray, memoryview)) or len(value) != 21:
        raise ValueError("Expected a 21-byte 2D WKB Point")
    if value[0] not in (0, 1):
        raise ValueError("Unsupported WKB endian marker")
    endian = "<" if value[0] == 1 else ">"
    kind, longitude, latitude = struct.unpack(endian + "Idd", value[1:])
    if kind != 1:
        raise ValueError("Unsupported WKB geometry/dimensions")
    if not (math.isfinite(longitude) and math.isfinite(latitude)
            and -180 <= longitude <= 180 and -90 <= latitude <= 90):
        raise ValueError("Invalid source Point coordinates")
    return longitude, latitude


def point_longitude(value: object) -> float:
    return point_coordinates(value)[0]


def point_latitude(value: object) -> float:
    return point_coordinates(value)[1]


def register_point_functions(con) -> None:
    # Special NULL handling ensures unsupported/missing geometry raises explicitly.
    con.create_function("point_longitude", point_longitude, ["BLOB"], "DOUBLE", null_handling="special")
    con.create_function("point_latitude", point_latitude, ["BLOB"], "DOUBLE", null_handling="special")


def reject_reparse(path: Path) -> None:
    """Check each existing ancestor; never follow a junction into another target."""
    for candidate in (path, *path.parents):
        if candidate.exists() or candidate.is_symlink():
            info = candidate.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                raise ValueError("Reparse/symlink path is not admitted")


def create_run_directory(root: Path = OUTPUT_ROOT) -> Path:
    reject_reparse(root)
    root.mkdir(parents=True, exist_ok=True)
    reject_reparse(root)
    run = root / ("region-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex)
    run.mkdir(exist_ok=False)
    reject_reparse(run)
    return run


def write_json_new(path: Path, value: object, maximum: int = MAX_OUTPUT) -> tuple[int, str]:
    payload = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    if len(payload) > maximum:
        raise ValueError("Output exceeds byte bound")
    reject_reparse(path)
    # Exclusive ownership: never replace/delete an existing or another run's file.
    with path.open("xb") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    return len(payload), hashlib.sha256(payload).hexdigest()


def guard_run(run: Path, started: float, free_bytes: int | None = None) -> str | None:
    if time.monotonic() - started > MAX_SECONDS:
        return "wall_deadline"
    if (shutil.disk_usage(run).free if free_bytes is None else free_bytes) < MIN_FREE:
        return "disk_reserve"
    total = 0
    for path in run.rglob("*"):
        reject_reparse(path)
        if path.is_file():
            size = path.stat().st_size
            total += size
            if path.name in ("stdout.log", "stderr.log") and size > 65536:
                return "log_byte_bound"
            if path.name == "region.json" and size > MAX_OUTPUT:
                return "artifact_byte_bound"
    return "run_byte_bound" if total > MAX_RUN_BYTES else None


def configure(run: Path):
    reject_reparse(TOOL_ROOT)
    wheel = TOOL_ROOT / "duckdb-1.5.5-cp313-cp313-win_amd64.whl"
    extension = TOOL_ROOT / "extensions/v1.5.5/windows_amd64/httpfs.duckdb_extension"
    if digest(wheel) != WHEEL_SHA256 or digest(extension) != HTTPFS_SHA256:
        raise ValueError("Pinned tool hash mismatch")
    sys.path.insert(0, str(TOOL_ROOT / "runtime"))
    import duckdb
    if duckdb.__version__ != "1.5.5" or not Path(duckdb.__file__).resolve().is_relative_to((TOOL_ROOT / "runtime").resolve()):
        raise ValueError("Wrong isolated DuckDB")
    con = duckdb.connect(":memory:", config={
        "threads": "2", "memory_limit": "256MiB", "max_temp_directory_size": "256MiB",
        "temp_directory": str(run / "temp"), "extension_directory": str(TOOL_ROOT / "extensions"),
        "allow_unsigned_extensions": "false", "allow_community_extensions": "false",
        "autoload_known_extensions": "false", "autoinstall_known_extensions": "false",
    })
    # Load the exact signed file, not mutable install-info pointing at a temp file.
    con.execute("LOAD '" + str(extension).replace("\\", "/").replace("'", "''") + "'")
    settings = {
        "auto_fallback_to_full_download": "false",
        "http_timeout": "10", "http_retries": "1", "enable_http_logging": "false",
        "httpfs_enable_credential_refresh": "false",
    }
    for name, value in settings.items():
        con.execute("SET " + name + " = " + value)
    observed = dict(con.execute("SELECT name,value FROM duckdb_settings()").fetchall())
    required = {**settings, "threads": "2", "memory_limit": "256.0 MiB",
                "max_temp_directory_size": "256.0 MiB", "allow_unsigned_extensions": "false",
                "autoload_known_extensions": "false", "autoinstall_known_extensions": "false"}
    if any(observed.get(name) != value for name, value in required.items()):
        raise ValueError("Required resource/safety setting did not take effect")
    register_point_functions(con)
    write_json_new(run / "settings.json", {name: observed[name] for name in required})
    return con


def extract(run: Path, values: list[float]) -> None:
    region = validate_region(values)
    if run.parent != OUTPUT_ROOT or not run.name.startswith("region-"):
        raise ValueError("Worker path outside admitted root")
    reject_reparse(run)
    con = configure(run)
    try:
        bounds = [region["minimumLongitude"], region["maximumLongitude"],
                  region["minimumLatitude"], region["maximumLatitude"]]
        parameters = [list(SOURCES), *bounds, *bounds]
        cursor = con.execute(QUERY, parameters)
        columns = [item[0] for item in cursor.description]
        rows = []
        for entry in cursor.fetchmany(LIMIT + 1):
            row = dict(zip(columns, entry))
            for key in ("addresses", "websites", "categories", "sources"):
                row[key] = json.loads(row[key]) if row[key] is not None else None
            if row["sourceObject"] not in SOURCES:
                raise ValueError("Unexpected publisher object")
            rows.append(row)
        # Order only returned bounded evidence; no global sort/materialization.
        rows.sort(key=lambda row: (str(row["id"]), str(row["sourceObject"])))
        artifact = {
            "format": "yellow/overture-region/v2", "coordinateMethod": "source-wkb-point", "release": "2026-08-19.0",
            "sourceSchema": "v1.18.0", "method": "publisher-range-extract",
            "capturedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "region": region, "limit": LIMIT, "moreAvailable": len(rows) > LIMIT,
            "rows": rows, "query": QUERY, "sourceObjects": list(SOURCES),
            "tool": {"duckdbVersion": "1.5.5", "wheelSha256": WHEEL_SHA256, "httpfsSha256": HTTPFS_SHA256},
        }
        size, sha256 = write_json_new(run / "region.json", artifact)
        write_json_new(run / "receipt.json", {
            "status": "extracted", "rows": len(rows), "moreAvailable": len(rows) > LIMIT,
            "bytes": size, "sha256": sha256, "scriptSha256": digest(Path(__file__)),
            "method": "publisher-range-extract", "drivePayloadVerified": False,
            "coordinateMethod": "source-wkb-point",
            "networkBytes": None, "hardNetworkByteCap": False,
        })
    finally:
        con.close()


def supervise(values: list[float]) -> int:
    validate_region(values)
    if os.name != "nt" or sys.version_info[:2] != (3, 13):
        raise ValueError("Use the admitted native Windows Python3.13 tool")
    reject_reparse(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(OUTPUT_ROOT).free < MIN_FREE:
        raise ValueError("Insufficient disk reserve")
    run = create_run_directory()
    reason = None
    started = time.monotonic()
    with (run / "stdout.log").open("xb") as stdout, (run / "stderr.log").open("xb") as stderr:
        process = subprocess.Popen([sys.executable, "-B", str(Path(__file__).resolve()),
                                    "--worker", str(run), "--bbox", *map(str, values)],
                                   stdout=stdout, stderr=stderr, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            while process.poll() is None:
                reason = guard_run(run, started)
                if reason:
                    process.kill()  # Only this owned child; no global process-name kill.
                    break
                time.sleep(0.2)
            process.wait(timeout=10)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)
    reason = reason or guard_run(run, started)
    success = process.returncode == 0 and reason is None and (run / "receipt.json").is_file()
    write_json_new(run / "supervision.json", {
        "accepted": success, "exitCode": process.returncode, "guard": reason,
        "elapsedSeconds": round(time.monotonic() - started, 3), "path": str(run),
        "noGlobalRestore": True, "noPmsWrites": True,
    })
    print(json.dumps({"accepted": success, "path": str(run), "exitCode": process.returncode, "guard": reason}))
    return 0 if success else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bbox", nargs=4, required=True, type=float,
                        metavar=("LAT_MIN", "LAT_MAX", "LON_MIN", "LON_MAX"))
    parser.add_argument("--worker", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        extract(args.worker, args.bbox)
        return 0
    return supervise(args.bbox)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        # No credentials are configured; error type only avoids raw remote data in logs.
        print(json.dumps({"accepted": False, "error": type(error).__name__, "message": str(error)[:1200]}),
              file=sys.stderr)
        sys.exit(1)
