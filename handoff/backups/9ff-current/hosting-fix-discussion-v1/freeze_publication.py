#!/usr/bin/env python3
"""Freeze explicitly selected nonsecret handoff files using a private Git index."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).absolute().parent
REPO = Path('/workspace/yellow-release')
SOURCE = '9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'
PARENT = '4b68ea9c9f0bd786f494be3ef96185f7beb06cbc'
BASE = 'ded9d0624a00c9553c8a8833b4523e26e9dec1ce'
PREFIX = 'handoff/backups/9ff-current/hosting-fix-discussion-v1/'

def main():
    owned = ROOT / 'publication-inputs'
    assert not owned.exists()
    owned.mkdir(mode=0o700)
    env = os.environ.copy()
    env['GIT_INDEX_FILE'] = str(owned / 'index')
    def git(*args, data=None):
        r = subprocess.run(['git', '-C', str(REPO), *args], env=env, input=data,
                           capture_output=True, timeout=15)
        if r.returncode:
            raise RuntimeError('private-index Git operation failed')
        return r.stdout
    assert git('rev-parse', 'HEAD').decode().strip() == SOURCE
    # Check the actual worktree/index separately; no source index is written.
    real_env = os.environ.copy()
    actual = subprocess.run(['git', '-C', str(REPO), 'status', '--porcelain=v1', '--untracked-files=all'],
                            env=real_env, capture_output=True, check=True, timeout=15)
    assert actual.stdout == b''
    git('read-tree', BASE)
    selections = {
        'ORDER.md': 'handoff/orders/RELEASE-20261001-hosting-fix-discussion-v1.md',
        'SYNTHETIC_ORIGIN_ORDER.md': 'handoff/orders/RELEASE-20261001-synthetic-origin9ff-v1.md',
        'INDEPENDENT_TRANSPORT_REVIEW.md': 'handoff/reviews/RELEASE-20261001-managed-transport-fix.md',
        'INDEPENDENT_CONFIGURATION_PROPOSAL_REVIEW.md': 'handoff/reviews/RELEASE-20261001-managed-configuration-proposal.md',
        'ROOT_FINAL_ORIGIN_REVIEW.md': 'handoff/reviews/RELEASE-20261001-synthetic-origin9ff-root.md',
        'FINAL_HOSTING_EVIDENCE_REVIEW.md': 'handoff/reviews/RELEASE-20261001-synthetic-origin9ff-evidence.md',
        'run-9ff-origin-20261001/receipt.json': PREFIX + 'SYNTHETIC_ORIGIN_LAUNCH_PROOF.json',
    }
    names = ['LAPTOP_HOSTING_FIX_HANDOFF.md', 'CONFIGURATION_REVIEW_REQUEST.md',
             'MANAGED_CONNECTOR_CONFIGURATION_PROPOSAL.json', 'MANAGED_STATUS_OBSERVATION.json',
             'OFFICIAL_TRANSPORT_DOCUMENTATION.json', 'RETAINED_OFFICIAL_VPC_EVIDENCE.txt',
             'RETAINED_OFFICIAL_EVIDENCE_METADATA.json', 'QUIC_HELP_ONLY_PROOF.json',
             'BUILDER_RECEIPT.md', 'compose.yml', 'run_synthetic_origin.py',
             'test_synthetic_origin_guards.py', 'snapshot_synthetic_database.py',
             'verify_final_origin.py', 'ROOT_SYNTHETIC_GUARD_TESTS.log',
             'ROOT_FINAL_ORIGIN_PROOF.json', 'SYNTHETIC_DATABASE_BEFORE.json',
             'SYNTHETIC_DATABASE_AFTER.json', 'freeze_publication.py']
    selections.update({name: PREFIX + name for name in names})
    base_ledger = git('show', BASE + ':handoff/LEDGER.md')
    assert base_ledger == Path('/workspace/yellow-coordination/release-20261001/receiving-9ff-v2/artifact-ledger-v2.md').read_bytes()
    append = b'''\n\n### RELEASE-20261001 supported transport proposal + isolated9ff origin\n\n- Laptop controller concrete provider/source replies read here: saved OAuth lacks connectivity:admin/VPC list10000; host setup precedes provider reauthorization. Only managed status exposed/current183; no UDP grant/editor/schema/secret binding. UDP is unreported/unconfigured/unproven, not categorically unsupported. One outbound QUIC7844/dedicated token-file intent prepared and independently reviewed; mandatory supported configuration workflow/user review unapplied. No policy/proxy bypass, provider resource, public route, phone-token reuse or paid fallback.\n- Root nonimplementer personally reviewed runner,17/17 negative guards, then actual existing immutable9ff image launch and separate runtime/HTTP verification. New owned CIDd002232dfdb8ba671ca51fc53ae8657ea72cc361740acd61c91b49e8f5bdca59, only loopback53009,1CPU/1GiB,userbun,restartno,workers0. Old937912 exactCID/image/revision/running unchanged; source9ff clean. Health/ready/UI/asset200, anonymous properties401,sensitivepaths404; no successfullogin/staffcommand/publicURL/latest101-103/fullworker/visual/resilienceclaim.\n- Read-only retained synthetic yellow_dev PG18 before/after fingerprints exactly equal:100immutable filename/hash ledger,130table counts/digests, complete schema digest (onlyrandompg_dump18restrict tokens normalized). No migration/seed/newDB/businesswrites/oldworkerpause/rawrows. Diagnostic token/privatecommandslog excluded; VM-localvolume/token not deletion recovery. Safe orders/code/proofs and concrete host dependency published on artifact branch only; laptop remains controller/integrator, emergencycredits forbidden/global1%pause unchanged.\n'''
    ledger_path = owned / 'artifact-ledger.md'
    ledger_path.write_bytes(base_ledger + append)
    selections['publication-inputs/artifact-ledger.md'] = 'handoff/LEDGER.md'
    records = []
    forbidden = [rb'gh[pousr]_[A-Za-z0-9]{24,}', rb'github_pat_[A-Za-z0-9_]{30,}',
                 rb'sk-[A-Za-z0-9]{24,}', rb'-----BEGIN [A-Z ]*PRIVATE KEY-----',
                 rb'AKIA[0-9A-Z]{16}', rb'(?i)(?:postgres(?:ql)?|https?)://[^\s/:]+:[^\s/@]+@']
    for local, destination in selections.items():
        path = ROOT / local
        assert not path.is_symlink() and path.is_file()
        assert local not in ('run-9ff-origin-20261001/token.env', 'run-9ff-origin-20261001/commands.log')
        data = path.read_bytes()
        # The published Compose contains literal required interpolation, never a value.
        scanned = data.replace(b'postgres://yellow_runtime:${YELLOW_RUNTIME_DATABASE_PASSWORD:?required}@', b'postgres://<required-runtime-binding>@')
        scanned = scanned.replace(b'postgres://yellow_extension_registrar:${YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD:?required}@', b'postgres://<required-registrar-binding>@')
        assert not any(re.search(pattern, scanned) for pattern in forbidden), 'publication credential-pattern guard failed'
        oid = git('hash-object', '-w', '--stdin', data=data).decode().strip()
        git('update-index', '--add', '--cacheinfo', '100644', oid, destination)
        records.append({'path': destination, 'local': str(path), 'mode': '100644',
                        'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'git_blob': oid})
    manifest = {'schema': 'yellow-hosting-fix-artifact-manifest/v1', 'source_revision': SOURCE,
                'parent_artifact_revision': PARENT, 'base_tree': BASE, 'artifact_only': True,
                'files': [{k: v for k, v in r.items() if k != 'local'} for r in records],
                'excluded': ['token.env and authority credentials', 'private command log',
                             'OCI image binaries/config', 'business data', 'laptop dirty source'],
                'no_public_app_url': True}
    manifest_path = owned / 'ARTIFACT_MANIFEST.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    data = manifest_path.read_bytes()
    oid = git('hash-object', '-w', '--stdin', data=data).decode().strip()
    manifest_dest = PREFIX + 'ARTIFACT_MANIFEST.json'
    git('update-index', '--add', '--cacheinfo', '100644', oid, manifest_dest)
    records.append({'path': manifest_dest, 'local': str(manifest_path), 'mode': '100644',
                    'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'git_blob': oid})
    tree = git('write-tree').decode().strip()
    changed = git('diff', '--name-only', BASE, tree).decode().splitlines()
    assert sorted(changed) == sorted(r['path'] for r in records)
    assert all(p.startswith(('handoff/orders/', 'handoff/reviews/', PREFIX)) or p == 'handoff/LEDGER.md' for p in changed)
    result = {'source': SOURCE, 'parent': PARENT, 'baseTree': BASE, 'tree': tree,
              'branch': 'phase-7/source-checkpoint-9ff27ad-20261001', 'files': records}
    (owned / 'publication-freeze.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'tree': tree, 'files': len(records), 'total_bytes': sum(r['bytes'] for r in records)}))

if __name__ == '__main__':
    main()
