"""Trusted fixed one-worker successor. Model output is inert, not executable."""
BATCH='fit-0930e'
KEY='«REDACTED-SECRET»'
PUBLIC_PIN='d708ff29e2e44df74a5c1a12e58a8cf656b14c8d'
CACHE=Path('/kaggle/working/yellow-qwen38/native-fit-b11216-r1')

def fit_snapshot(job):
 with job['lock']: return {k:v for k,v in job.items() if k not in ('thread','lock','processes','packet')}

def fit_update(job,**values):
 with job['lock']:
  job.update(values,updatedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
  (Path(job['jobRoot'])/'status.json').write_text(json.dumps(fit_snapshot(job),sort_keys=True))

def fit_run(job):
 try:
  command,env,started=runner(job);root=Path(job['jobRoot']);packet=job['packet'];repo=root/'yellow'
  if hashlib.sha256(packet['prompt'].encode()).hexdigest()!=packet['promptSha256'] or \
   len(packet['prompt'].encode())+256+4096>16384: raise ValueError('Exact packet capacity/digest differs')
  fit_update(job,phase='public-source-fetch')
  command(['git','init',str(repo)],'git-init')
  command(['git','-C',str(repo),'fetch','--depth','1','https://github.com/dcpnode-maker/yellow.git',PUBLIC_PIN],'git-fetch')
  command(['git','-C',str(repo),'checkout','--detach','FETCH_HEAD'],'git-checkout')
  pin=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],env=env,text=True,timeout=15).strip()
  if pin!=PUBLIC_PIN or packet['publicSourceSha']!=PUBLIC_PIN: raise ValueError('Public pin differs')
  for source in packet['sources']:
   if source['path'] not in ('tests/helpers/cdp-invoke.ts','tests/cdp-invoke.test.ts') or \
    digest(repo/source['path'])!=source['sha256']: raise ValueError('Exact public fixture differs')
  fit_update(job,sourceVerified=True,phase='baseline-test')
  archive=root/'bun.zip';url='https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64.zip'
  with urllib.request.urlopen(url,timeout=30) as response,archive.open('xb') as out:
   total=0;before=time.monotonic()
   while True:
    block=response.read(1048576)
    if not block: break
    total+=len(block)
    if total>35969274 or time.monotonic()-before>90: raise ValueError('Bun bounded transfer exceeded')
    out.write(block)
  if archive.stat().st_size!=35969274 or digest(archive)!=BUN_SHA: raise ValueError('Bun pin differs')
  import zipfile
  with zipfile.ZipFile(archive) as z: data=z.read('bun-linux-x64/bun')
  bun=root/'bun';bun.write_bytes(data);bun.chmod(0o700)
  log,code=command([str(bun),'test','tests/cdp-invoke.test.ts'],'baseline',120,cwd=str(repo),check=False)
  fit_update(job,baselineExit=code,completedSteps=1)
  if code: raise RuntimeError('Pinned baseline failed')
  fit_update(job,phase='model-weights')
  weights=Path('/kaggle/working/yellow-qwen38/weights')/MODEL_FILE
  if not weights.is_file():
   if shutil.disk_usage('/kaggle/working').free<MODEL_BYTES+3000000000: raise ValueError('Weights headroom unavailable')
   target=Path('/kaggle/working/yellow-qwen38/fit-model-0930e');target.mkdir(parents=True,exist_ok=False)
   code='from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='+repr(MODEL)+',filename='+repr(MODEL_FILE)+',revision='+repr(MODEL_REV)+',local_dir='+repr(str(target))+',token=False)'
   command(['python','-c',code],'model-download',900);weights=target/MODEL_FILE
  if weights.is_symlink() or weights.stat().st_size!=MODEL_BYTES or digest(weights)!=MODEL_SHA: raise ValueError('Weights pin differs')
  fit_update(job,weightsVerified=True,phase='native-runtime')
  if CACHE.exists(): raise ValueError('New cache already exists; preserve it, no ambiguous rebuild')
  if shutil.disk_usage('/tmp').free<2500000000: raise ValueError('Native headroom unavailable')
  source=root/'llama.cpp';build=root/'native-build'
  command(['git','clone','--depth','1','--branch','b11216','https://github.com/ggml-org/llama.cpp.git',str(source)],'runtime-clone')
  rev=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],env=env,text=True,timeout=15).strip()
  if rev!=RUNTIME_REV: raise ValueError('Runtime source pin differs')
  drivers=[p for p in (Path('/usr/lib/x86_64-linux-gnu/libcuda.so.1'),Path('/usr/local/nvidia/lib64/libcuda.so.1')) if p.is_file()]
  if not drivers: raise ValueError('CUDA driver absent')
  command(native_configure(source,build,drivers[0]),'runtime-configure',180)
  command(['cmake','--build',str(build),'--target','llama-cli','-j','2'],'runtime-build',2400)
  # Persist the complete native file set BEFORE stopping the session. No old cache overwrite.
  CACHE.mkdir(parents=True,exist_ok=False);manifest={}
  files=[build/'bin/llama-cli']+sorted((build/'bin').glob('*.so*'))
  for file in files:
   if not file.resolve().is_relative_to(build.resolve()) or not file.is_file(): raise ValueError('Native dependency escaped build')
   target=CACHE/file.name;sha=digest(file)
   if target.exists() and digest(target)!=sha: raise ValueError('Native basename collision')
   if not target.exists(): shutil.copyfile(file,target);target.chmod(0o700 if file.name=='llama-cli' else 0o600)
   if digest(target)!=sha: raise ValueError('Native copy differs')
   manifest[file.name]={'sha256':sha,'bytes':target.stat().st_size}
  cache_record={'runtimeSourceRevision':RUNTIME_REV,'cudaArchitecture':75,'files':manifest}
  with (CACHE/'manifest.json').open('x') as out: json.dump(cache_record,out,sort_keys=True)
  env['LD_LIBRARY_PATH']=str(CACHE)+':/usr/local/cuda/lib64:/usr/local/nvidia/lib64'
  binary=CACHE/'llama-cli';log,_=command([str(binary),'--list-devices'],'devices',30)
  if len(re.findall(r'CUDA\d+:',log.read_text()))!=2: raise ValueError('Two T4 devices not proved')
  fit_update(job,runtimeVerified=True,runtimeCache=cache_record,runtimeCacheManifestSha256=digest(CACHE/'manifest.json'))
  args=[str(binary),'--model',str(weights),'--ctx-size','16384','--n-gpu-layers','999','--tensor-split','1,1',
    '--reasoning','off','--temp','0.2','--seed','1','--single-turn','--no-display-prompt']
  smoke=root/'smoke.txt';smoke.write_text('Return only a Python function named add that returns a + b. No explanation.')
  fit_update(job,phase='model-smoke');log,_=command(args+['--n-predict','128','--file',str(smoke)],'smoke',180)
  if not re.search(r'def\s+add\s*\(',log.read_text()) or not re.search(r'return\s+a\s*\+\s*b',log.read_text()):
   raise ValueError('Fresh synthetic inference absent')
  fit_update(job,smokeVerified=True,phase='coding-file')
  prompt=root/'prompt.txt';prompt.write_text(packet['prompt']);before=time.monotonic()
  log,_=command(args+['--n-predict','4096','--file',str(prompt)],'proposal',480)
  if log.stat().st_size>60000: raise ValueError('Full proposal exceeds retention budget; no truncation')
  text=log.read_text()
  if re.search(r'KGAT_|thk_live_|AIza|jupyter-proxy\.kaggle\.net|Bearer\s',text): raise ValueError('Credential-like output withheld')
  fit_update(job,state='completed_unaccepted',phase='completed',completedSteps=2,
   proposalSha256=digest(log),proposalBytes=log.stat().st_size,generationSeconds=round(time.monotonic()-before,2))
 except Exception as e: fit_update(job,state='failed',phase='failed',errorType=type(e).__name__)

