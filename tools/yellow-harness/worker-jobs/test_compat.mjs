import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compatSource,assertModelGate,assertRepairProof} from './compat-operator.mjs';
import {createHash} from 'node:crypto';
import {summarizeCompat,shouldPollCompat} from './compat-progress.mjs';
test('progress counts only exact batch, never claims model readiness or retries ambiguity',()=>{
 const running={workerId:'worker-1',batchId:'compat-0930d',state:'running',phase:'native-runtime-correction',completedSteps:1,nativeCompilePercent:24,
  runtimeVerified:true,weightsVerified:true,smokeVerified:false,observedAt:'2026-09-30T11:00:00Z'};
 const v=summarizeCompat({'worker-1':running,'worker-2':{...running,workerId:'worker-2',completedSteps:100},'worker-3':{...running,workerId:'worker-3',batchId:'wrong'}});
 assert.equal(v.totalSteps,14);assert.equal(v.completedSteps,1);assert.equal(v.percent,7.1);
 assert.equal(v.workers[0].modelReady,false);assert.equal(v.workers[0].nativeCompilePercent,24);
 assert.equal(v.workers[2].phase,'waiting-for-session');assert.equal(v.workers[0].acceptedFix,false);
 assert.equal(shouldPollCompat(running),true);
 for(const state of ['failed','completed_unaccepted'])assert.equal(shouldPollCompat({...running,state}),false);
 assert.equal(shouldPollCompat({...running,observationStopped:true}),false);
});
test('only three exact identities and fixed bounded operations compile',()=>{
 for(const id of ['worker-1','worker-2','worker-3'])for(const mode of ['inspect','prepare','status','release','result','repair-native-target','proposal-0','proposal-1','proposal-2']) {
  const source=compatSource(id,mode);assert.ok(Buffer.byteLength(source)<40000);
  if(mode!=='inspect')assert.ok(source.startsWith('_yellow_compat_worker='+JSON.stringify(id)));
 }
 for(const id of ['worker-4','__proto__','other'])assert.throws(()=>compatSource(id,'prepare'));
 for(const mode of ['exec','start','restart','proposal-3','proposal--1'])assert.throws(()=>compatSource('worker-1',mode));
});
test('runtime correction requires a retained exact empty-process terminal failure',()=>{
 const proof={workerId:'worker-1',batchId:'compat-0930d',mode:'result',kernelId:'kernel1',
  result:{state:{workerId:'worker-1',batchId:'compat-0930d',state:'failed',errorType:'RuntimeError',
   sourceVerified:true,weightsVerified:true,runtimeVerified:false,smokeVerified:false,generatedCodeExecuted:false,sourceApplied:false},
   ownedProcesses:[],logs:{'runtime-build':"No rule to make target 'llama-cli'"}}};
 assertRepairProof(proof,'worker-1','kernel1');
 for(const change of [{kernelId:'other'},{mode:'status'},{workerId:'worker-3'}])assert.throws(()=>assertRepairProof({...proof,...change},'worker-1','kernel1'));
 for(const change of [{state:'running'},{nativeTargetRepair:true},{weightsVerified:false},{runtimeVerified:true}])
  assert.throws(()=>assertRepairProof({...proof,result:{...proof.result,state:{...proof.result.state,...change}}},'worker-1','kernel1'));
 assert.throws(()=>assertRepairProof({...proof,result:{...proof.result,ownedProcesses:[123]}},'worker-1','kernel1'));
});
test('no later worker inference without exact Worker1 actual model proof',()=>{
 const proof={workerId:'worker-1',batchId:'compat-0930d',mode:'status',
  sourceDigest:createHash('sha256').update(compatSource('worker-1','status')).digest('hex'),
  result:{workerId:'worker-1',batchId:'compat-0930d',sourceSha:'d708ff29e2e44df74a5c1a12e58a8cf656b14c8d',
   sourceVerified:true,weightsVerified:true,runtimeVerified:true,smokeVerified:true,generatedCodeExecuted:false,sourceApplied:false}};
 assertModelGate(proof);
 for(const key of ['sourceVerified','weightsVerified','runtimeVerified','smokeVerified'])
  assert.throws(()=>assertModelGate({...proof,result:{...proof.result,[key]:false}}));
 for(const patch of [{workerId:'worker-2'},{sourceDigest:'0'.repeat(64)},{batchId:'micro-0929c'},{mode:'result'}])assert.throws(()=>assertModelGate({...proof,...patch}));
});
