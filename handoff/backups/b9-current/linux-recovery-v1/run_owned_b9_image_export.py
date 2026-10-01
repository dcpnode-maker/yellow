#!/usr/bin/env python3
"""One bounded read-only Docker save + offline conversion of the reviewed image."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parent
JOB = ROOT / 'private-oci-export-b9-v1'
IMAGE = 'sha256:1e522a8ab84af27ddc57d4aef3e7f6a383d254be15225a8c9df1722df87d7bc9'
REV = 'b9ba702a074a487feeafa056abb49abcdcf01ba8'
DOCKER = ['docker', '--host', 'unix:///var/run/docker.sock']
EXPECTED_DIFFIDS = ['sha256:0854555d70acaa318b38ee50bc667cb51ff6bf0757624624c7ff3b6fe17459a0', 'sha256:9072d322eb16c6a414861801ae295eb67839e0aeabeab982bea0520b6fccdeaa', 'sha256:135be4fad03ab91972ef4eb6846e200938c2dea183881ba5cac3d79648a09737', 'sha256:7a415decbb54be30a9369d7466887b96544eedd7b28dbb7ad87dc6381a4b91a0', 'sha256:fb0c09554b3fc2d49fda0df4305e80bbd89a17e405ed02b65b79c54fcf6fd637', 'sha256:592e878c2cd79244e9ecf582b4688c9fa9c45bb31b1890119e1fb88fae6a6784', 'sha256:e51fbaa4439c4e38781cc712ef035b33f5c6f5e3d4dd4d1377552689102b3d84', 'sha256:06fca1b110f6a67625050001ccdee537dbe49390d99e394a9899f3c481b97b11', 'sha256:2cfbf35b5f39e58c0e271f4e4211192b643e614daf9ed30829ad66c8d210397f', 'sha256:c768036e3683227bc2dbbda3c2886a372eeff193f0186ba9d0ed677bbaab4068', 'sha256:64022fcc6881f35e088f90d624fbff2525318464faaac9b8f5a730509d6e9805']

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def save_json(name, value):
    tmp = JOB / (name + '.pending')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    tmp.replace(JOB / name)

def file_sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    # Refuse a second attempt or ancestor symlink; no cleanup/retry of old inputs.
    for parent in [ROOT, *ROOT.parents]:
        if parent.is_symlink():
            raise RuntimeError('symlink ancestor is not a task-owned export directory')
    if shutil.disk_usage(ROOT).free < 1024 * 1024 * 1024:
        raise RuntimeError('insufficient workspace for bounded export')
    JOB.mkdir(mode=0o700, exist_ok=False)
    env = os.environ.copy()
    for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
        env.pop(key, None)
    # Managed proxy, trust, Docker config, HOME and credentials remain inherited.
    state = {'job': 'HOSTING-20261001-offline-oci-b9-v1', 'started_utc': utc(),
             'source_revision': REV, 'selected_image_id': IMAGE, 'phase': 'preflight',
             'attempt': 1, 'automatic_retry': False, 'max_seconds': 300,
             'container_launch': False, 'database_mutation': False, 'public_route': False}
    deadline = time.monotonic() + 300
    proc = None

    def stop_owned():
        if proc is not None and proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait(timeout=3)

    def interrupted(signum, _frame):
        stop_owned()
        raise RuntimeError('owned export interrupted; checkpoint preserved')

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)

    def run(args, phase, out_path):
        nonlocal proc
        state['phase'] = phase
        save_json('status.json', state)
        with out_path.open('xb') as out, (JOB / (phase + '.stderr')).open('xb') as err:
            proc = subprocess.Popen(args, env=env, stdout=out, stderr=err, start_new_session=True)
            state['owned_pid'] = proc.pid
            save_json('status.json', state)
            while proc.poll() is None:
                if time.monotonic() >= deadline:
                    stop_owned()
                    raise TimeoutError('single export job exceeded 300 seconds')
                time.sleep(0.2)
            code = proc.returncode
            state['last_exit_code'] = code
            if code != 0:
                raise RuntimeError(phase + ' failed; private diagnostics preserved')

    try:
        # Only selected public build metadata; never inspect Config.Env.
        template = ('{"Id":{{json .Id}},"RepoDigests":{{json .RepoDigests}},'
                    '"DiffIDs":{{json .RootFS.Layers}},"Size":{{json .Size}},'
                    '"Os":{{json .Os}},"Architecture":{{json .Architecture}},'
                    '"User":{{json .Config.User}},"Revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}}}')
        run(DOCKER + ['image', 'inspect', IMAGE, '--format', template], 'selected-inspection', JOB / 'selected-image.json')
        selected = json.loads((JOB / 'selected-image.json').read_text())
        if selected['Id'] != IMAGE or selected['DiffIDs'] != EXPECTED_DIFFIDS or selected['Revision'] != REV:
            raise RuntimeError('selected immutable image/source identity mismatch')
        if selected['Os'] != 'linux' or selected['Architecture'] != 'amd64' or selected['User'] != 'bun':
            raise RuntimeError('selected launch platform/user mismatch')
        run(DOCKER + ['image', 'save', IMAGE], 'docker-save', JOB / 'docker-save.tar')
        save_args = ['python3', str(ROOT / 'docker_save_to_oci.py'), '--input', str(JOB / 'docker-save.tar'),
                     '--output', str(JOB / 'oci-layout'), '--expected-config-id', IMAGE]
        for diff in EXPECTED_DIFFIDS:
            save_args.extend(['--expected-diff-id', diff])
        run(save_args, 'offline-conversion', JOB / 'conversion-result.json')
        state.update({'phase': 'completed', 'finished_utc': utc(), 'passed': True,
                      'archive_bytes': (JOB / 'docker-save.tar').stat().st_size,
                      'archive_sha256': file_sha(JOB / 'docker-save.tar'),
                      'conversion_result': json.loads((JOB / 'conversion-result.json').read_text()),
                      'independent_verification': 'pending'})
    except BaseException as exc:
        stop_owned()
        state.update({'phase': 'stopped', 'finished_utc': utc(), 'passed': False,
                      'error_type': type(exc).__name__, 'error': str(exc)})
        save_json('status.json', state)
        print(json.dumps(state))
        raise
    save_json('status.json', state)
    print(json.dumps(state))

if __name__ == '__main__':
    main()
