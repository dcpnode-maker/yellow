import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {validateEnrollment,WORKERS} from './operator.mjs';
import {readBridgeCredential} from 'file:///D:/Yellow/harness/adapters/t3/windows-secrets.mjs';
import {createPrivateKaggleJupyter,executeOwnedDiagnostic} from 'file:///D:/Yellow/harness/adapters/t3/kaggle-jupyter.mjs';
const ROOT='D:/Yellow/harness/state-workspace',BATCH='compat-0930d';
const hash=v=>createHash('sha256').update(v).digest('hex');
const INSPECT=`import os,json,hashlib,platform,subprocess\nfrom pathlib import Path\n_p=Path('/kaggle/working/yellow-qwen38/runtime-source-b11216/llama-cli')\n_yellow_owned_result={'schema':'yellow-native-runtime-inspection-v1','glibc':platform.libc_ver(),'candidatePresent':_p.is_file(),'candidateSymlink':_p.is_symlink()}\nif _p.is_file() and not _p.is_symlink():\n _yellow_owned_result['binarySha256']=hashlib.file_digest(_p.open('rb'),'sha256').hexdigest()\n _r=subprocess.run([str(_p),'--list-devices'],capture_output=True,text=True,timeout=30,check=False)\n _yellow_owned_result['devicesExit']=_r.returncode\n _yellow_owned_result['devicesOutput']=(_r.stdout+_r.stderr)[-4096:]\n`;
export function compatSource(id,mode) {
  if(!Object.hasOwn(WORKERS,id)||!['inspect','prepare','status','release','result','repair-native-target','proposal-0','proposal-1','proposal-2'].includes(mode))throw Error('Invalid fixed operation');
  const source=mode==='inspect'?INSPECT:`_yellow_compat_worker=${JSON.stringify(id)}\n_yellow_compat_operation=${JSON.stringify(mode)}\n`+readFileSync(new URL('./compat-job.py',import.meta.url),'utf8');
  if(Buffer.byteLength(source)>40000)throw Error('Fixed source over transport budget');
  return source;
}
export function assertModelGate(proof) {
  const v=proof?.result;
  if(proof?.workerId!=='worker-1'||proof?.batchId!==BATCH||proof?.mode!=='status'||
    proof?.sourceDigest!==hash(compatSource('worker-1','status'))||
    v?.workerId!=='worker-1'||v?.batchId!==BATCH||
    v?.sourceSha!=='d708ff29e2e44df74a5c1a12e58a8cf656b14c8d'||
    v?.sourceVerified!==true||v?.weightsVerified!==true||v?.runtimeVerified!==true||v?.smokeVerified!==true||
    v?.generatedCodeExecuted!==false||v?.sourceApplied!==false)throw Error('Actual Worker1 model proof required');
}
export function assertRepairProof(proof,id,kernelId) {
  const v=proof?.result?.state;
  if(proof?.workerId!==id||proof?.batchId!==BATCH||proof?.mode!=='result'||proof?.kernelId!==kernelId||
    v?.workerId!==id||v?.batchId!==BATCH||v?.state!=='failed'||v?.errorType!=='RuntimeError'||
    v?.sourceVerified!==true||v?.weightsVerified!==true||v?.runtimeVerified!==false||v?.smokeVerified!==false||
    v?.nativeTargetRepair||v?.generatedCodeExecuted!==false||v?.sourceApplied!==false||
    !Array.isArray(proof.result.ownedProcesses)||proof.result.ownedProcesses.length!==0||
    !proof.result.logs?.['runtime-build']?.includes("No rule to make target 'llama-cli'"))
    throw Error('Retained exact terminal CLI-target failure required');
}
export async function compatOperation(id,mode) {
  const source=compatSource(id,mode);
  const metadata=path.join(ROOT,`${id}-jobs-micro-0929c-enrollment.json`);
  const original=readFileSync(metadata,'utf8');
  const get=()=>{if(readFileSync(metadata,'utf8')!==original)throw Error('Enrollment changed');return validateEnrollment(JSON.parse(original),id,Date.now(),'micro-0929c');};
  const readConnection=async()=>readBridgeCredential(get().protectedConnectionFile);
  const p=await createPrivateKaggleJupyter({readConnection}).probe();
  const kernels=p.kernels.filter(k=>k.name==='python3');
  if(kernels.length!==1||kernels[0].state!=='idle')throw Error('Exact idle kernel required');
  const artifactRoot=path.join(ROOT,'artifacts');mkdirSync(artifactRoot,{recursive:true});
  const requestId=randomUUID(),once=['inspect','prepare','release','repair-native-target'].includes(mode);
  const prefix=path.join(artifactRoot,`${id}-jobs-${BATCH}-${once?mode:mode+'-'+requestId}`);
  let predecessor=null;
  if(mode==='repair-native-target') {
    const pointer=JSON.parse(readFileSync(path.join(ROOT,`${BATCH}-${id}-terminal.json`),'utf8'));
    if(typeof pointer.file!=='string'||!new RegExp(`^${id}-jobs-compat-0930d-result-[a-f0-9-]{36}-result\\.json$`).test(pointer.file))throw Error('Exact terminal receipt path required');
    const raw=readFileSync(path.join(artifactRoot,pointer.file),'utf8'),proof=JSON.parse(raw);
    const proofSource=readFileSync(path.join(artifactRoot,pointer.file.replace(/-result\.json$/,'-source.py')),'utf8');
    if(hash(proofSource)!==proof.sourceDigest)throw Error('Retained source digest differs');
    assertRepairProof(proof,id,kernels[0].id);predecessor={file:pointer.file,sha256:hash(raw)};
  }
  if(mode==='release') {
    if(id==='worker-1')throw Error('No release for Worker1');
    const pointer=JSON.parse(readFileSync(path.join(ROOT,'compat-0930d-worker-1-observation.json'),'utf8'));
    if(typeof pointer.file!=='string'||!/^worker-1-jobs-compat-0930d-status-[a-f0-9-]{36}-result\.json$/.test(pointer.file))throw Error('Exact proof path required');
    const proof=JSON.parse(readFileSync(path.join(artifactRoot,pointer.file),'utf8'));assertModelGate(proof);
  }
  const sourceDigest=hash(source),claim={workerId:id,batchId:BATCH,mode,kernelId:kernels[0].id,requestId,sourceDigest,issuedAt:new Date().toISOString(),...(predecessor?{predecessor}:{})};
  writeFileSync(prefix+'-source.py',source,{flag:'wx'});writeFileSync(prefix+'-claim.json',JSON.stringify(claim),{flag:'wx'});
  try {
    const result=await executeOwnedDiagnostic({readConnection,kernelId:kernels[0].id,source,sourceDigest,expectedDigest:sourceDigest,requestId,timeoutMs:45000});
    writeFileSync(prefix+'-result.json',JSON.stringify({...claim,...result}),{flag:'wx'});
    if(mode==='status')writeFileSync(path.join(ROOT,`${BATCH}-${id}-observation.json`),JSON.stringify({file:path.basename(prefix+'-result.json'),observedAt:new Date().toISOString()}));
    if(mode==='result')writeFileSync(path.join(ROOT,`${BATCH}-${id}-terminal.json`),JSON.stringify({file:path.basename(prefix+'-result.json'),observedAt:new Date().toISOString()}));
    return {workerId:id,batchId:BATCH,...result.result};
  } catch(e) {
    writeFileSync(prefix+'-unconfirmed.json',JSON.stringify({...claim,executionUnconfirmed:e.executionUnconfirmed??true,failureCode:e.failureCode??'unknown',remoteErrorType:e.remoteErrorType??null}),{flag:'wx'});throw Error('Private fixed operation failed; retain claim, no retry');
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(await compatOperation(process.argv[3],process.argv[2])));}catch{console.error('Bounded compatibility operation unavailable; no replay or fallback');process.exitCode=1;}
}
