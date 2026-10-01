#!/usr/bin/env python3
"""Single-use, review-gated managed Docker build; not a deploy or app start."""
from __future__ import annotations
import datetime,hashlib,json,os,pathlib,re,shutil,signal,subprocess,tarfile,tempfile,threading,time

ROOT=pathlib.Path(__file__).resolve().parent
PREP=ROOT/'managed-hosting-build-preparation-9ff27ad.json'
ARCHIVE=ROOT/'source-context-9ff27ad.tar'
MANIFEST=ROOT/'source-manifest-9ff27ad.json'
ADAPTER=ROOT/'Dockerfile.managed-9ff27ad'
STATUS=ROOT/'managed-hosting-build-9ff27ad-status.json'
LOG=ROOT/'managed-hosting-build-9ff27ad-sanitized.log'
DOCKER='/usr/local/bin/docker'
SOURCE='9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'
TREE='4311a79c0c9ffc33877809162b1b38ae1b3c944a'
TAG='yellow-managed:9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'
ALLOWED={'Dockerfile','.dockerignore','package.json','bun.lock','src','scripts','migrations','public/yellow-next'}
job={'jobId':'HOSTING-20261001-managed-image-9ff27ad-v1','state':'prepared-not-executed','source':SOURCE,'tree':TREE,'tag':TAG,'target':'runtime',
     'sourceArchive':ARCHIVE.name,'sourceArchiveSha256':None,'sourceManifestSha256':None,'adapterDockerfileSha256':None,'pid':None,'dockerPid':None,
     'startedUtc':None,'finishedUtc':None,'exitCode':None,'timeoutSeconds':300,'imageProof':None,'oldAppBefore':None,'oldAppAfter':None,
     'automaticRetry':False,'deployment':False,'databaseWrites':False,'publicRoute':False,'appStart':False}
owned=None
staging=None
stop_signal=False

def save():
 STATUS.write_text(json.dumps(job,indent=2)+'\n'); STATUS.chmod(0o600)

def signal_handler(sig,frame):
 global stop_signal
 stop_signal=True
 if owned is not None and owned.poll() is None:
  try: owned.terminate()
  except ProcessLookupError: pass
for sig in (signal.SIGINT,signal.SIGTERM): signal.signal(sig,signal_handler)

def sha(data): return hashlib.sha256(data).hexdigest()

def docker(args,env,timeout=40):
 if stop_signal: raise InterruptedError('cancelled-before-docker-launch')
 return subprocess.run([DOCKER,*args],env=env,text=True,capture_output=True,timeout=timeout,check=False)

def inspect_app(env):
 r=docker(['ps','--filter','publish=53007','--format','{{.ID}}'],env)
 if r.returncode: raise RuntimeError('app-state-read-failed')
 ids=r.stdout.split()
 if len(ids)!=1: raise RuntimeError('expected-existing-app-count-mismatch')
 cid=ids[0]
 q=docker(['inspect','--format','{{.Id}}|{{.Image}}|{{.State.Running}}|{{.Config.Image}}|{{json .NetworkSettings.Ports}}',cid],env)
 if q.returncode: raise RuntimeError('app-inspect-failed')
 return {'container':cid,'inspect':q.stdout.strip()}

def bounded_log(data):
 s=data.decode('utf-8','replace')
 s=re.sub(r'(?i)(authorization|password|token|secret)(\s*[=:]\s*)[^\s,;]+',r'\1\2[redacted]',s)
 s=re.sub(r'(?i)(https?://[^\s/@]+):[^\s/@]+@',r'\1:[redacted]@',s)
 s=re.sub(r'(?i)bearer\s+[A-Za-z0-9._~+/-]+=*','Bearer [redacted]',s)
 return s[-32000:]

