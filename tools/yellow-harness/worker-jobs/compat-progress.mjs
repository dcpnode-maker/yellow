import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync,writeFileSync,renameSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {compatOperation} from './compat-operator.mjs';
const ROOT='D:/Yellow/harness/state-workspace',CONTROL='E:/YellowWorkspace/ControlPlane';
const STEPS=Object.freeze({'worker-1':4,'worker-2':6,'worker-3':4});
const PHASES=new Set(['starting','public-source-fetch','testing','model-weights','native-runtime',
 'native-runtime-correction','waiting-for-worker1','model-smoke','model-review','completed','failed','connection-unavailable','waiting-for-session']);
export function summarizeCompat(raw={}) {
 const workers=Object.entries(STEPS).map(([workerId,totalSteps])=>{
  const v=raw[workerId]?.workerId===workerId&&raw[workerId]?.batchId==='compat-0930d'?raw[workerId]:{};
  return {workerId,totalSteps,completedSteps:Number.isInteger(v.completedSteps)&&v.completedSteps>=0&&v.completedSteps<=totalSteps?v.completedSteps:0,
   phase:PHASES.has(v.phase)?v.phase:'waiting-for-session',terminal:['failed','completed_unaccepted'].includes(v.state),
   modelReady:v.runtimeVerified===true&&v.weightsVerified===true&&v.smokeVerified===true,
   nativeCompilePercent:Number.isInteger(v.nativeCompilePercent)&&v.nativeCompilePercent>=0&&v.nativeCompilePercent<=100?v.nativeCompilePercent:null,
   observedAt:typeof v.observedAt==='string'?v.observedAt:null,observationStopped:v.observationStopped===true,
   tests:Array.isArray(v.tests)?v.tests.slice(0,totalSteps-3).map(t=>({
    target:typeof t.target==='string'&&/^tests\/[a-zA-Z0-9_.-]+\.test\.ts$/.test(t.target)?t.target:'fixed test',
    state:t.returncode===0?'passed':'failed'})):[],acceptedFix:false};
 });
 const completedSteps=workers.reduce((a,w)=>a+w.completedSteps,0);
 return {schema:'yellow-kaggle-progress-v1',batchId:'compat-0930d',label:'Native Qwen public test/review batch',
  totalSteps:14,completedSteps,percent:Math.round(completedSteps/14*1000)/10,workers};
}
export function shouldPollCompat(v){return !v?.observationStopped&&!['failed','completed_unaccepted'].includes(v?.state);}
export function startCompatProgress({port=38886}={}) {
 const states={},busy=new Set();
 function retain() {
  const v=summarizeCompat(states),value={UpdatedUtc:new Date().toISOString(),Scope:'compat-0930d finite test/review batch; not ecosystem completion',ModelCallsMadeByViewer:0,
   Workers:v.workers.map(w=>({Name:w.workerId,State:`${w.phase}; Qwen inference ${w.modelReady?'verified':'not yet verified'}${w.nativeCompilePercent!==null?'; native compile '+w.nativeCompilePercent+'%':''}`,
    AssignedSteps:w.totalSteps,CompletedSteps:w.completedSteps,Percent:Math.round(w.completedSteps/w.totalSteps*1000)/10,ObservedAt:w.observedAt,ObservationStopped:w.observationStopped})),
   PriorFailedBatch:'build-0929b and micro-0929c failures retained; no replay',AutomaticResume:false};
  const target=path.join(CONTROL,'worker-live-status.json'),temp=target+'.'+randomUUID()+'.tmp';
  writeFileSync(temp,JSON.stringify(value,null,2),{flag:'wx'});renameSync(temp,target);
 }
 async function poll(id) {
  if(busy.has(id)||!shouldPollCompat(states[id]))return;
  const prefix=path.join(ROOT,'artifacts',`${id}-jobs-compat-0930d`);
  if(!existsSync(prefix+'-prepare-result.json')||!existsSync(prefix+'-repair-native-target-result.json'))return;
  busy.add(id);
  try {states[id]={...await compatOperation(id,'status'),observedAt:new Date().toISOString()};}
  catch {states[id]={...states[id],workerId:id,batchId:'compat-0930d',phase:'connection-unavailable',observationStopped:true};}
  finally {busy.delete(id);retain();}
 }
 const timer=setInterval(()=>{for(const id of Object.keys(STEPS))void poll(id);},60000);
 const server=http.createServer((req,res)=>{
  if(req.method!=='GET'||req.url!=='/status'){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(summarizeCompat(states)));
 });
 server.on('close',()=>clearInterval(timer));server.on('error',()=>clearInterval(timer));
 server.listen(port,'127.0.0.1',()=>{for(const id of Object.keys(STEPS))void poll(id);});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 startCompatProgress();console.log('Read-only minute worker observation: http://127.0.0.1:38886/status; 0 model calls');
}
