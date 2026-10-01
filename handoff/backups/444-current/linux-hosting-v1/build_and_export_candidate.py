#!/usr/bin/env python3
"""Make and export a config-only 444 image repackage; never starts the app."""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import time

ARTIFACTS = Path("/workspace/yellow-coordination/release-20261001/receiving-b9-linux-v1")
ROOT = Path(__file__).absolute().parent
BASE_SOURCE = "b9ba702a074a487feeafa056abb49abcdcf01ba8"
CANDIDATE_SOURCE = "444072ffdff2b7745345d88f71b603c17e11ace6"
CANDIDATE_TREE = "2fd5f9b5f55cc3404d81c88385f90c8c17582223"
BASE_IMAGE_ID = "sha256:1e522a8ab84af27ddc57d4aef3e7f6a383d254be15225a8c9df1722df87d7bc9"
BASE_IMAGE_TAG = "yellow-receiving-runtime:b9ba702a074a487feeafa056abb49abcdcf01ba8"
BASE_PROOF_SHA256 = "2f800327af873496138e5a0976af67261d250cb05f5be21acfc680d2bb255ef6"
EQUIVALENCE_SHA256 = "7c1c2579ba7541135e3ece429986869974375af8e7275e2fd1ad2b27e40223a8"
CONVERTER_SHA256 = "d4b9f325581404c5782ab81ebfedc1ca974a0bb55da24fd1dedabdbe372767f8"
APP_TAG = "yellow-candidate-runtime:" + CANDIDATE_SOURCE
JOB = "RELEASE-20261001-candidate-444-image-repackage"
PRIVATE = ROOT / "private-candidate-444-v1"
PUBLIC_PROOF = ROOT / "CANDIDATE_444_IMAGE_EXPORT_PROOF.json"
CONVERTER = ARTIFACTS / "docker_save_to_oci.py"
BASE_DIFF_IDS = [
    "sha256:0854555d70acaa318b38ee50bc667cb51ff6bf0757624624c7ff3b6fe17459a0",
    "sha256:9072d322eb16c6a414861801ae295eb67839e0aeabeab982bea0520b6fccdeaa",
    "sha256:135be4fad03ab91972ef4eb6846e200938c2dea183881ba5cac3d79648a09737",
    "sha256:7a415decbb54be30a9369d7466887b96544eedd7b28dbb7ad87dc6381a4b91a0",
    "sha256:fb0c09554b3fc2d49fda0df4305e80bbd89a17e405ed02b65b79c54fcf6fd637",
    "sha256:592e878c2cd79244e9ecf582b4688c9fa9c45bb31b1890119e1fb88fae6a6784",
    "sha256:e51fbaa4439c4e38781cc712ef035b33f5c6f5e3d4dd4d1377552689102b3d84",
    "sha256:06fca1b110f6a67625050001ccdee537dbe49390d99e394a9899f3c481b97b11",
    "sha256:2cfbf35b5f39e58c0e271f4e4211192b643e614daf9ed30829ad66c8d210397f",
    "sha256:c768036e3683227bc2dbbda3c2886a372eeff193f0186ba9d0ed677bbaab4068",
    "sha256:64022fcc6881f35e088f90d624fbff2525318464faaac9b8f5a730509d6e9805",
]
DOCKER = ["docker", "--host", "unix:///var/run/docker.sock"]
CURRENT: subprocess.Popen | None = None
DEADLINE = 0.0


def sha_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def docker_env() -> dict[str, str]:
    env = dict(os.environ)
    for key in ("DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"):
        env.pop(key, None)
    return env


def run(args: list[str], *, cap: float = 30, stdout_file=None, check: bool = True) -> bytes:
    global CURRENT
    remaining = DEADLINE - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("bounded candidate job deadline")
    CURRENT = subprocess.Popen(args, env=docker_env(), stdout=stdout_file or subprocess.PIPE,
                               stderr=subprocess.PIPE, start_new_session=True)
    try:
        stdout, _stderr = CURRENT.communicate(timeout=min(cap, remaining))
    except BaseException:
        stop_process()
        raise
    code = CURRENT.returncode
    CURRENT = None
    if check and code != 0:
        raise RuntimeError("candidate command failed")
    return stdout or b""


