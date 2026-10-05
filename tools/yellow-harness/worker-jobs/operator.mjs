import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { persistBridgeCredential, readBridgeCredential } from 'file:///D:/Yellow/harness/adapters/t3/windows-secrets.mjs';
import { privateKaggleBase, createPrivateKaggleJupyter, executeOwnedDiagnostic, inspectExistingKernelWire } from 'file:///D:/Yellow/harness/adapters/t3/kaggle-jupyter.mjs';

const ROOT = 'D:/Yellow/harness/state-workspace';
const BROWSER = 'C:/Users/astha/.local/bin/browser-act.exe';
export const BROWSER_CAPTURE_MS = 30000;
export const WORKERS = Object.freeze({
  'worker-1': { owner: 'ankitg37', notebook: 'notebook14389f1658', session: 'yellow_worker1_login_0929' },
  'worker-2': { owner: 'arabiannights', notebook: 'notebookce88a28cae', session: 'yellow_worker2_build_0929' },
  'worker-3': { owner: 'dcpnode', notebook: 'notebook28fded2af7', session: 'yellow_worker3_build_0929' },
});
export const BATCHES = Object.freeze({
  'fit-0930e': Object.freeze({label:'Capacity-fit concrete CDP test-file trial',
    sessions:Object.freeze({'worker-1':'yellow_worker1_micro_0929c',
      'worker-2':'yellow_worker2_micro_0929c','worker-3':'yellow_worker3_micro_0929c'}),
    steps:Object.freeze({'worker-1':2,'worker-2':0,'worker-3':0})}),
  '0929': Object.freeze({label:'Previous public PR review batch',
    sessions:Object.freeze(Object.fromEntries(Object.entries(WORKERS).map(([id,v])=>[id,v.session]))),
    steps:Object.freeze({'worker-1':5,'worker-2':3,'worker-3':2})}),
  'build-0929b': Object.freeze({label:'Yellow build proposals — batch build-0929b',
    sessions:Object.freeze({'worker-1':'yellow_worker1_build_0929b',
      'worker-2':'yellow_worker2_login_0929b','worker-3':'yellow_worker3_build_0929b'}),
    steps:Object.freeze({'worker-1':2,'worker-2':4,'worker-3':2})}),
  'micro-0929c': Object.freeze({label:'Qwen pinpointed proposals — batch micro-0929c',
    sessions:Object.freeze({'worker-1':'yellow_worker1_micro_0929c',
      'worker-2':'yellow_worker2_micro_0929c','worker-3':'yellow_worker3_micro_0929c'}),
    steps:Object.freeze({'worker-1':4,'worker-2':6,'worker-3':4})}),
});
const hash = value => createHash('sha256').update(value).digest('hex');
const safeError = () => new Error('Private worker operation failed; credentials and raw errors withheld');
export function approvedBatch(batch='0929') {
  if (!Object.hasOwn(BATCHES,batch)) throw safeError();
  return BATCHES[batch];
}
const enrollmentPath = (id,batch) => path.join(ROOT, `${id}-jobs-${batch}-enrollment.json`);

function browserValue(session, selector) {
  return new Promise((resolve, reject) => {
    const child = spawn(BROWSER, ['--session', session, 'get', 'value', '--selector', selector],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let count = 0, finished = false;
    const fail = () => { if (!finished) { finished = true; clearTimeout(timer); child.kill(); reject(safeError()); } };
    const timer = setTimeout(fail, BROWSER_CAPTURE_MS);
    child.once('error', fail); child.stderr.resume();
    child.stdout.on('data', chunk => { count += chunk.length; if (count > 8192) fail(); else chunks.push(chunk); });
    child.once('close', code => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (code !== 0) return reject(safeError());
      resolve(Buffer.concat(chunks).toString('utf8').trim());
    });
  });
}

