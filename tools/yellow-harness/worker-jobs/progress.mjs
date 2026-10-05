import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { jobOperation, approvedBatch } from './operator.mjs';

const PHASES = new Set(['starting','public-source-fetch','test-runtime','testing','model-weights',
  'model-runtime-build','model-runtime-recovery','model-runtime-download','model-smoke','model-review','completed','failed','waiting-for-session','connection-unavailable']);
export function shouldPollWorker(v,id) {
  if (v?.observationStopped === true) return false;
  if (v?.state === 'completed_unaccepted') return false;
  if (v?.state !== 'failed') return true;
  if (v.batchId === 'micro-0929c' || v.batchId === 'build-0929b') return false;
  return (v.errorType === 'TimeoutExpired' && !v.recoveryAttempts) ||
    (id === 'worker-3' && v.errorType === 'FileNotFoundError' && v.recoveryAttempts === 1 && !v.sourcePathRepair);
}
export function pollAdmission({enrolled,startConfirmed,successorConfirmed,startUnconfirmed}) {
  return !!enrolled && (!!successorConfirmed || !!startConfirmed && !startUnconfirmed);
}
export function summarize(raw = {},batch='0929') {
  const config=approvedBatch(batch);
  const workers = Object.entries(config.steps).map(([workerId,totalSteps]) => {
    const observed=raw[workerId] ?? {};
    const v = observed.batchId===batch || batch==='0929' && !observed.batchId ? observed : {};
    const completedSteps = Number.isInteger(v.completedSteps) && v.completedSteps >= 0 && v.completedSteps <= totalSteps
      ? v.completedSteps : 0;
    const tests = Array.isArray(v.tests) ? v.tests.slice(0,totalSteps-1).map(t => ({
      target: typeof t.test === 'string' && /^tests\/[a-zA-Z0-9_.-]+\.test\.ts$/.test(t.test) ? t.test : 'fixed test',
      state: t.returncode === 0 ? 'passed' : 'failed',
    })) : [];
    return {workerId,totalSteps,completedSteps,tests,
      phase: PHASES.has(v.phase) ? v.phase : 'waiting-for-session',
      observedAt: typeof v.observedAt === 'string' ? v.observedAt : null,
      modelReady: v.runtimeVerified === true && v.weightsVerified === true && (batch !== 'micro-0929c' || v.smokeVerified === true),
      terminal: ['completed_unaccepted','failed'].includes(v.state),
      acceptedFix: false};
  });
  const completedSteps = workers.reduce((n,v)=>n+v.completedSteps,0);
  const totalSteps=workers.reduce((n,v)=>n+v.totalSteps,0);
  return {schema:'yellow-kaggle-progress-v1',batchId:batch,label:config.label,completedSteps,totalSteps,
    percent:Math.round(completedSteps/totalSteps*1000)/10,workers};
}

const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Kaggle worker progress</title><style>body{font:16px system-ui;background:#11140e;color:#f5f8ef;max-width:850px;margin:48px auto;padding:0 24px}h1{font-size:30px}small,p{color:#b6c1a9}progress{width:100%;height:24px;accent-color:#b7ff2e}article{border:1px solid #35422a;border-radius:16px;margin:18px 0;padding:20px}h2{margin:0 0 12px;font-size:20px}.fail{color:#ffb58c}.ok{color:#b7ff2e}a{color:#b7ff2e}</style>
<h1>Kaggle worker progress</h1><h2 id="batch">Assigned batch</h2><h2 id="percent">Connecting…</h2><progress id="bar" max="10" value="0"></progress>
<p>Only assigned Kaggle test/review steps count. Setup does not. A finished step can fail; no model output is automatically applied.</p><main id="workers"></main><small id="fresh"></small>
<script>async function refresh(){try{const r=await fetch('/status',{cache:'no-store'});if(!r.ok)throw Error();const v=await r.json();document.getElementById('batch').textContent=v.label;document.getElementById('percent').textContent=v.percent+'% — '+v.completedSteps+'/'+v.totalSteps+' steps finished';document.getElementById('bar').max=v.totalSteps;document.getElementById('bar').value=v.completedSteps;const root=document.getElementById('workers');root.replaceChildren();for(const w of v.workers){const card=document.createElement('article');const h=document.createElement('h2');h.textContent=w.workerId.replace('worker-','Worker ');card.append(h);const p=document.createElement('p');p.textContent=w.phase.replaceAll('-',' ')+' · '+w.completedSteps+'/'+w.totalSteps+' steps · Qwen 27B '+(w.modelReady?'runtime checked':'not ready');card.append(p);for(const t of w.tests){const row=document.createElement('div');row.className=t.state==='passed'?'ok':'fail';row.textContent=t.state.toUpperCase()+' — '+t.target;card.append(row)}const stamp=document.createElement('small');stamp.textContent=w.observedAt?'Last checked: '+new Date(w.observedAt).toLocaleTimeString():'Awaiting first connection';card.append(stamp);root.append(card)}document.getElementById('fresh').textContent='Local read-only view · refreshes every 5 seconds · no public tunnel';}catch{document.getElementById('fresh').textContent='Status unavailable — last displayed values may be stale';}}refresh();setInterval(refresh,5000);</script></html>`;

export function startProgressServer({port=38885,batch='0929'} = {}) {
  const config=approvedBatch(batch);
  const states = {};
  const busy = new Set();
  async function poll(id) {
    if (busy.has(id) || !shouldPollWorker(states[id],id)) return;
    const prefix=`D:/Yellow/harness/state-workspace/artifacts/${id}-jobs-${batch}`;
    const successor=existsSync(prefix+'-start-successor-result.json');
    if (!pollAdmission({enrolled:existsSync(`D:/Yellow/harness/state-workspace/${id}-jobs-${batch}-enrollment.json`),
      startConfirmed:existsSync(prefix+'-start-result.json'),successorConfirmed:successor,
      startUnconfirmed:existsSync(prefix+'-start-unconfirmed.json')})) return;
    busy.add(id);
    try { states[id] = {...await jobOperation(id,'status',batch),observedAt:new Date().toISOString()}; }
    catch { states[id] = {...states[id],batchId:batch,phase:'connection-unavailable',observationStopped:true}; }
    finally { busy.delete(id); }
  }
  const timers = Object.keys(config.steps).map((id,i)=>setInterval(()=>void poll(id),15000+i*1000));
  for (const id of Object.keys(config.steps)) void poll(id);
  const server = http.createServer((req,res)=>{
    if (req.method !== 'GET' || !['/','/status'].includes(req.url)) {res.writeHead(404);res.end();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('Content-Type',req.url==='/status'?'application/json; charset=utf-8':'text/html; charset=utf-8');
    res.end(req.url==='/status'?JSON.stringify(summarize(states,batch)):PAGE);
  });
  server.on('close',()=>timers.forEach(clearInterval));
  server.on('error',()=>timers.forEach(clearInterval));
  server.listen(port,'127.0.0.1');
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const batch=process.argv[2] ?? '0929',port=Number(process.argv[3] ?? 38885);
  if (!Number.isInteger(port) || port<1 || port>65535) throw Error('Invalid loopback port');
  startProgressServer({batch,port});console.log(`Kaggle-only progress (${batch}): http://127.0.0.1:${port}`);
}