def run_json(args: list[str], *, cap: float = 30, check: bool = True):
    output = run(args, cap=cap, check=check)
    try:
        return json.loads(output)
    except (json.JSONDecodeError, UnicodeDecodeError):
        if check or output:
            raise RuntimeError("candidate command returned invalid metadata") from None
        return None


def image_inspect(reference: str) -> dict:
    template = ("{\"id\":{{json .Id}},\"os\":{{json .Os}},\"architecture\":{{json .Architecture}},"
                "\"user\":{{json .Config.User}},\"command\":{{json .Config.Cmd}},"
                "\"revision\":{{if .Config.Labels}}{{json (index .Config.Labels \"org.opencontainers.image.revision\")}}{{else}}null{{end}},"
                "\"base_revision\":{{if .Config.Labels}}{{json (index .Config.Labels \"yellow.candidate.base-revision\")}}{{else}}null{{end}},"
                "\"candidate_job\":{{if .Config.Labels}}{{json (index .Config.Labels \"yellow.candidate.job\")}}{{else}}null{{end}},"
                "\"candidate_source\":{{if .Config.Labels}}{{json (index .Config.Labels \"yellow.candidate.source\")}}{{else}}null{{end}},"
                "\"candidate_method\":{{if .Config.Labels}}{{json (index .Config.Labels \"yellow.candidate.method\")}}{{else}}null{{end}},"
                "\"candidate_nonce\":{{if .Config.Labels}}{{json (index .Config.Labels \"yellow.candidate.nonce\")}}{{else}}null{{end}},"
                "\"diff_ids\":{{json .RootFS.Layers}}}")
    result = run_json(DOCKER + ["image", "inspect", "--format", template, reference])
    if not isinstance(result, dict):
        raise RuntimeError("candidate image metadata shape invalid")
    return result


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def load_public_inputs() -> tuple[dict, dict]:
    proof_path = ARTIFACTS / "B9_OCI_CONTENT_PROOF.json"
    equivalence_path = ARTIFACTS / "PRODUCT_SOURCE_EQUIVALENCE_444.json"
    require(sha_file(proof_path) == BASE_PROOF_SHA256, "pinned public b9 proof changed")
    require(sha_file(equivalence_path) == EQUIVALENCE_SHA256, "pinned 444 equivalence proof changed")
    base = json.loads(proof_path.read_text())
    equivalence = json.loads(equivalence_path.read_text())
    require(base.get("passed") is True and base.get("config_digest") == BASE_IMAGE_ID
            and [x.get("uncompressed_diff_id") for x in base.get("layers", [])] == BASE_DIFF_IDS,
            "public b9 image proof invalid")
    require(equivalence.get("product_base") == BASE_SOURCE
            and equivalence.get("laptop_latest_test_only_revision") == CANDIDATE_SOURCE
            and equivalence.get("product_changed_files") == []
            and equivalence.get("laptop_receiving_checkout_modified") is False
            and equivalence.get("cloud_source_checkout_modified") is False,
            "public 444 product equivalence proof invalid")
    return base, equivalence


def source_checkout(path: Path) -> dict:
    if path.is_symlink() or not path.is_dir():
        raise RuntimeError("candidate source checkout path invalid")
    head = run(["git", "-C", str(path), "rev-parse", "HEAD"]).decode().strip()
    tree = run(["git", "-C", str(path), "rev-parse", "HEAD^{tree}"]).decode().strip()
    status = run(["git", "-C", str(path), "status", "--porcelain=v1", "--untracked-files=all"])
    require(head == CANDIDATE_SOURCE and tree == CANDIDATE_TREE and not status,
            "candidate checkout identity or cleanliness mismatch")
    return {"revision": head, "tree": tree, "working_tree_clean": True}


