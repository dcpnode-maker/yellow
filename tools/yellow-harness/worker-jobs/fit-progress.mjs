import http from 'node:http';
import {existsSync,writeFileSync,renameSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fitOperation} from './fit-operator.mjs';
const CONTROL='E:/YellowWorkspace/ControlPlane';
export function summarizeFit(v={},now=Date.now()) {
 const exact=v.workerId==='worker-1'&&v.batchId==='fit-0930e';
 const fresh=exact&&Number.isFinite(Date.parse(v.observedAt))&&
  now-Date.parse(v.observedAt)>=0&&now-Date.parse(v.observedAt)<=180000&&!v.observationStopped;
 const terminal=exact&&['failed','completed_unaccepted'].includes(v.state);
 const completed=exact&&Number.isInteger(v.completedSteps)&&v.completedSteps>=0&&v.completedSteps<=2?v.completedSteps:0;
 return {batchId:'fit-0930e',scope:'One concrete CDP test-file trial, not Yellow completion',
  observedAt:v.observedAt??null,fresh,activeJobs:fresh&&v.state==='running'?1:0,
  worker1State:fresh?v.state:'unknown',phase:fresh?v.phase:'unknown',
  terminal,observationStopped:!!v.observationStopped,
  completedSteps:completed,totalSteps:2,percent:completed*50,
  nativeCompilePercent:fresh&&Number.isInteger(v.nativeCompilePercent)?v.nativeCompilePercent:null,
  smokeVerified:exact&&v.smokeVerified===true,proofHistorical:!fresh,
  completeProposal:terminal&&v.state==='completed_unaccepted',acceptedWork:0,
  otherWorkers:'Workers 2/3 not admitted to this trial; previous sessions stopped',
  modelCallsMadeByViewer:0};
}
export function startFitProgress({port=38887}={}) {
 let value={},busy=false;
 function retain() {
  const v=summarizeFit(value),target=path.join(CONTROL,'worker-live-status.json'),temp=target+'.'+randomUUID()+'.tmp';
  const state={UpdatedUtc:new Date().toISOString(),Scope:v.scope,ModelCallsMadeByViewer:0,AutomaticResume:false,
   Workers:[{Name:'worker-1',State:`${v.phase}; ${v.worker1State}; Qwen smoke ${v.smokeVerified?'verified':'pending'}${v.nativeCompilePercent!==null?'; native compile '+v.nativeCompilePercent+'%':''}`,
    AssignedSteps:2,CompletedSteps:v.completedSteps,Percent:v.percent,ObservedAt:v.observedAt,ObservationStopped:v.observationStopped},
    ...['worker-2','worker-3'].map(Name=>({Name,State:'not admitted; previous session stopped',AssignedSteps:0,CompletedSteps:0,Percent:null,ObservedAt:null,ObservationStopped:true}))]};
  writeFileSync(temp,JSON.stringify(state,null,2),{flag:'wx'});renameSync(temp,target);
 }
 async function poll() {
  if(busy||value.observationStopped||['failed','completed_unaccepted'].includes(value.state))return;
  if(!existsSync('D:/Yellow/harness/state-workspace/artifacts/worker-1-jobs-fit-0930e-prepare-result.json'))return;
  busy=true;
  try {value={...await fitOperation('worker-1','status'),observedAt:new Date().toISOString()};}
  catch {value={...value,workerId:'worker-1',batchId:'fit-0930e',observationStopped:true};}
  finally {busy=false;retain();}
 }
 const timer=setInterval(()=>void poll(),60000);
 const server=http.createServer((req,res)=>{
  if(req.method!=='GET'||req.url!=='/status'){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(summarizeFit(value)));
 });
 server.on('close',()=>clearInterval(timer));server.on('error',()=>clearInterval(timer));
 server.listen(port,'127.0.0.1',()=>void poll());return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 startFitProgress();console.log('Capacity-fit trial minute observer: http://127.0.0.1:38887/status; zero viewer model calls');
}
