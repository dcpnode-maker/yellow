#!/usr/bin/env python3
"""Single-use Linux build of reviewed source with separately pinned fresh UI output."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

ROOT = Path(__file__).absolute().parent
REPO = Path('/workspace/yellow-receiving-b9')
SOURCE = 'b9ba702a074a487feeafa056abb49abcdcf01ba8'
TREE = '9446a6735d712ccfd30c6957ea511fb0e3b644cf'
JOB = ROOT / 'private-image-build-v2'
DOCKER = ['docker', '--host', 'unix:///var/run/docker.sock']
CURRENT = None

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    global CURRENT
    assert not JOB.exists() and not ROOT.is_symlink()
    env = os.environ.copy()
    for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
        env.pop(key, None)
    def git(*args):
        return subprocess.check_output(['git', '-C', str(REPO), *args], timeout=15)
    assert git('rev-parse', 'HEAD').decode().strip() == SOURCE
    assert git('rev-parse', 'HEAD^{tree}').decode().strip() == TREE
    assert git('status', '--porcelain=v1', '--untracked-files=all') == b''
    assert shutil.disk_usage(ROOT).free >= 2 * 1024**3
    cert = os.environ.get('CODEX_PROXY_CERT')
    assert cert and Path(cert).is_file()
    JOB.mkdir(mode=0o700)
    context = JOB / 'context'
    context.mkdir(mode=0o700)
    inputs = []
    prefix = ('src/', 'scripts/', 'migrations/')
    for entry in git('ls-tree', '-rz', SOURCE).split(b'\0'):
        if not entry:
            continue
        meta, name_raw = entry.split(b'\t', 1)
        name = name_raw.decode()
        if name not in ('Dockerfile', '.dockerignore', 'package.json', 'bun.lock') and not name.startswith(prefix):
            continue
        mode, kind, oid = meta.decode().split()
        assert mode in ('100644', '100755') and kind == 'blob'
        path = context / name
        assert not Path(name).is_absolute() and '..' not in Path(name).parts
        data = git('cat-file', 'blob', oid)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        path.chmod(0o755 if mode == '100755' else 0o644)
        inputs.append({'path': name, 'git_blob': oid, 'sha256': sha(data), 'bytes': len(data), 'kind': 'exact source'})
    ui = ROOT / 'frontend-build'
    assert (ui / 'index.html').is_file()
    for path in sorted(ui.rglob('*')):
        if not path.is_file():
            continue
        assert not path.is_symlink() and path.suffix != '.map'
        name = 'public/yellow-next/' + path.relative_to(ui).as_posix()
        data = path.read_bytes()
        target = context / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        inputs.append({'path': name, 'sha256': sha(data), 'bytes': len(data), 'kind': 'fresh Linux Vite output from exact source'})
    original = (context / 'Dockerfile').read_bytes()
    old = b'RUN bun install --frozen-lockfile --production'
    new = b'\n'.join([b'RUN --mount=type=secret,id=proxy_ca,required=true ' + bytes([92]),
                      b'    NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca ' + bytes([92]),
                      b'    bun install --frozen-lockfile --production'])
    assert original.count(old) == 1
    adapter = original.replace(old, new)
    assert adapter.replace(new, old) == original
    (context / 'Dockerfile.managed').write_bytes(adapter)
    manifest = {'source': SOURCE, 'tree': TREE, 'files': inputs,
                'adapter_sha256': sha(adapter), 'adapter_change': 'only inherited managed proxy CA secret for Bun dependency install',
                'fresh_ui_replaces_tracked_prior_bundle_only_in_private_build_context': True,
                'source_worktree_modified': False, 'credentials_in_context': False}
    assert not any(line.startswith(b'+') for line in adapter.splitlines())
    (ROOT / 'BUILD_INPUT_MANIFEST_V2.json').write_text(json.dumps(manifest, indent=2) + '\n')
    results = []
    for target in ('runtime', 'database-tools'):
        tag = 'yellow-receiving-' + target + ':' + SOURCE
        check = subprocess.run(DOCKER + ['image', 'inspect', '--format', '{{.Id}}', tag], env=env,
                               capture_output=True, timeout=15)
        assert check.returncode != 0, 'owned build tag already exists'
        status = {'job': 'RELEASE-20261001-receiving-b9-linux-' + target, 'source': SOURCE,
                  'target': target, 'tag': tag, 'started_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'timeout_seconds': 300, 'automatic_retry': False, 'public_route': False}
        status_path = ROOT / (target + '-image-status-v2.json')
        status_path.write_text(json.dumps(status, indent=2) + '\n')
        cmd = DOCKER + ['build', '--progress=plain', '--target', target, '--build-arg', 'YELLOW_BUILD_SHA=' + SOURCE,
                        '--secret', 'id=proxy_ca,src=' + cert, '--tag', tag, '--file', 'Dockerfile.managed', '.']
        with (JOB / (target + '-build.log')).open('xb') as log:
            CURRENT = subprocess.Popen(cmd, cwd=context, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            status['owned_cli_pid'] = CURRENT.pid
            status_path.write_text(json.dumps(status, indent=2) + '\n')
            try:
                code = CURRENT.wait(timeout=300)
            except BaseException:
                stop_owned()
                status.update({'passed': False, 'checkpointed': True, 'automatic_resume': False})
                status_path.write_text(json.dumps(status, indent=2) + '\n')
                raise
        status['exit_code'] = code
        status['passed'] = code == 0
        status_path.write_text(json.dumps(status, indent=2) + '\n')
        assert code == 0, 'managed image build failed; private log retained'
        template = ('{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},'
                    '"user":{{json .Config.User}},"command":{{json .Config.Cmd}},'
                    '"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}},'
                    '"diff_ids":{{json .RootFS.Layers}},"repo_digests":{{json .RepoDigests}}}')
        inspection = json.loads(subprocess.check_output(DOCKER + ['image', 'inspect', '--format', template, tag],
                                                       env=env, timeout=20))
        assert inspection['revision'] == SOURCE and inspection['user'] == 'bun'
        assert inspection['os'] == 'linux' and inspection['architecture'] == 'amd64'
        assert inspection['command'] == ['bun', 'run', 'start' if target == 'runtime' else 'db:migrate']
        status.update({'image': inspection, 'finished_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
        status_path.write_text(json.dumps(status, indent=2) + '\n')
        results.append(status)
    (ROOT / 'LINUX_IMAGE_BUILD_PROOF.json').write_text(json.dumps({'passed': True, 'source': SOURCE, 'tree': TREE,
         'build_input_manifest_sha256': sha((ROOT / 'BUILD_INPUT_MANIFEST_V2.json').read_bytes()), 'images': results}, indent=2) + '\n')
    print(json.dumps({'passed': True, 'images': [{'target': r['target'], 'id': r['image']['id']} for r in results]}))

def stop_owned():
    if CURRENT is not None and CURRENT.poll() is None:
        os.killpg(CURRENT.pid, signal.SIGTERM)
        try:
            CURRENT.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(CURRENT.pid, signal.SIGKILL)
            CURRENT.wait(timeout=5)

def interrupted(_sig, _frame):
    stop_owned()
    raise InterruptedError('owned build stopped; checkpoints retained')

if __name__ == '__main__':
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        main()
    except BaseException as error:
        stop_owned()
        print(json.dumps({'passed': False, 'error_type': type(error).__name__, 'private_logs_retained': True}))
        raise SystemExit(1)