export function validateEnrollment(v, id, now = Date.now(), batch='0929') {
  approvedBatch(batch);
  if(batch==='fit-0930e' && id!=='worker-1') throw safeError();
  const target = WORKERS[id];
  if (!Object.hasOwn(WORKERS,id) || !target || !v || Object.keys(v).sort().join(',') !== 'expiresAt,issuedAt,notebook,owner,protectedConnectionFile,version,workerId' || v.version !== 1 || v.workerId !== id || v.owner !== target.owner ||
      v.notebook !== target.notebook || v.protectedConnectionFile !== path.join(ROOT, 'credentials', `${id}-jobs-${batch}.dpapi`) ||
      !Number.isFinite(Date.parse(v.issuedAt)) || !Number.isFinite(Date.parse(v.expiresAt)) ||
      Date.parse(v.issuedAt) > now || Date.parse(v.expiresAt) <= now ||
      Date.parse(v.expiresAt) - Date.parse(v.issuedAt) > 86400000 || Date.parse(v.expiresAt) <= Date.parse(v.issuedAt)) throw safeError();
  return v;
}

export async function enroll(id, selector, batch='0929') {
  const config=approvedBatch(batch);
  if(batch==='fit-0930e' && id!=='worker-1') throw safeError();
  if (!Object.hasOwn(WORKERS,id) || !/^\.drawer-outer-container input(?:\[id="[a-zA-Z0-9:_-]+"\])?$/.test(selector ?? '')) throw safeError();
  const value = await browserValue(config.sessions[id], selector);
  const token = privateKaggleBase(value).href;
  const stamp = Date.now();
  const issuedAt = new Date(stamp).toISOString(), expiresAt = new Date(stamp + 86400000).toISOString();
  const protectedConnectionFile = path.join(ROOT, 'credentials', `${id}-jobs-${batch}.dpapi`);
  // Fresh enrollment names preserve the previous Worker 1 proof/credential.
  if (existsSync(enrollmentPath(id,batch)) || existsSync(protectedConnectionFile)) throw safeError();
  await persistBridgeCredential(protectedConnectionFile, { token, expiresAt });
  const v = { version: 1, workerId: id, owner: WORKERS[id].owner, notebook: WORKERS[id].notebook,
    protectedConnectionFile, issuedAt, expiresAt };
  writeFileSync(enrollmentPath(id,batch), JSON.stringify(v), { flag: 'wx', mode: 0o600 });
  return { workerId: id, batchId:batch, encrypted: true, expiresAt, publicRelay: false };
}

function connection(id,batch) {
  approvedBatch(batch);
  if (!Object.hasOwn(WORKERS,id)) throw safeError();
  const read = () => validateEnrollment(JSON.parse(readFileSync(enrollmentPath(id,batch), 'utf8')), id,Date.now(),batch);
  const original = read();
  return async () => {
    if (JSON.stringify(read()) !== JSON.stringify(original)) throw safeError();
    return readBridgeCredential(original.protectedConnectionFile);
  };
}

export async function probe(id,batch='0929') {
  return { workerId: id, batchId:batch, ...await createPrivateKaggleJupyter({ readConnection: connection(id,batch) }).probe() };
}

export function existingMetadataKernelId(kernels) {
  if (!Array.isArray(kernels)) throw safeError();
  const python=kernels.filter(k=>k?.name==='python3');
  if (python.length!==1 || !['idle','starting'].includes(python[0].state) ||
      typeof python[0].id!=='string' ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(python[0].id)) throw safeError();
  return python[0].id;
}

export async function wire(id,batch='0929') {
  const readConnection=connection(id,batch);
  const p=await createPrivateKaggleJupyter({readConnection}).probe();
  const kernelId=existingMetadataKernelId(p.kernels);
  const prefix=path.join(ROOT,'artifacts',`${id}-jobs-${batch}-wire`);
  mkdirSync(path.dirname(prefix),{recursive:true});
  const claim={workerId:id,batchId:batch,kernelId,operation:'kernel_info_request',
    issuedAt:new Date().toISOString(),codeExecuted:false};
  writeFileSync(prefix+'-claim.json',JSON.stringify(claim),{flag:'wx',mode:0o600});
  try {
    const result=await inspectExistingKernelWire({readConnection,kernelId});
    writeFileSync(prefix+'-result.json',JSON.stringify({...claim,...result}),{flag:'wx',mode:0o600});
    return {workerId:id,batchId:batch,...result,codeExecuted:false};
  } catch {
    writeFileSync(prefix+'-unconfirmed.json',JSON.stringify(claim),{flag:'wx',mode:0o600});
    throw safeError();
  }
}

