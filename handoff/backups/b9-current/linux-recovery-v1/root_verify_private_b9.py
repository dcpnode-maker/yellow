#!/usr/bin/env python3
"""Read-only, selected-metadata proof of the owned synthetic b9 origin."""
import hashlib,json,os,subprocess,urllib.request,urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parent
SOURCE=Path('/workspace/yellow-receiving-b9')
REV='b9ba702a074a487feeafa056abb49abcdcf01ba8'
APP='f58e39a497b6dfb39b9d96b07f15378da3a1a13e8896b753ba5abbc82454b5c8'
IMAGE='sha256:1e522a8ab84af27ddc57d4aef3e7f6a383d254be15225a8c9df1722df87d7bc9'
PG_NAME='yellow-b9-linux-20261001-v2-postgres-1'
NONCE='4d32ae1963c807bdded446822aa65670'
ENV=os.environ.copy()
for key in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'): ENV.pop(key,None)
def run(args):
    return subprocess.run(args,env=ENV,capture_output=True,check=True,timeout=30).stdout
def docker(*args): return run(['docker','--host','unix:///var/run/docker.sock',*args])
def inspect(cid):
    fmt='{{json .Id}}|{{json .Image}}|{{json .Name}}|{{json .State.Status}}|{{json .HostConfig.PortBindings}}|{{json .HostConfig.RestartPolicy.Name}}|{{json .Config.User}}|{{json .Config.Cmd}}|{{json .Config.Labels}}'
    return [json.loads(x) for x in docker('inspect','--format',fmt,cid).decode().strip().split('|')]
app=inspect(APP)
assert app[:4]==[APP,IMAGE,'/yellow-b9-linux-20261001-v2-app-1','running']
assert app[4]=={'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':'53014'}]}
assert app[5:8]==['no','bun',['bun','run','start']]
assert app[8]['com.yellow.proof.source']==REV and app[8]['com.yellow.proof.nonce']==NONCE
assert app[8]['com.yellow.proof.job']=='yellow-b9-linux-20261001-v2'
assert run(['git','-C',str(SOURCE),'rev-parse','HEAD']).decode().strip()==REV
assert not run(['git','-C',str(SOURCE),'status','--porcelain=v1']).strip()
pg=inspect(PG_NAME)
assert pg[1]=='sha256:c293117fcecda7344b5480222e813b9f673d7abd69b1dd95eff239b768b04f59'
assert pg[8]['com.yellow.proof.nonce']==NONCE
sql="""BEGIN READ ONLY;
SELECT json_build_object('database',current_database(),'server_version',current_setting('server_version'),
'ledger',(SELECT json_agg(json_build_object('version',version,'filename',filename,'checksum_sha256',checksum_sha256) ORDER BY version) FROM public.schema_migration),
'table_count',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),
'roles',(SELECT json_agg(json_build_object('name',rolname,'can_login',rolcanlogin,'has_password',rolpassword IS NOT NULL) ORDER BY rolname) FROM pg_authid WHERE rolname IN ('app_role','yellow_owner')))::text;
ROLLBACK;"""
db=json.loads(docker('exec',pg[0],'psql','--no-password','-X','-qAt','-h','/var/run/postgresql','-U','yellow_deploy','-d','yellow_dev','-v','ON_ERROR_STOP=1','-c',sql))
assert db['database']=='yellow_dev' and db['server_version']=='18.6' and db['table_count']==130
assert [x['version'] for x in db['ledger']]==list(range(1,104))
for row in db['ledger']:
    assert '/' not in row['filename'] and '\\' not in row['filename']
    assert hashlib.sha256((SOURCE/'migrations'/row['filename']).read_bytes()).hexdigest()==row['checksum_sha256']
assert len(db['roles'])==2 and all(r['can_login'] is False and r['has_password'] is False for r in db['roles'])
def fetch(path):
    req=urllib.request.Request('http://127.0.0.1:53014'+path,headers={'Cache-Control':'no-store'})
    try: response=urllib.request.urlopen(req,timeout=5)
    except urllib.error.HTTPError as e: response=e
    with response:
        body=response.read(2*1024*1024+1)
        assert len(body)<=2*1024*1024
        return {'path':path,'status':response.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()},body
checks=[]
for path,expected in [('/health',200),('/ready',200),('/',200),('/api/v1/me/properties',401),('/.env',404),('/src/server.ts',404),('/package.json',404),('/Dockerfile',404),('/migrations/0103_property_operating_mode_reserved_config_guard.sql',404)]:
    result,body=fetch(path); assert result['status']==expected; checks.append(result)
    if path=='/ready': assert json.loads(body)['build']['revision']==REV
manifest=json.loads((ROOT/'BUILD_INPUT_MANIFEST_V2.json').read_text())
index=next(r for r in manifest['files'] if r['path']=='public/yellow-next/index.html')
root_check=next(c for c in checks if c['path']=='/')
assert root_check['sha256']==index['sha256']
prior={}
for cid in ['fe96ec05f4db113a5935c0d7e0f38aa6445b9ca16995c073195e399edcea4599','d002232dfdb8ba671ca51fc53ae8657ea72cc361740acd61c91b49e8f5bdca59','8285d83c127f8981d94e10c09fe6fce1bba9c594efe13a70332597eb0e5b5680']:
    selected=inspect(cid); assert selected[3]=='running'
    prior[cid]={'image':selected[1],'running':True}
proof={'passed':True,'reviewer':'root non-implementer of database/app proof','source_revision':REV,'app_container_id':APP,'image_id':IMAGE,'database_container_id':pg[0],'frontier':103,'all_103_migration_checksums_match':True,'public_tables':130,'nologin_roles_have_no_password':True,'health_ready_ui_anonymous_and_private_path_checks':checks,'html_matches_fresh_build_manifest':True,'previous_services_running':prior,'scope':'VM loopback synthetic only','public_route_login_browser_business_recovery_proven':False}
target=ROOT/'ROOT_PRIVATE_B9_REVIEW.json'
target.write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps({'passed':True,'proof':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
