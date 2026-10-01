#!/usr/bin/env python3
"""Root-owned app-only candidate launch with shared synthetic DB preservation."""
from http.client import HTTPConnection
import datetime,hashlib,json,os,re,secrets,socket,stat,subprocess,time,tempfile,resource
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SOURCE='444072ffdff2b7745345d88f71b603c17e11ace6'
PG='53b7f6b70ca8faa971d0483c25a40e6b39a05c3fdfbd230f23e8484675d3a050'
PGIMAGE='sha256:c293117fcecda7344b5480222e813b9f673d7abd69b1dd95eff239b768b04f59'
PGNONCE='4d32ae1963c807bdded446822aa65670'
NETWORK='yellow-b9-linux-20261001-v2-bridge'
BINDING=Path('/workspace/yellow-coordination/release-20261001/receiving-b9-linux-v1/database-proof-v2/private-app/runtime.env')
PROTECTED=['fe96ec05f4db113a5935c0d7e0f38aa6445b9ca16995c073195e399edcea4599','8285d83c127f8981d94e10c09fe6fce1bba9c594efe13a70332597eb0e5b5680','d002232dfdb8ba671ca51fc53ae8657ea72cc361740acd61c91b49e8f5bdca59','f58e39a497b6dfb39b9d96b07f15378da3a1a13e8896b753ba5abbc82454b5c8']
D=['docker','--host','unix:///var/run/docker.sock']
ENV=dict(os.environ)
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']: ENV.pop(key,None)
# Existing managed binding file must be the sole source of secret interpolation.
for key in ['YELLOW_RUNTIME_DATABASE_PASSWORD','YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD','YELLOW_TOKEN_SECRET']: ENV.pop(key,None)
JOB='RELEASE-20261001-candidate-444-runtime'
NAME='yellow-candidate-444-v1-app'
NONCE=secrets.token_hex(16)
image=None
PRIVATE=ROOT/'private-launch-v2'
CID=None
REPORT={'schema':'yellow-candidate-444-private-runtime/v1','source':SOURCE,'public_route_proven':False,'synthetic_only':True,'business_data_recovery_proven':False,'interactive_login_verified':False,'workers_started':False,'nonce':NONCE}

def require(ok,msg):
 if not ok: raise RuntimeError(msg)
def run(args,cap=25,env=None):
 p=subprocess.run(args,env=env or ENV,capture_output=True,timeout=cap)
 require(p.returncode==0,'bounded command failed')
 return p.stdout

def meta(cid):
 template='{"id":{{json .Id}},"image":{{json .Image}},"running":{{json .State.Running}},"name":{{json .Name}},"labels":{{json .Config.Labels}},"ports":{{json .HostConfig.PortBindings}},"restart":{{json .HostConfig.RestartPolicy.Name}},"networks":{{json .NetworkSettings.Networks}},"memory":{{json .HostConfig.Memory}},"nano_cpus":{{json .HostConfig.NanoCpus}},"user":{{json .Config.User}}}'
 return json.loads(run(D+['inspect','--format',template,cid]))
def pgcheck():
 m=meta(PG)
 require(m['id']==PG and m['image']==PGIMAGE and m['running'],'shared PG identity/state mismatch')
 require(m['labels'].get('com.yellow.proof.nonce')==PGNONCE and m['labels'].get('com.yellow.proof.source')=='b9ba702a074a487feeafa056abb49abcdcf01ba8','shared PG ownership mismatch')
 require(NETWORK in m['networks'] and 'postgres' in m['networks'][NETWORK]['Aliases'],'shared PG network/alias mismatch')
 return {'id':m['id'],'image':m['image'],'running':True,'ownership_verified':True}