export async function resources(id,batch='0929') {
  const readConnection = connection(id,batch);
  const p = await createPrivateKaggleJupyter({ readConnection }).probe();
  const kernel = p.kernels.find(k => k.name === 'python3' && k.state === 'idle');
  if (!kernel || p.kernels.filter(k => k.name === 'python3').length !== 1) throw safeError();
  const source = `import os, shutil, json, subprocess\nfrom pathlib import Path\n_yellow_owned_result = {'schema':'yellow-worker-resources-0929-v1','cpuCount':os.cpu_count(),'workingFreeBytes':shutil.disk_usage('/kaggle/working').free}\n_yellow_owned_result['memory']={line.split(':')[0]:int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemTotal:','MemAvailable:'))}\n_g=subprocess.run(['nvidia-smi','--query-gpu=name,memory.total,memory.free','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=10,check=True)\n_yellow_owned_result['gpus']=[line.strip() for line in _g.stdout.splitlines()][:4]\n_yellow_owned_result['files']={str(p):p.is_file() for p in [Path('/kaggle/working/yellow-qwen38/weights/Qwen3.8-27B-UD-Q4_K_M.gguf'),Path('/kaggle/working/yellow-qwen38/runtime-source-b11216/llama-cli'),Path('/tmp/yellow-llama-source-b11216/build/bin/llama-cli'),Path('/root/.cache/huggingface/yellow-qwen38/Qwen3.8-27B-UD-Q4_K_M.gguf')]}\n`;
  const sourceDigest = hash(source), requestId = randomUUID();
  const artifacts = path.join(ROOT, 'artifacts'); mkdirSync(artifacts, { recursive: true });
  const prefix = path.join(artifacts, `${id}-jobs-${batch}-resources`);
  const claim = { workerId: id, batchId:batch, kernelId: kernel.id, requestId, sourceDigest, issuedAt: new Date().toISOString() };
  writeFileSync(prefix + '-claim.json', JSON.stringify(claim), { flag: 'wx', mode: 0o600 });
  try {
    const result = await executeOwnedDiagnostic({ readConnection, kernelId: kernel.id, source, sourceDigest,
      expectedDigest: sourceDigest, requestId, timeoutMs: 30000 });
    writeFileSync(prefix + '-result.json', JSON.stringify({ ...claim, ...result }), { flag: 'wx', mode: 0o600 });
    return { workerId: id, batchId:batch, resourceCheck: result.result, modelReady: false, completedAssignedJobs: 0 };
  } catch (e) {
    writeFileSync(prefix + '-unconfirmed.json', JSON.stringify({ ...claim, executionUnconfirmed: e.executionUnconfirmed ?? true,
      failureCode: e.failureCode ?? 'unknown', remoteErrorType: e.remoteErrorType ?? null }), { flag: 'wx', mode: 0o600 });
    throw safeError();
  }
}