def fit_prepare(packet):
 if globals().get(KEY): raise ValueError('Fit claim already exists; no replay')
 for key in ('_yellow_pr_job','_yellow_build_0929b_job','_yellow_micro_0929c_job','_yellow_compat_0930d_job'):
  old=globals().get(key)
  if old and (old.get('state')=='running' or old.get('thread') and old['thread'].is_alive()): raise ValueError('Prior owned work active')
 root=tempfile.mkdtemp(prefix='yellow-fit-0930e-',dir='/tmp')
 job={'workerId':'worker-1','batchId':BATCH,'jobRoot':root,'state':'running','phase':'starting',
  'sourceSha':PUBLIC_PIN,'promptSha256':packet['promptSha256'],'completedSteps':0,'totalSteps':2,
  'packet':packet,'sourceVerified':False,'weightsVerified':False,'runtimeVerified':False,'smokeVerified':False,
  'generatedCodeExecuted':False,'sourceApplied':False,'accepted':False,'lock':threading.RLock(),'processes':set()}
 globals()[KEY]=job;thread=threading.Thread(target=fit_run,args=(job,),daemon=True);job['thread']=thread;thread.start()
 return fit_snapshot(job)

def fit_observe(job):
 if not job: return {'workerId':'worker-1','batchId':BATCH,'state':'no_job'}
 value=fit_snapshot(job)
 with job['lock']: value.update(ownedProcessCount=len(job['processes']),jobThreadAlive=job['thread'].is_alive())
 file=Path(job['jobRoot'])/'runtime-build.log'
 if file.is_file():
  with file.open('rb') as f: f.seek(max(0,file.stat().st_size-2000));text=f.read().decode('utf8',errors='replace')
  matches=re.findall(r'\[\s*(\d+)%\]',text)
  if matches: value['nativeCompilePercent']=int(matches[-1])
 return value

