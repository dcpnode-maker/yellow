#!/usr/bin/env python3
"""Independent immutable-Git verification; never reads laptop or runtime secrets."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
REPO = Path('/workspace/yellow-release')

def git(*args):
    return subprocess.check_output(['git', '-C', str(REPO), *args])

def main():
    doc = json.loads((ROOT / 'PROTECTED_APP_API_HUNKS.json').read_text())
    ids = doc['source_ids']
    assert git('rev-parse', ids['base_commit'] + '^{tree}').decode().strip() == ids['base_tree']
    assert git('rev-parse', ids['cloud_commit'] + '^{tree}').decode().strip() == ids['cloud_tree']
    checked = []
    for row in doc['files']:
        path = row['path']
        for prefix in ('base', 'cloud'):
            commit = ids[prefix + '_commit']
            entry = git('ls-tree', commit, '--', path).decode().strip()
            mode, kind, oid = entry.split('\t')[0].split()
            assert kind == 'blob' and mode == row[prefix + '_git_mode']
            assert oid == row[prefix + '_git_blob']
            raw = git('cat-file', 'blob', oid)
            assert hashlib.sha256(raw).hexdigest() == row[prefix + '_sha256']
        diff = git('diff', ids['base_commit'], ids['cloud_commit'], '--', path).decode()
        assert diff == row['unified_hunks']
        checked.append(path)
    assert len(checked) == 4 and len(set(checked)) == 4
    assert git('rev-parse', 'HEAD').decode().strip() == ids['cloud_commit']
    assert git('status', '--porcelain=v1') == b''
    result = {'schema': 'yellow-root-hunk-verification/v1', 'source': ids,
              'checked_paths': checked, 'exact_diffs': 4, 'exact_blob_sha256_checks': 8,
              'exact_git_mode_checks': 8, 'laptop_observations': 'unavailable',
              'source_checkout_clean': True, 'passed': True}
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