export function fixedJobSource(id, mode,batch='0929') {
  approvedBatch(batch);
  if(batch==='fit-0930e') throw safeError(); // Dedicated packet operator only; never dispatch an old job.
  if (!Object.hasOwn(WORKERS,id) || !['start','status','details','inspect-runtime','recover-runtime','finish-source-review','proposal','confirm-no-job','start-successor'].includes(mode)) throw safeError();
  if (['confirm-no-job','start-successor'].includes(mode) && (id!=='worker-1' || batch!=='micro-0929c')) throw safeError();
  const operation=mode==='confirm-no-job'?'status':mode==='start-successor'?'start':mode;
  // Fixed source only. Current source's AST equivalence is tested; no model text
  // is compacted/executed and the transport's 40KB maximum remains unchanged.
  const body=readFileSync(new URL('./owned-job.py',import.meta.url),'utf8')
    .split(/\r?\n/).filter(line=>line.trim() && !/^\s*#/.test(line)).join('\n')+'\n';
  const source=`_yellow_job_operation = ${JSON.stringify(operation)}\n_yellow_job_worker = ${JSON.stringify(id)}\n_yellow_job_batch = ${JSON.stringify(batch)}\n`+body;
  if (Buffer.byteLength(source)>40000) throw safeError();
  return source;
}

export function assertSuccessorProof(failure, original, proof, id,batch,kernelId) {
  const diagnostic=fixedJobSource(id,'confirm-no-job',batch);
  if (id!=='worker-1'||batch!=='micro-0929c'||Buffer.byteLength(original)<=40000||
      failure?.workerId!==id||failure?.batchId!==batch||failure?.kernelId!==kernelId||
      failure?.mode!=='start'||failure?.sourceDigest!==hash(original)||
      failure?.failureCode!=='unknown'||failure?.remoteErrorType!==null||
      proof?.workerId!==id||proof?.batchId!==batch||proof?.kernelId!==kernelId||
      proof?.mode!=='confirm-no-job'||proof?.sourceDigest!==hash(diagnostic)||
      !Number.isFinite(Date.parse(failure?.issuedAt))||!Number.isFinite(Date.parse(proof?.issuedAt))||
      Date.parse(proof.issuedAt)<Date.parse(failure.issuedAt)||
      proof?.result?.batchId!==batch||proof?.result?.state!=='no_job'||proof?.result?.completedSteps!==0) throw safeError();
}

export async function jobOperation(id, mode,batch='0929') {
  approvedBatch(batch);
  // Preflight BEFORE connection access or reserving a claim.
  const source=fixedJobSource(id,mode,batch);
  const readConnection = connection(id,batch);
  const p = await createPrivateKaggleJupyter({ readConnection }).probe();
  const kernel = p.kernels.find(k => k.name === 'python3' && k.state === 'idle');
  if (!kernel || p.kernels.filter(k => k.name === 'python3').length !== 1) throw safeError();
  const sourceDigest = hash(source), requestId = randomUUID();
  const artifacts = path.join(ROOT, 'artifacts'); mkdirSync(artifacts, { recursive: true });
  if(mode==='start-successor') {
    const old=path.join(artifacts,`${id}-jobs-${batch}-start`);
    const proof=path.join(artifacts,`${id}-jobs-${batch}-confirm-no-job-result.json`);
    assertSuccessorProof(JSON.parse(readFileSync(old+'-unconfirmed.json','utf8')),
      readFileSync(old+'-source.py','utf8'),JSON.parse(readFileSync(proof,'utf8')),id,batch,kernel.id);
  }
  const once = ['start','recover-runtime','finish-source-review','confirm-no-job','start-successor'].includes(mode);
  const prefix = path.join(artifacts, `${id}-jobs-${batch}-${once ? mode : `status-${requestId}`}`);
  const claim = { workerId: id, batchId:batch, kernelId: kernel.id, requestId, sourceDigest, mode, issuedAt: new Date().toISOString() };
  // Preserve the exact dispatched source and single-use claim before any send.
  writeFileSync(prefix + '-source.py', source, { flag: 'wx', mode: 0o600 });
  writeFileSync(prefix + '-claim.json', JSON.stringify(claim), { flag: 'wx', mode: 0o600 });
  try {
    const result = await executeOwnedDiagnostic({ readConnection, kernelId: kernel.id, source, sourceDigest,
      expectedDigest: sourceDigest, requestId, timeoutMs: 30000 });
    writeFileSync(prefix + '-result.json', JSON.stringify({ ...claim, ...result }), { flag: 'wx', mode: 0o600 });
    return { workerId: id, batchId:batch, ...result.result, automaticDispatchReady: false };
  } catch (e) {
    writeFileSync(prefix + '-unconfirmed.json', JSON.stringify({ ...claim, executionUnconfirmed: e.executionUnconfirmed ?? true,
      failureCode: e.failureCode ?? 'unknown', remoteErrorType: e.remoteErrorType ?? null }), { flag: 'wx', mode: 0o600 });
    throw safeError();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, id, arg, batchArg] = process.argv.slice(2);
    const batch=(mode==='enroll'?batchArg:arg) ?? '0929';
    const result = mode === 'enroll' ? await enroll(id, arg,batch) : mode === 'probe' ? await probe(id,batch) : mode==='wire'?await wire(id,batch):
      mode === 'resources' ? await resources(id,batch) : ['start', 'status', 'details', 'inspect-runtime', 'recover-runtime', 'finish-source-review', 'proposal','confirm-no-job','start-successor'].includes(mode) ? await jobOperation(id, mode,batch) : (() => { throw safeError(); })();
    console.log(JSON.stringify(result));
  } catch { console.error('Private worker operation failed or unconfirmed; no retry, fallback or shared-kernel stop.'); process.exitCode = 1; }
}
