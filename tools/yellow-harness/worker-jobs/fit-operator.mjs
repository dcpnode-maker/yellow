import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateEnrollment} from './operator.mjs';
import {readBridgeCredential} from 'file:///D:/Yellow/harness/adapters/t3/windows-secrets.mjs';
import {createPrivateKaggleJupyter,executeOwnedDiagnostic} from 'file:///D:/Yellow/harness/adapters/t3/kaggle-jupyter.mjs';
const ROOT='D:/Yellow/harness/state-workspace',BATCH='fit-0930e',ID='worker-1';
const hash=v=>createHash('sha256').update(v).digest('hex');
const publicPin='d708ff29e2e44df74a5c1a12e58a8cf656b14c8d';
export function buildPacket() {
 const r=spawnSync('python',[fileURLToPath(new URL('./work-packets.py',import.meta.url)),'--include-prompt'],
  {encoding:'utf8',timeout:30000,maxBuffer:100000,windowsHide:true});
 if(r.error||r.status!==0)throw Error('Local packet preflight failed before credential access');
 const packet=JSON.parse(r.stdout);assertPacket(packet);return packet;
}
export function assertPacket(packet) {
 if(packet?.publicSourceSha!==publicPin||packet?.taskId!=='cdp-complete-regressions'||
  typeof packet.prompt!=='string'||hash(packet.prompt)!==packet.promptSha256||
  Buffer.byteLength(packet.prompt)+256+4096>16384||
  packet.contextTokens!==16384||packet.outputTokens!==4096||
  packet.sources?.length!==2||packet.sources[0]?.path!=='tests/helpers/cdp-invoke.ts'||
  packet.sources[0]?.sha256!=='03bf797054eea82bbd9d78abbb13850883b92a052134bc6d94014cc4d5b3a474'||
  packet.sources[1]?.path!=='tests/cdp-invoke.test.ts'||
  packet.sources[1]?.sha256!=='c6715d6459fe4faf2a3d0becc180b9efeb30a3bc97348d4e54150acce3097556')
  throw Error('Exact complete public packet required');
}
function sliceBetween(body,start,end) {
 const a=body.indexOf(start),b=body.indexOf(end,a+start.length);
 if(a<0||b<0)throw Error('Trusted base definition markers changed');
 return body.slice(a,b);
}
export function fitSource(id,mode,packet) {
 if(id!==ID||!['prepare','status','result','proposal'].includes(mode))throw Error('Fixed Worker1 fit operation required');
 const base=readFileSync(new URL('./compat-job.py',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const definitions=sliceBetween(base,'import hashlib,','LANES=')+
  sliceBetween(base,'def digest(p):','def snapshot(job):')+
  sliceBetween(base,'def runner(job):','def model_review(job,');
 let data='';
 if(mode==='prepare') {assertPacket(packet);data='_yellow_fit_packet=json.loads('+JSON.stringify(JSON.stringify(packet))+')\n';}
 const source=definitions+data+'_yellow_fit_operation='+JSON.stringify(mode)+'\n'+
  readFileSync(new URL('./fit-job.py',import.meta.url),'utf8');
 if(Buffer.byteLength(source)>40000)throw Error('Fixed source transport preflight failed');
 return source;
}
export function assertRetainedProposal(v) {
 if(v?.workerId!==ID||v?.batchId!==BATCH||v?.taskId!=='cdp-complete-regressions'||
  typeof v.text!=='string'||Buffer.byteLength(v.text)>60000||hash(v.text)!==v.sha256||
  v.accepted!==false||v.generatedCodeExecuted!==false||v.sourceApplied!==false)
  throw Error('Full inert digest-bound proposal required');
}
function pointer(name,value) {
 const file=path.join(ROOT,name),temp=file+'.'+randomUUID()+'.tmp';
 writeFileSync(temp,JSON.stringify(value),{flag:'wx',mode:0o600});renameSync(temp,file);
}
export async function fitOperation(id,mode) {
 // Packet and transport preflights happen BEFORE private credentials or GPU dispatch.
 const source=fitSource(id,mode,mode==='prepare'?buildPacket():undefined);
 const metadata=path.join(ROOT,`${ID}-jobs-${BATCH}-enrollment.json`),original=readFileSync(metadata,'utf8');
 const get=()=>{if(readFileSync(metadata,'utf8')!==original)throw Error('Enrollment changed');
  return validateEnrollment(JSON.parse(original),ID,Date.now(),BATCH);};
 const readConnection=async()=>readBridgeCredential(get().protectedConnectionFile);
 const p=await createPrivateKaggleJupyter({readConnection}).probe();
 const kernels=p.kernels.filter(k=>k.name==='python3');
 if(kernels.length!==1||kernels[0].state!=='idle')throw Error('Exact idle kernel required');
 const artifacts=path.join(ROOT,'artifacts');mkdirSync(artifacts,{recursive:true});
 const requestId=randomUUID(),prefix=path.join(artifacts,`${ID}-jobs-${BATCH}-${mode==='prepare'?mode:mode+'-'+requestId}`);
 if(mode==='prepare'&&existsSync(prefix+'-claim.json'))throw Error('Prepare already claimed; no replay');
 const claim={workerId:ID,batchId:BATCH,mode,kernelId:kernels[0].id,requestId,
  sourceDigest:hash(source),issuedAt:new Date().toISOString()};
 writeFileSync(prefix+'-source.py',source,{flag:'wx',mode:0o600});
 writeFileSync(prefix+'-claim.json',JSON.stringify(claim),{flag:'wx',mode:0o600});
 try {
  const result=await executeOwnedDiagnostic({readConnection,kernelId:kernels[0].id,source,
   sourceDigest:claim.sourceDigest,expectedDigest:claim.sourceDigest,requestId,timeoutMs:45000});
  writeFileSync(prefix+'-result.json',JSON.stringify({...claim,...result}),{flag:'wx',mode:0o600});
  if(mode==='proposal')assertRetainedProposal(result.result);
  if(['prepare','status','result'].includes(mode))pointer(`${BATCH}-${ID}-observation.json`,
   {file:path.basename(prefix+'-result.json'),observedAt:new Date().toISOString()});
  return {workerId:ID,batchId:BATCH,...result.result,
   retainedFile:path.basename(prefix+'-result.json')};
 } catch(e) {
  writeFileSync(prefix+'-unconfirmed.json',JSON.stringify({...claim,executionUnconfirmed:e.executionUnconfirmed??true,
   failureCode:e.failureCode??'unknown',remoteErrorType:e.remoteErrorType??null}),{flag:'wx',mode:0o600});
  throw Error('Fixed private fit operation failed; preserve claim, no retry');
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  if(process.argv[2]==='preflight') {const p=buildPacket();console.log(JSON.stringify({taskId:p.taskId,
   promptSha256:p.promptSha256,sourceBytes:Buffer.byteLength(fitSource(ID,'prepare',p)),gpuUsed:false}));}
  else console.log(JSON.stringify(await fitOperation(process.argv[3],process.argv[2])));
 } catch {console.error('Bounded fit operation unavailable; no replay or fallback');process.exitCode=1;}
}