if '_yellow_fit_operation' in globals():
 job=globals().get(KEY);operation=_yellow_fit_operation
 if operation=='prepare': _yellow_owned_result=fit_prepare(_yellow_fit_packet)
 elif operation=='status': _yellow_owned_result=fit_observe(job)
 elif operation=='result':
  if not job or job['thread'].is_alive() or job['processes'] or job['state'] not in ('failed','completed_unaccepted'):
   raise ValueError('Settled terminal job required')
  logs={}
  for name in ('baseline','model-download','runtime-configure','runtime-build','devices','smoke','proposal'):
   file=Path(job['jobRoot'])/(name+'.log')
   if file.is_file() and not file.is_symlink():
    with file.open('rb') as f: f.seek(max(0,file.stat().st_size-3000));tail=f.read().decode('utf8',errors='replace')
    logs[name]='withheld credential-like output' if re.search(r'KGAT_|thk_live_|AIza|jupyter-proxy\.kaggle\.net|Bearer\s',tail) else tail
  _yellow_owned_result={'state':fit_observe(job),'logs':logs,'logExcerptsOnly':True,'completeProposal':False}
 elif operation=='proposal':
  if not job or job['thread'].is_alive() or job['processes'] or job['state']!='completed_unaccepted':
   raise ValueError('Complete settled proposal required')
  file=Path(job['jobRoot'])/'proposal.log'
  if file.is_symlink() or file.stat().st_size>60000 or digest(file)!=job['proposalSha256']: raise ValueError('Full proposal digest differs')
  value={'workerId':'worker-1','batchId':BATCH,'taskId':'cdp-complete-regressions',
    'text':file.read_text(),'sha256':digest(file),'accepted':False,'generatedCodeExecuted':False,'sourceApplied':False}
  if len(json.dumps(value).encode())>64000: raise ValueError('Reply exceeds bound; no truncation')
  _yellow_owned_result=value
 else: raise ValueError('Fixed fit operation required')