def fingerprint():
 pgcheck()
 result={}
 for kind,arg in [('data','--data-only'),('schema','--schema-only')]:
  # Unnamed private file: bounded producer size, then stream hashes only.
  with tempfile.TemporaryFile() as tmp:
   def size_limit():resource.setrlimit(resource.RLIMIT_FSIZE,(50_000_000,50_000_000))
   p=subprocess.run(D+['exec',PG,'pg_dump','-U','yellow_deploy','-d','yellow_dev',arg],env=ENV,stdout=tmp,stderr=subprocess.PIPE,timeout=40,preexec_fn=size_limit)
   require(p.returncode==0 and tmp.tell()<=50_000_000,'bounded synthetic dump failed')
   tmp.seek(0);h=hashlib.sha256();total=0
   while True:
    line=tmp.readline(1_000_001)
    if not line:break
    require(len(line)<=1_000_000,'dump line exceeds memory bound')
    if not line.startswith((b'\\restrict ',b'\\unrestrict ')):h.update(line);total+=len(line)
   result[kind+'_sha256']=h.hexdigest();result[kind+'_bytes']=total
 result['raw_rows_or_credentials_emitted']=False
 return result
def protected():
 for cid in PROTECTED: require(meta(cid)['running'],'protected old service not running')
 return {'verified_exact_running_cids':PROTECTED}