def stop_process() -> None:
    global CURRENT
    if CURRENT is None or CURRENT.poll() is not None:
        return
    try:
        os.killpg(CURRENT.pid, signal.SIGTERM)
        CURRENT.wait(timeout=3)
    except BaseException:
        try:
            os.killpg(CURRENT.pid, signal.SIGKILL)
        except OSError:
            pass
    CURRENT = None


def main() -> int:
    global DEADLINE
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-checkout", required=True, type=Path,
                        help="root-owned detached checkout at exact 444 revision/tree")
    args = parser.parse_args()
    DEADLINE = time.monotonic() + 270  # 300 seconds total; reserve 30 seconds for final checkpoint.
    stage = "admission"
    try:
        require(not ROOT.is_symlink() and not PRIVATE.exists() and not PUBLIC_PROOF.exists(),
                "candidate output paths must be fresh and non-symlinked")
        checkout = source_checkout(args.source_checkout.absolute())
        _base_proof, _equivalence = load_public_inputs()
        require(sha_file(CONVERTER) == CONVERTER_SHA256, "pinned public OCI converter changed")
        base_tag_id = run(DOCKER + ["image", "inspect", "--format", "{{.Id}}", BASE_IMAGE_TAG]).decode().strip()
        require(base_tag_id == BASE_IMAGE_ID, "verified b9 tag no longer points to pinned image")
        base = image_inspect(BASE_IMAGE_ID)
        require(base.get("id") == BASE_IMAGE_ID and base.get("revision") == BASE_SOURCE
                and base.get("os") == "linux" and base.get("architecture") == "amd64"
                and base.get("user") == "bun" and base.get("command") == ["bun", "run", "start"]
                and base.get("diff_ids") == BASE_DIFF_IDS,
                "verified b9 runtime image identity mismatch")
        tag_check = run(DOCKER + ["image", "inspect", "--format", "{{.Id}}", APP_TAG], check=False)
        require(not tag_check.strip(), "candidate image tag already exists")
        PRIVATE.mkdir(mode=0o700)
        os.chmod(PRIVATE, 0o700)
        nonce = secrets.token_hex(20)
        context = PRIVATE / "empty-context"
        context.mkdir(mode=0o700)
        dockerfile = ("FROM " + BASE_IMAGE_TAG + "\n"
                      "ARG CANDIDATE_NONCE\n"
                      "ENV YELLOW_BUILD_SHA=" + CANDIDATE_SOURCE + "\n"
                      "LABEL org.opencontainers.image.revision=" + CANDIDATE_SOURCE
                      + " yellow.candidate.base-revision=" + BASE_SOURCE
                      + " yellow.candidate.job=" + JOB
                      + " yellow.candidate.source=" + CANDIDATE_SOURCE
                      + " yellow.candidate.nonce=${CANDIDATE_NONCE}"
                      + " yellow.candidate.method=identity-only-repackage\n")
        (context / "Dockerfile").write_text(dockerfile, encoding="utf-8")
        os.chmod(context / "Dockerfile", 0o600)
        stage = "metadata-only-repackage"
        build_log = PRIVATE / "build-output.log"
        with build_log.open("xb") as log_stream:
            os.chmod(build_log, 0o600)
            run(DOCKER + ["build", "--network=none", "--pull=false", "--no-cache", "--progress=plain",
                          "--file", "Dockerfile", "--build-arg", "CANDIDATE_NONCE=" + nonce,
                          "--tag", APP_TAG, str(context)], cap=150, stdout_file=log_stream)
        os.chmod(PRIVATE / "build-output.log", 0o600)
        candidate = image_inspect(APP_TAG)
        image_id = candidate.get("id")
        require(isinstance(image_id, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", image_id)
                and candidate.get("revision") == CANDIDATE_SOURCE
                and candidate.get("base_revision") == BASE_SOURCE
                and candidate.get("candidate_job") == JOB and candidate.get("candidate_source") == CANDIDATE_SOURCE
                and candidate.get("candidate_method") == "identity-only-repackage"
                and candidate.get("candidate_nonce") == nonce
                and candidate.get("os") == "linux" and candidate.get("architecture") == "amd64"
                and candidate.get("user") == "bun" and candidate.get("command") == ["bun", "run", "start"]
                and candidate.get("diff_ids") == BASE_DIFF_IDS,
                "candidate repackage changed source identity or rootfs")
        stage = "export-archive"
        archive = PRIVATE / "candidate-image.tar"
        with archive.open("xb"):
            pass
        os.chmod(archive, 0o600)
        run(DOCKER + ["save", "--output", str(archive), image_id], cap=150)
        require(archive.is_file() and not archive.is_symlink() and archive.stat().st_size > 0,
                "candidate Docker-save archive missing")
        diff_args = [arg for value in BASE_DIFF_IDS for arg in ("--expected-diff-id", value)]
        stage = "convert-verified-archive"
        layout = PRIVATE / "oci-layout"
        converted = run([sys.executable, str(CONVERTER), "--input", str(archive), "--output", str(layout),
                         "--expected-config-id", image_id, *diff_args], cap=150)
        conversion = json.loads(converted)
        stage = "independent-export-proof"
        verifier = json.loads(run([sys.executable, str(ROOT / "verify_candidate_oci.py"),
                                   "--layout", str(layout), "--expected-image-id", image_id,
                                   *diff_args], cap=60))
        require(verifier.get("passed") is True and verifier.get("config_env_inspected") is False
                and verifier.get("config_bytes_interpreted") is False
                and verifier.get("layer_count") == len(BASE_DIFF_IDS),
                "independent candidate OCI proof failed")
        proof = {
            "schema": "yellow-candidate-444-image-export-proof/v1",
            "passed": True,
            "candidate_source_revision": CANDIDATE_SOURCE,
            "candidate_source_tree": CANDIDATE_TREE,
            "product_source_base_revision": BASE_SOURCE,
            "product_source_equivalence_sha256": EQUIVALENCE_SHA256,
            "product_changes_in_runtime_paths": [],
            "tests_only_changes_excluded_from_runtime_image": True,
            "image_method": "FROM verified b9 image with config-only ENV/LABEL instructions; no RUN, source copy, feature edits, or compilation",
            "base_image_id": BASE_IMAGE_ID,
            "candidate_image_id": image_id,
            "candidate_tag": APP_TAG,
            "platform": "linux/amd64",
            "user": "bun",
            "command": ["bun", "run", "start"],
            "candidate_revision_label": CANDIDATE_SOURCE,
            "candidate_build_revision_env_set": CANDIDATE_SOURCE,
            "source_image_rootfs_diff_ids_equal": True,
            "base_rootfs_diff_ids": BASE_DIFF_IDS,
            "candidate_rootfs_diff_ids": candidate["diff_ids"],
            "b9_content_proof_sha256": BASE_PROOF_SHA256,
            "docker_save_sha256": sha_file(archive),
            "docker_save_bytes": archive.stat().st_size,
            "conversion_metadata": conversion,
            "independent_oci_proof": verifier,
            "config_env_inspected": False,
            "runtime_launched": False,
            "registry_published": False,
            "public_route_proven": False,
            "checkout": checkout,
            "build_nonce": nonce,
            "job": JOB,
            "captured_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        tmp = PUBLIC_PROOF.with_name(PUBLIC_PROOF.name + ".tmp")
        with tmp.open("x", encoding="utf-8") as stream:
            os.chmod(tmp, 0o600)
            json.dump(proof, stream, indent=2)
            stream.write("\n")
        os.replace(tmp, PUBLIC_PROOF)
        print(json.dumps({"passed": True, "image_id": image_id,
                          "diff_id_count": len(BASE_DIFF_IDS), "runtime_launched": False}))
        return 0
    except BaseException as error:
        status = {"passed": False, "stage": stage, "error_type": type(error).__name__,
                  "automatic_retry": False, "runtime_launched": False}
        if PRIVATE.exists():
            path = PRIVATE / "failure-status.json"
            if not path.exists():
                with path.open("x", encoding="utf-8") as stream:
                    os.chmod(path, 0o600)
                    json.dump(status, stream)
                    stream.write("\n")
        print(json.dumps({"passed": False, "stage": stage, "error_type": type(error).__name__}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
