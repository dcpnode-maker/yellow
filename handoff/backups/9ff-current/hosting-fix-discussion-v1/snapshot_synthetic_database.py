#!/usr/bin/env python3
"""Read-only digest of the already-owned synthetic database; emits no business rows."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

REPO = Path('/workspace/yellow-release')
PG = 'yellow-catalogue-referee-postgres-1'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    assert not args.output.exists()
    env = os.environ.copy()
    for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
        env.pop(key, None)
    docker = ['docker', '--host', 'unix:///var/run/docker.sock']
    psql = docker + ['exec', PG, 'psql', '-X', '-q', '-U', 'yellow_deploy', '-d', 'yellow_dev',
                     '-At', '--set=ON_ERROR_STOP=1', '--command']

    def read(sql):
        # Local configured synthetic PG socket auth; no credential discovery/file read.
        result = subprocess.run(psql + ['BEGIN READ ONLY; ' + sql + '; ROLLBACK;'], env=env,
                                capture_output=True, timeout=30)
        if result.returncode:
            raise RuntimeError('read-only synthetic SQL failed; private output not printed')
        return json.loads(result.stdout)

    identity = read("SELECT json_build_object('database',current_database(),'user',session_user,"
                    "'server_version',current_setting('server_version'),'frontier',"
                    "(SELECT count(*) FROM public.schema_migration))")
    assert identity['database'] == 'yellow_dev' and identity['user'] == 'yellow_deploy'
    assert identity['frontier'] == 100 and identity['server_version'].startswith('18.')
    names = read("SELECT json_agg(c.relname ORDER BY c.relname) FROM pg_class c "
                 "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")
    assert len(names) == 130 and all(re.fullmatch('[a-z_][a-z0-9_]*', n) for n in names)
    ledger = read("SELECT json_agg(json_build_object('version',version,'filename',filename,"
                  "'checksum_sha256',checksum_sha256) ORDER BY version) FROM public.schema_migration")
    assert len(ledger) == 100
    for row in ledger:
        name = row['filename']
        assert re.fullmatch(r'[0-9]{4}_[a-z0-9_]+\.sql', name)
        assert hashlib.sha256((REPO / 'migrations' / name).read_bytes()).hexdigest() == row['checksum_sha256']
    # All table summaries are taken within one consistent read-only transaction.
    sql = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '
    for name in names:
        sql += ("SELECT json_build_object('table','" + name + "','rows',count(*),'sha256',"
                "encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' "
                "ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex')) FROM public.\"" + name + '\" t; ')
    sql += 'ROLLBACK;'
    result = subprocess.run(psql + [sql], env=env, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError('synthetic row aggregate failed; private output not printed')
    rows = [json.loads(line) for line in result.stdout.splitlines()]
    assert len(rows) == 130 and [r['table'] for r in rows] == names
    dump = subprocess.run(docker + ['exec', PG, 'pg_dump', '-U', 'yellow_deploy', '-d', 'yellow_dev',
                                   '--schema-only'], env=env, capture_output=True, timeout=30)
    if dump.returncode:
        raise RuntimeError('schema digest failed; private output not printed')
    # pg_dump18 adds a random restriction token; normalize only that token's two lines.
    lines = dump.stdout.splitlines(keepends=True)
    normalized = b''.join(b'\\restrict <dump-restriction-token>\n' if line.startswith(b'\\restrict ')
                          else b'\\unrestrict <dump-restriction-token>\n' if line.startswith(b'\\unrestrict ')
                          else line for line in lines)
    proof = {'kind': 'owned synthetic database read-only fingerprint', 'identity': identity,
             'ledger': ledger, 'table_digests': rows, 'schema_sha256': hashlib.sha256(normalized).hexdigest(),
             'schema_normalization': 'only the random pg_dump18 restrict/unrestrict token lines',
             'raw_business_rows_emitted': False, 'mutation_executed': False}
    args.output.write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps({'passed': True, 'frontier': 100, 'table_count': len(rows),
                      'migration_hashes_matched': len(ledger), 'schema_sha256': proof['schema_sha256']}))

if __name__ == '__main__':
    main()