def http(path,port=53018):
 c=HTTPConnection('127.0.0.1',port,timeout=5)
 try:
  c.request('GET',path);r=c.getresponse();raw=r.read(5_000_001)
  require(len(raw)<=5_000_000,'HTTP body exceeds bound')
  item={'path':path,'status':r.status,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
  return item,raw
 finally:c.close()
def absent(result):
 return result.returncode==1 and not result.stdout.strip() and bool(re.fullmatch(r'(?:Error: No such object: |Error response from daemon: No such container: )'+re.escape(NAME),result.stderr.decode(errors='replace').strip()))
def cleanup():
 global CID
 if CID is None:
  # Compose may create the app before timing out; independently discover it.
  found=subprocess.run(D+['inspect','--format','{{.Id}}',NAME],env=ENV,capture_output=True,timeout=5)
  if found.returncode!=0:
   require(absent(found),'candidate absence unverified; cleanup not claimed')
   return
  possible=found.stdout.decode().strip();m=meta(possible)
  require(m['id']==possible and m['name']=='/'+NAME and m['image']==image and m['labels'].get('com.yellow.proof.nonce')==NONCE and m['labels'].get('com.yellow.proof.job')==JOB and m['labels'].get('com.yellow.proof.source')==SOURCE,'cleanup discovery ownership mismatch; no deletion')
  CID=possible
 if CID:
  m=meta(CID)
  require(m['id']==CID and m['name']=='/'+NAME and m['image']==image and m['labels'].get('com.yellow.proof.nonce')==NONCE and m['labels'].get('com.yellow.proof.job')==JOB and m['labels'].get('com.yellow.proof.source')==SOURCE,'cleanup ownership mismatch')
  run(D+['rm','-f',CID])

stage='admission'
try:
 require(not PRIVATE.exists(),'fresh launch output required')
 st=BINDING.lstat();require(stat.S_ISREG(st.st_mode) and stat.S_IMODE(st.st_mode)==0o600 and not BINDING.is_symlink(),'existing binding file metadata mismatch')
 imageproof=json.loads((ROOT/'CANDIDATE_444_IMAGE_EXPORT_PROOF_V2.json').read_text())
 require(imageproof['passed'] and imageproof['candidate_source_revision']==SOURCE,'image proof mismatch')
 image=imageproof['candidate_image_id'];require(re.fullmatch('sha256:[0-9a-f]{64}',image),'invalid image ID')
 pgcheck();protected()
 with socket.socket() as s:s.bind(('127.0.0.1',53018))
 existing=subprocess.run(D+['inspect','--format','{{.Id}}',NAME],env=ENV,capture_output=True,timeout=5)
 require(absent(existing),'candidate absence unverified or name already used')
 PRIVATE.mkdir(mode=0o700)
 REPORT['before_fingerprint']=fingerprint()
 REPORT['shared_synthetic_pg']=pgcheck();REPORT['protected_before']=protected()
 ENV['YELLOW_CANDIDATE_IMAGE_ID']=image;ENV['CANDIDATE_444_NONCE']=NONCE
 stage='app-only-compose-launch'
 p=subprocess.run(D+['compose','--project-name','yellow-candidate-444-v1','--env-file',str(BINDING),'-f',str(ROOT/'candidate-compose.yml'),'up','-d','--wait','--wait-timeout','25','--no-build','--pull','never','app'],env=ENV,capture_output=True,timeout=40)
 log=PRIVATE/'compose-output.log';log.write_bytes(p.stdout+p.stderr);log.chmod(0o600)
 # Discover exact owned CID even if health waiting failed, for narrow cleanup.
 candidate=subprocess.run(D+['inspect','--format','{{.Id}}',NAME],env=ENV,capture_output=True,timeout=5)
 if candidate.returncode==0:
  possible=candidate.stdout.decode().strip();m=meta(possible)
  require(m['labels'].get('com.yellow.proof.nonce')==NONCE and m['labels'].get('com.yellow.proof.job')==JOB and m['labels'].get('com.yellow.proof.source')==SOURCE,'unexpected candidate ownership')
  CID=possible
 require(p.returncode==0 and CID,'candidate launch failed')
 stage='private-http-proof'
 m=meta(CID);require(m['image']==image and m['running'] and m['user']=='bun','candidate runtime identity mismatch')
 require(m['ports']=={'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':'53018'}]} and m['restart']=='no','candidate exposure/restart drift')
 require(m['memory']==1073741824 and m['nano_cpus']==1000000000 and set(m['networks'])=={NETWORK},'candidate bounds/network drift')
 REPORT['runtime']={'id':CID,'image':image,'running':True,'loopback_only_port':53018,'restart':'no','memory_bytes':m['memory'],'nano_cpus':m['nano_cpus'],'source':SOURCE,'ownership_verified':True}
 REPORT['http']=[]
 for path in ['/health','/ready','/','/api/v1/me/properties','/.git/config','/.env','/src/server.ts','/package.json','/handoff/LEDGER.md']:
  item,raw=http(path);REPORT['http'].append(item)
  expected=401 if path=='/api/v1/me/properties' else (200 if path in ['/health','/ready','/'] else 404)
  require(item['status']==expected,'HTTP acceptance mismatch')
  if path=='/ready':
   ready=json.loads(raw);require(ready.get('status')=='ready' and ready.get('target')=='yellow_runtime_database' and ready['build']['revision']==SOURCE and ready['build']['expectedMigrationFrontier']==103,'readiness source/frontier mismatch');REPORT['readiness']=ready
  if path=='/':
   matches=re.findall(rb'(?:src|href)=["\'](/yellow-next/assets/[^"\']+)["\']',raw)
   require(matches,'compiled UI assets absent')
   REPORT['compiled_assets']=[]
   for asset in matches:
    a,_=http(asset.decode());require(a['status']==200,'compiled UI asset unavailable');REPORT['compiled_assets'].append(a)
 stage='database-preservation-proof'
 REPORT['after_fingerprint']=fingerprint();require(REPORT['after_fingerprint']==REPORT['before_fingerprint'],'shared synthetic DB changed')
 REPORT['protected_after']=protected();REPORT['database_unchanged']=True
 REPORT['passed']=True;REPORT['runtime_kept_private']=True
except BaseException as error:
 REPORT['passed']=False;REPORT['failure']={'stage':stage,'type':type(error).__name__,'reason':str(error) if isinstance(error,RuntimeError) else 'bounded execution failure'}
 try:cleanup();REPORT['owned_candidate_cleanup']=True
 except BaseException:REPORT['owned_candidate_cleanup']=False
 try:
  REPORT['after_failure_fingerprint']=fingerprint();REPORT['database_unchanged']=REPORT.get('before_fingerprint')==REPORT['after_failure_fingerprint'];REPORT['protected_after_failure']=protected()
 except BaseException:REPORT['failure_preservation_verified']=False
finally:
 REPORT['captured_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 path=ROOT/'ACTUAL_PRIVATE_CANDIDATE_RUNTIME_PROOF_V2.json';require(not path.exists(),'proof output already exists');path.write_text(json.dumps(REPORT,indent=2)+'\n')
 print(json.dumps({'passed':REPORT['passed'],'stage':stage,'runtime':REPORT.get('runtime'),'failure':REPORT.get('failure')}))
raise SystemExit(0 if REPORT['passed'] else 1)