def verify_inputs():
 prep=json.loads(PREP.read_text())
 if prep.get('state')!='prepared-not-executed' or prep.get('source')!=SOURCE or prep.get('tree')!=TREE or prep.get('tag')!=TAG or prep.get('target')!='runtime' or prep.get('timeoutSeconds')!=300:
  raise RuntimeError('preparation-receipt-mismatch')
 arc=ARCHIVE.read_bytes(); manifest=MANIFEST.read_bytes(); adapter=ADAPTER.read_bytes()
 if len(arc)!=prep.get('sourceArchiveBytes') or sha(arc)!=prep.get('sourceArchiveSha256'): raise RuntimeError('source-archive-integrity-mismatch')
 if sha(manifest)!=prep.get('sourceManifestSha256') or sha(adapter)!=prep.get('adapterDockerfileSha256'): raise RuntimeError('manifest-or-adapter-hash-mismatch')
 original=__import__('subprocess').check_output(['/usr/bin/git','-C','/workspace/yellow-release','show',SOURCE+':Dockerfile'])
 old=b'RUN bun install --frozen-lockfile --production'
 new=b'RUN --mount=type=secret,id=proxy_ca,required=true \\\n    NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca \\\n    bun install --frozen-lockfile --production'
 if original.count(old)!=1 or adapter.replace(new,old)!=original: raise RuntimeError('adapter-backprojection-mismatch')
 return arc,adapter,prep

def extract_context(raw,adapter):
 global staging
 staging=pathlib.Path(tempfile.mkdtemp(prefix='managed-hosting-9ff27ad-',dir=ROOT)); staging.chmod(0o700)
 context=staging/'context'; context.mkdir(mode=0o700)
 import io
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:') as tf:
  seen=set()
  for m in tf.getmembers():
   rel=pathlib.PurePosixPath(m.name.rstrip('/'))
   if rel.is_absolute() or '..' in rel.parts or not rel.parts: raise RuntimeError('unsafe-context-path')
   name=rel.as_posix()
   allowed=name in {'Dockerfile','.dockerignore','package.json','bun.lock'} or any(name==root or name.startswith(root+'/') for root in ('src','scripts','migrations','public/yellow-next')) or name=='public'
   if not allowed or m.issym() or m.islnk() or not (m.isfile() or m.isdir()): raise RuntimeError('unapproved-context-entry')
   if name in seen and m.isfile(): raise RuntimeError('duplicate-context-file')
   seen.add(name); dst=context.joinpath(*rel.parts)
   if m.isdir(): dst.mkdir(parents=True,exist_ok=True,mode=0o700)
   else:
    dst.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    f=tf.extractfile(m)
    if f is None: raise RuntimeError('context-member-read-failed')
    data=f.read()
    if len(data)!=m.size: raise RuntimeError('context-member-size-mismatch')
    dst.write_bytes(data); dst.chmod(0o600 if m.mode & 0o600 else 0o400)
 (context/'Dockerfile.managed').write_bytes(adapter); (context/'Dockerfile.managed').chmod(0o600)
 if any((context/x).exists() for x in ('.yellow','.env','.codex','node_modules','tests')): raise RuntimeError('excluded-runtime-path-entered-context')
 return context

