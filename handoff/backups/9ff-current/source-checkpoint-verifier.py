#!/usr/bin/env python3
"""Nonbuilder verification of immutable source backup; no source/index/ref edits."""
import datetime, hashlib, json, os, pathlib, re, subprocess, tempfile, tomllib, zipfile

ROOT = pathlib.Path('/workspace/yellow-coordination/release-20261001')
INPUT = ROOT / 'backup-9ff-artifact-inputs'
REPO = pathlib.Path('/workspace/yellow-release')
TARGET = '9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'
TREE = '4311a79c0c9ffc33877809162b1b38ae1b3c944a'
BASE = 'e06e400a57485cc10a8a35c21dcb1e01b5a667d1'
PREVIOUS = '58cd09ad13987bafb6068ab72a753746a555bfa5'
MCP = '.codex/config.toml'
OLD_MCP = '848a36d37a4ab0a682e02f3a84acd71cd72d0e5a'
NEW_MCP = '3931820c721b60f7a5c3eb8d4423ec5f1e9717fd'
ARCHIVE_SHA = '642e11aa69f107252da14796710a8b58733792b2deb213c019ce991764ac49f0'
ALLOWLIST = {
    'MANIFEST.json', 'SOURCE-CHECKPOINT-STATUS.txt', 'source-path-manifest.json',
    'handoff/CLOUD_TO_LAPTOP_HANDOFF_9ff27ad.json', 'handoff/HK_SETTINGS_GAP_READ_9ff27ad.json',
    'handoff/LAPTOP_STEERING_20261001_SETTINGS_HK.json', 'handoff/LATEST_TEST_RELEASE_REQUIREMENT.json',
    'handoff/RELEASE-20261001-source-backup-9ff.md', 'mcp-template/NEW_CONFIG.toml',
    'mcp-template/PREIMAGE_GUARD.txt', 'patches/01-protected-wiring.patch',
    'patches/02-append-only-governance.patch', 'patches/03-generated-public-assets.patch',
    'patches/04-modules-tests-config.patch', 'patches/LATEST-EIGHT-METADATA.json',
    'patches/latest-eight-path-bundle.patch', 'proofs/boundaries.json', 'proofs/canonical.json',
    'proofs/focused.json', 'proofs/initial-type-red.json', 'proofs/official-ci-pending-snapshot.json',
    'proofs/source-equivalence.json', 'proofs/source-freeze.json', 'proofs/standing.json', 'proofs/static.json',
}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def git(*args, env=None, data=None):
    return subprocess.run(['git', *args], cwd=REPO, env=env, input=data,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout

def main():
    index = pathlib.Path(git('rev-parse', '--git-path', 'index').decode().strip())
    if not index.is_absolute():
        index = REPO / index
    before = {'head': git('rev-parse', 'HEAD'), 'status': git('status', '--porcelain=v1'),
              'indexSha256': sha(index.read_bytes()), 'refs': git('show-ref')}
    assert before['head'].decode().strip() == TARGET and before['status'] == b''
    assert git('rev-parse', TARGET+'^{tree}').decode().strip() == TREE
    archive = INPUT / 'source-checkpoint-9ff27ad-20261001.zip'
    assert sha(archive.read_bytes()) == ARCHIVE_SHA
    with zipfile.ZipFile(archive) as z:
        assert len(z.namelist()) == 25 and set(z.namelist()) == ALLOWLIST
        assert len(z.namelist()) == len(set(z.namelist())) and z.testzip() is None
        files = {name: z.read(name) for name in z.namelist()}
    manifest = json.loads(files['MANIFEST.json'])
    assert manifest['target'] == TARGET and manifest['targetTree'] == TREE
    assert set(manifest['members']) == ALLOWLIST - {'MANIFEST.json'}
    for path, entry in manifest['members'].items():
        assert entry == {'bytes': len(files[path]), 'sha256': sha(files[path])}, path
    patterns = [
        rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
        rb'postgres(?:ql)?://[^/@:\s]+:[^/@\s]+@', rb'\bAKIA[0-9A-Z]{16}\b',
        rb'\bgh[pousr]_[A-Za-z0-9]{30,}\b',
    ]
    for path, data in files.items():
        assert all(re.search(pattern, data, re.I) is None for pattern in patterns), path
    paths = json.loads(files['source-path-manifest.json'])
    changed = set(git('diff', '--name-only', '--no-renames', BASE, TARGET).decode().splitlines())
    assert len(changed) == 145 and changed == {row['path'] for row in paths['paths']}
    latest = set(git('diff', '--name-only', '--no-renames', PREVIOUS, TARGET).decode().splitlines())
    assert len(latest) == 8 and latest == {row['path'] for row in paths['latestDeltaPaths']}
    groups = paths['groups']
    grouped = [p for group in groups.values() for p in group]
    assert len(grouped) == len(set(grouped)) == 144 and set(grouped) == changed - {MCP}
    for row in paths['paths']:
        for ref, side in [(BASE, 'old'), (TARGET, 'new')]:
            raw = git('ls-tree', ref, '--', row['path']).decode().strip()
            if not raw:
                assert row[side] is None
                continue
            mode, typ, oid = raw.split('\t')[0].split()
            entry = row[side]
            assert (entry['mode'], entry['type'], entry['oid']) == (mode, typ, oid)
            if row['path'] == MCP:
                assert entry['mcpContentRead'] is False
            else:
                data = git('cat-file', 'blob', oid)
                assert entry['bytes'] == len(data) and entry['sha256'] == sha(data)
    # Never read the old MCP blob. Only its immutable identifier is inspected.
    assert git('rev-parse', BASE+':'+MCP).decode().strip() == OLD_MCP
    assert git('rev-parse', TARGET+':'+MCP).decode().strip() == NEW_MCP
    template = files['mcp-template/NEW_CONFIG.toml']
    assert tomllib.loads(template.decode()) == {'mcp_servers': {}}
    assert git('hash-object', '--stdin', data=template).decode().strip() == NEW_MCP
    assert OLD_MCP.encode() in files['mcp-template/PREIMAGE_GUARD.txt']
    for name, group in groups.items():
        expected = git('diff', '--binary', '--full-index', '--no-ext-diff', '--no-renames', BASE, TARGET, '--', *sorted(group))
        assert files['patches/'+name] == expected
        assert b'diff --git a/.codex/config.toml b/.codex/config.toml' not in expected
    expected_latest = git('diff', '--binary', '--full-index', '--no-ext-diff', '--no-renames', PREVIOUS, TARGET, '--', *sorted(latest))
    assert files['patches/latest-eight-path-bundle.patch'] == expected_latest
    reconstructions = {}
    with tempfile.TemporaryDirectory(prefix='yellow-root-9ff-backup-review-') as td:
        for label, ref, patches in [
            ('full', BASE, ['patches/'+n for n in groups]),
            ('latest', PREVIOUS, ['patches/latest-eight-path-bundle.patch']),
        ]:
            env = dict(os.environ, GIT_INDEX_FILE=str(pathlib.Path(td)/(label+'.index')))
            git('read-tree', ref, env=env)
            if label == 'full':
                assert OLD_MCP.encode() in git('ls-files', '--stage', '--', MCP, env=env)
            for patch in patches:
                git('apply', '--cached', '--check', '--binary', '-', env=env, data=files[patch])
                git('apply', '--cached', '--binary', '-', env=env, data=files[patch])
            git('update-index', '--add', '--cacheinfo', '100644,'+NEW_MCP+','+MCP, env=env)
            reconstructions[label] = git('write-tree', env=env).decode().strip()
            assert reconstructions[label] == TREE
    assert json.loads(files['proofs/canonical.json'])['canonical11of11'] is True
    assert b'pending' in files['SOURCE-CHECKPOINT-STATUS.txt']
    final_ci = json.loads((ROOT/'ci-36842043047/final-required-ci-verification.json').read_text())
    assert final_ci['source'] == TARGET and final_ci['allSixRequiredGatesSucceeded'] is True
    assert len(final_ci['jobs']) == 6 and all(j['conclusion'] == 'success' for j in final_ci['jobs'])
    assert {'head': git('rev-parse', 'HEAD'), 'status': git('status', '--porcelain=v1'),
            'indexSha256': sha(index.read_bytes()), 'refs': git('show-ref')} == before
    receipt = {
        'schema': 'yellow-source-checkpoint-independent-validation/v1',
        'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'reviewer': 'Root nonbuilder personally executed verification',
        'artifactSha256': ARCHIVE_SHA, 'archiveBytes': archive.stat().st_size,
        'zipExactMembersAndCrc': True, 'memberCount': 25, 'allManifestDigestsMatch': True,
        'publicCredentialPatternScan': 'passed four explicit patterns; not a comprehensive security scan',
        'exactPathSets': {'full': 145, 'latest': 8}, 'privateIndexReconstructions': reconstructions,
        'allNonMcpSourceBlobMetadataAndHashesMatchGit': True,
        'guardedEmptyMcpReplacement': True, 'oldMcpContentsRead': False,
        'datedPendingCiSnapshotPreserved': True, 'currentCiAllSixGreen': True,
        'sourceHeadIndexWorktreeRefsUnchanged': True,
        'artifactPublicationApproved': True, 'releaseMerged': False, 'laptopIntegrated': False,
        'deployed': False, 'publicationStatus': 'ready for artifact-only branch publication',
    }
    (INPUT/'independent-validation.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt))

if __name__ == '__main__':
    main()
