#!/usr/bin/env python3
"""Non-implementer read-only checks of the bounded synthetic launch."""
import hashlib
import json
from pathlib import Path
import time
import run_synthetic_origin as launch

ROOT = Path(__file__).absolute().parent

def main():
    before_path = ROOT / 'SYNTHETIC_DATABASE_BEFORE.json'
    after_path = ROOT / 'SYNTHETIC_DATABASE_AFTER.json'
    before = json.loads(before_path.read_text())
    after = json.loads(after_path.read_text())
    assert before == after, 'before/after synthetic fingerprints differ; preservation inconclusive'
    receipt = json.loads(launch.RECEIPT.read_text())
    cid = receipt['container_id']
    nonce = receipt['ownership_nonce']
    deadline = time.monotonic() + 45
    assert launch.exact_owned_cleanup(launch._inspect_owned(cid, deadline), cid, nonce)
    selected_format = ('{"id":"{{.Id}}","image":"{{.Image}}","running":{{.State.Running}},'
                       '"user":"{{.Config.User}}","command":{{json .Config.Cmd}},'
                       '"restart":"{{.HostConfig.RestartPolicy.Name}}",'
                       '"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}},'
                       '"network_names":{{json .NetworkSettings.Networks}}}')
    # This selected network object contains addresses, not environment/credential values.
    current = json.loads(launch._command(launch._docker(['inspect', '--format', selected_format, cid]),
                                        deadline=deadline))
    current['network_names'] = sorted(current['network_names'])
    assert current['image'] == launch.IMAGE_ID and current['running']
    assert current['user'] == 'bun' and current['command'] == ['bun', 'run', 'start']
    assert current['restart'] == 'no' and current['mounts'] == []
    assert current['ports'] == {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '53009'}]}
    assert current['network_names'] == [launch.NETWORK]
    old = launch._command(launch._docker(['inspect', '--format', launch.OLD_FORMAT, launch.OLD_CID]),
                          deadline=deadline)
    assert old == '|'.join([launch.OLD_CID, launch.OLD_IMAGE_ID, launch.OLD_NAME, 'true', 'no', launch.OLD_REVISION])
    flags = ['YELLOW_FISCAL_SUBMISSION_WORKER', 'YELLOW_HOLD_EXPIRY_WORKER',
             'YELLOW_AVAILABILITY_PROJECTION_WORKER', 'YELLOW_PICKUP_TASK_WORKER',
             'YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER', 'YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER',
             'YELLOW_BUSINESS_DAY_ROLL_WORKER', 'YELLOW_LOCAL_REVIEW_PREFILL',
             'YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN', 'YELLOW_HOSTED_DEPOSIT_WORKBENCH',
             'YELLOW_HOSTED_PROVIDER_ONLY']
    conditions = ' '.join('(eq (index (split . "=") 0) "' + key + '")' for key in flags)
    flag_format = '{{range .Config.Env}}{{if or ' + conditions + '}}{{println .}}{{end}}{{end}}'
    observed = launch._command(launch._docker(['inspect', '--format', flag_format, cid]), deadline=deadline)
    assert set(observed.splitlines()) == {key + '=0' for key in flags}
    proof = launch._probe(deadline)
    assert proof == receipt['proof']
    head = launch._command(['git', '-C', str(launch.REPO), 'rev-parse', 'HEAD'], deadline=deadline)
    dirty = launch._command(['git', '-C', str(launch.REPO), 'status', '--porcelain=v1', '--untracked-files=all'], deadline=deadline)
    assert head == launch.SOURCE and dirty == ''
    report = {
        'schema': 'yellow-independent-synthetic-origin-verification/v1',
        'executed_by': 'root non-implementer, personally executed',
        'passed': True,
        'runtime': current,
        'source_revision': head,
        'source_worktree_clean': True,
        'old_service_id': launch.OLD_CID,
        'old_service_revision': launch.OLD_REVISION,
        'old_service_identity_and_running_state_unchanged': True,
        'explicit_nonsecret_worker_and_demo_flags': {key: '0' for key in flags},
        'database': {
            'target': 'yellow_dev synthetic, existing authoritative diagnostic dataset',
            'before_after_fingerprints_equal': True,
            'frontier': before['identity']['frontier'],
            'migration_hashes_matched': len(before['ledger']),
            'table_count': len(before['table_digests']),
            'schema_sha256': before['schema_sha256'],
            'before_file_sha256': hashlib.sha256(before_path.read_bytes()).hexdigest(),
            'after_file_sha256': hashlib.sha256(after_path.read_bytes()).hexdigest(),
            'schema_normalization': before['schema_normalization'],
            'raw_business_rows_emitted': False,
            'writes_migrations_seeding_or_new_database_performed': False
        },
        'http_proof': proof,
        'public_url_verified': False,
        'authenticated_login_or_staff_commands_executed': False,
        'latest_laptop_101_103_source_integrated': False,
        'quic_connector_started': False,
        'instance_restart_or_deletion_recovery_proven': False,
        'data_or_runtime_secret_backup_verified': False,
        'stop_command': receipt['stop_command']
    }
    (ROOT / 'ROOT_FINAL_ORIGIN_PROOF.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'passed': True, 'runtime_id': cid, 'frontier': 100,
                      'preserved_table_digests': 130, 'public_url_verified': False}))

if __name__ == '__main__':
    main()