def run_once():
 global owned,staging
 # Preserve all inherited managed proxy, CA, auth, registry, HOME and platform guard values.
 env=os.environ.copy()
 for key in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'):
  env.pop(key,None)
 env['DOCKER_HOST']='unix:///var/run/docker.sock'
 prep=json.loads(PREP.read_text())
 cert=os.environ.get('CODEX_PROXY_CERT')
 if not cert or not pathlib.Path(cert).is_file() or not os.access(cert,os.R_OK): raise RuntimeError('proxy-ca-file-selector-not-ready')
 raw,adapter,prep=verify_inputs()
 job.update({'sourceArchiveSha256':sha(raw),'sourceManifestSha256':sha(MANIFEST.read_bytes()),'adapterDockerfileSha256':sha(adapter),
             'sourceArchiveBytes':len(raw),'pid':os.getpid(),'state':'preflight-passed','emptyDockerConfig':False,'homeOverridden':False,
             'inheritedManagedConfigurationPreserved':True,'clearDockerSelectors':['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'],
             'dockerEndpoint':'unix:///var/run/docker.sock','proxyCaSelectorPresent':True})
 save()
 # Validate only managed daemon reachability; never serialize config or environment.
 info=docker(['info','--format','{{.OSType}}/{{.Architecture}}'],env)
 if info.returncode: raise RuntimeError('managed-docker-daemon-unavailable')
 job['nativeDockerPlatform']=info.stdout.strip()
 machine=os.uname().machine.lower()
 native_arch={'x86_64':'amd64','amd64':'amd64','aarch64':'arm64','arm64':'arm64'}.get(machine)
 daemon_arch_raw=info.stdout.strip().split('/')[-1].lower()
 daemon_arch={'x86_64':'amd64','amd64':'amd64','aarch64':'arm64','arm64':'arm64'}.get(daemon_arch_raw)
 if not native_arch or daemon_arch!=native_arch: raise RuntimeError('daemon-native-architecture-mismatch')
 job['runnerNativeArchitecture']=native_arch
 app_before=inspect_app(env); job['oldAppBefore']=app_before
 prior=docker(['image','inspect',TAG,'--format','{{.Id}}'],env)
 if prior.returncode==0: raise RuntimeError('unique-image-tag-already-exists')
 context=extract_context(raw,adapter)
 cert_arg='id=proxy_ca,src='+cert
 command=[DOCKER,'build','--progress=plain','--target','runtime','--build-arg','YELLOW_BUILD_SHA='+SOURCE,'--secret',cert_arg,'--tag',TAG,'--file','Dockerfile.managed','.']
 job.update({'state':'ready-to-build','contextPathCount':sum(1 for x in context.rglob('*') if x.is_file()),
             'contextBytes':sum(x.stat().st_size for x in context.rglob('*') if x.is_file())})
 save()
 if stop_signal:
  job.update({'state':'cancelled','disposition':'cancelled before Docker build launch; no automatic resume'}); return
 job.update({'state':'building','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 save()
 if stop_signal:
  job.update({'state':'cancelled','startedUtc':None,'disposition':'cancelled before Docker build launch; no automatic resume'}); return
 owned=subprocess.Popen(command,cwd=context,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 job['dockerPid']=owned.pid; save()
 chunks=[]; total=0
 def drain():
  nonlocal total
  assert owned and owned.stdout
  for chunk in iter(lambda:owned.stdout.read(8192),b''):
   total+=len(chunk)
   remaining=32000-sum(map(len,chunks))
   if remaining>0: chunks.append(chunk[:remaining])
 th=threading.Thread(target=drain,daemon=True); th.start()
 try: code=owned.wait(timeout=300)
 except subprocess.TimeoutExpired:
  owned.terminate()
  try: code=owned.wait(timeout=10)
  except subprocess.TimeoutExpired: owned.kill(); code=owned.wait(timeout=5)
  job['timedOut']=True
 th.join(timeout=10)
 LOG.write_text(bounded_log(b''.join(chunks))); LOG.chmod(0o600)
 job.update({'exitCode':code,'buildLogBytesCaptured':min(total,32000),'buildLogBytesObserved':total})
 if stop_signal: job.update({'state':'cancelled','disposition':'owned build CLI stopped; no automatic resume'}); return
 if code!=0: job.update({'state':'failed','disposition':'build failed; no automatic retry'}); return
 proof=docker(['image','inspect',TAG,'--format','{{.Id}}|{{.Os}}|{{.Architecture}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{.Config.User}}'],env)
 if proof.returncode: raise RuntimeError('built-image-inspect-failed')
 fields=proof.stdout.strip().split('|')
 if len(fields)!=5 or fields[0]=='' or fields[2]!=native_arch or fields[3]!=SOURCE or fields[4]!='bun': raise RuntimeError('built-image-revision-architecture-user-proof-failed')
 app_after=inspect_app(env)
 if app_after!=app_before: raise RuntimeError('existing-app-identity-changed')
 job.update({'oldAppAfter':app_after,'imageProof':{'imageId':fields[0],'os':fields[1],'architecture':fields[2],'revision':fields[3],'user':fields[4]},
             'state':'succeeded','disposition':'managed image built only; root must independently inspect; not deployed or started'})

def main():
 if STATUS.exists():
  try: prior=json.loads(STATUS.read_text())
  except Exception: raise SystemExit('refusing to overwrite unreadable job status')
  if prior.get('dockerPid') is not None or prior.get('startedUtc') is not None:
   raise SystemExit('single-use job already started; refusing implicit rerun')
 save()
 try: run_once()
 except InterruptedError:
  job.update({'state':'cancelled','disposition':'cancelled before next process launch; no automatic resume'})
 except Exception as exc:
  job.update({'state':'failed','failureClass':type(exc).__name__,'failureCode':str(exc)[:120],'disposition':'preflight/build failed; no automatic retry'})
 finally:
  if owned is not None and owned.poll() is None:
   try: owned.terminate(); owned.wait(timeout=10)
   except Exception: pass
  if staging and staging.exists(): shutil.rmtree(staging)
  job['finishedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat(); save()
if __name__=='__main__': main()
