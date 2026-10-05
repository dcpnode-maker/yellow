import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildPacket,assertPacket,fitSource,assertRetainedProposal} from './fit-operator.mjs';
import {summarizeFit} from './fit-progress.mjs';
test('minute observer distinguishes fresh active trial from stale and historical batches',()=>{
 const now=Date.parse('2026-09-30T12:00:00Z'),v={workerId:'worker-1',batchId:'fit-0930e',
  observedAt:new Date(now).toISOString(),state:'running',phase:'native-runtime',completedSteps:1,smokeVerified:false,nativeCompilePercent:50};
 assert.equal(summarizeFit(v,now).activeJobs,1);assert.equal(summarizeFit(v,now).percent,50);
 assert.equal(summarizeFit(v,now).smokeVerified,false);
 for(const patch of [{batchId:'compat-0930d'},{observationStopped:true},{observedAt:new Date(now-180001).toISOString()}])
  assert.equal(summarizeFit({...v,...patch},now).activeJobs,0);
 const terminal=summarizeFit({...v,state:'completed_unaccepted',completedSteps:2,smokeVerified:true},now);
 assert.equal(terminal.activeJobs,0);assert.equal(terminal.acceptedWork,0);assert.equal(terminal.percent,100);
});
test('fixed packet and complete transport fit before any GPU operation',()=>{
 const p=buildPacket();assertPacket(p);
 for(const mode of ['prepare','status','result','proposal']) {
  const s=fitSource('worker-1',mode,p);assert.ok(Buffer.byteLength(s)<40000);
  const r=spawnSync('python',['-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:s,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.ok(s.includes("'--reasoning','off'"));
  assert.ok(s.includes("'4096'"));assert.ok(s.includes("'proposal',480"));
  assert.ok(s.includes("remaining=3600-"));assert.ok(!s.includes("_yellow_compat_operation"));
 }
 for(const mode of ['exec','restart','release','proposal-0'])assert.throws(()=>fitSource('worker-1',mode,p));
 for(const id of ['worker-2','worker-3','__proto__'])assert.throws(()=>fitSource(id,'prepare',p));
 for(const patch of [{publicSourceSha:'0'.repeat(40)},{contextTokens:8192},{outputTokens:1024},
  {prompt:p.prompt+'bad'},{sources:[]}])assert.throws(()=>assertPacket({...p,...patch}));
});
test('retained full text never implies execution or acceptance',()=>{
 const text='inert full output';
 const v={workerId:'worker-1',batchId:'fit-0930e',taskId:'cdp-complete-regressions',text,
  sha256:createHash('sha256').update(text).digest('hex'),accepted:false,generatedCodeExecuted:false,sourceApplied:false};
 assertRetainedProposal(v);
 for(const patch of [{text:'truncated'},{sha256:'0'.repeat(64)},{accepted:true},{generatedCodeExecuted:true},
  {sourceApplied:true},{workerId:'worker-2'}])assert.throws(()=>assertRetainedProposal({...v,...patch}));
});
test('native cache is a new verified complete file set, not overwriting old failures',()=>{
 const s=fitSource('worker-1','status');
 for(const marker of ['if CACHE.exists(): raise ValueError','exist_ok=False','is_relative_to(build.resolve())',
  "digest(target)!=sha","'manifest.json').open('x')",'runtimeCacheManifestSha256',
  "job['thread'].is_alive() or job['processes']",'no truncation'])assert.ok(s.includes(marker),marker);
 assert.ok(!s.includes('exec(text)'));assert.ok(!s.includes('eval(text)'));
});
