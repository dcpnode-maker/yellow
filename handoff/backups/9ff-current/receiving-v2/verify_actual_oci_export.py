#!/usr/bin/env python3
"""Independent streaming OCI content proof; config stays opaque."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JOB = ROOT / 'private-oci-export-9ff-v1'
REV = '9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'
IMAGE = 'sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0'

def stream_hash(stream):
    h = hashlib.sha256()
    count = 0
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        count += len(block)
        assert count <= 2 * 1024 * 1024 * 1024
        h.update(block)
    return 'sha256:' + h.hexdigest(), count

def main():
    selected = json.loads((JOB / 'selected-image.json').read_text())
    assert selected['Id'] == IMAGE and selected['Revision'] == REV
    layout = JOB / 'oci-layout'
    assert json.loads((layout / 'oci-layout').read_text()) == {'imageLayoutVersion': '1.0.0'}
    index_raw = (layout / 'index.json').read_bytes()
    index = json.loads(index_raw)
    assert index['schemaVersion'] == 2 and len(index['manifests']) == 1
    descriptor = index['manifests'][0]
    assert descriptor['annotations']['org.opencontainers.image.revision'] == REV
    assert descriptor['mediaType'] == 'application/vnd.oci.image.manifest.v1+json'

    def verify_blob(desc):
        digest = desc['digest']
        assert len(digest) == 71 and digest.startswith('sha256:')
        assert all(c in '0123456789abcdef' for c in digest[7:])
        p = layout / 'blobs' / 'sha256' / digest[7:]
        assert p.is_file() and not p.is_symlink()
        with p.open('rb') as f:
            actual, size = stream_hash(f)
        assert digest == actual and type(desc['size']) is int and size == desc['size']
        return p

    manifest_path = verify_blob(descriptor)
    manifest = json.loads(manifest_path.read_text())
    assert manifest['schemaVersion'] == 2 and manifest['mediaType'] == descriptor['mediaType']
    config = manifest['config']
    assert config['mediaType'] == 'application/vnd.oci.image.config.v1+json'
    assert config['digest'] == IMAGE
    verify_blob(config)  # Exact opaque config bytes; no config/Env deserialization.
    layers = manifest['layers']
    assert len(layers) == len(selected['DiffIDs']) == 11
    proof = []
    for layer, diff in zip(layers, selected['DiffIDs']):
        assert layer['mediaType'] == 'application/vnd.oci.image.layer.v1.tar+gzip'
        path = verify_blob(layer)
        with gzip.open(path, 'rb') as stream:
            actual, size = stream_hash(stream)
        assert actual == diff
        proof.append({'compressed_digest': layer['digest'], 'compressed_bytes': layer['size'],
                      'uncompressed_diff_id': diff, 'uncompressed_bytes': size})
    expected = {descriptor['digest'][7:], config['digest'][7:], *[l['digest'][7:] for l in layers]}
    assert {p.name for p in (layout / 'blobs' / 'sha256').iterdir()} == expected
    result = json.loads((JOB / 'conversion-result.json').read_text())
    assert result['manifestDigest'] == descriptor['digest'] and result['configDigest'] == IMAGE
    assert result['sourceRevision'] == REV and result['layerCount'] == 11
    archive = JOB / 'docker-save.tar'
    with archive.open('rb') as f:
        archive_digest, archive_size = stream_hash(f)
    out = {'schema': 'yellow-independent-oci-content-proof/v1', 'source_revision': REV,
           'source_tree': '4311a79c0c9ffc33877809162b1b38ae1b3c944a',
           'config_digest': IMAGE, 'oci_export_manifest_digest': descriptor['digest'],
           'index_sha256': hashlib.sha256(index_raw).hexdigest(), 'manifest_bytes': descriptor['size'],
           'source_format': result['sourceFormat'], 'layers': proof,
           'docker_save_archive_digest': archive_digest, 'docker_save_archive_bytes': archive_size,
           'registry_digest': None, 'registry_published': False, 'image_launched': False,
           'public_url_verified': False, 'laptop_binary_backup_verified': False,
           'opaque_config_verified': True, 'passed': True}
    print(json.dumps(out, indent=2))

if __name__ == '__main__':
    main()
