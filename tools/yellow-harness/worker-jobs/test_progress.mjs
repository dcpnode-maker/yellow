import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize,shouldPollWorker,pollAdmission} from './progress.mjs';
test('setup never adds progress; all ten assigned steps remain the denominator',()=>{
  const v=summarize({'worker-2':{phase:'model-runtime-build',weightsVerified:true,runtimeVerified:true}});
  assert.equal(v.percent,0);assert.equal(v.totalSteps,10);assert.equal(v.workers[1].modelReady,true);
});
test('finished failing tests remain visible, not accepted fixes',()=>{
  const v=summarize({'worker-2':{phase:'model-runtime-build',completedSteps:2,tests:[{test:'tests/first.test.ts',returncode:1} ]},'worker-3':{completedSteps:1}});
  assert.equal(v.percent,30);assert.equal(v.workers[1].tests[0].state,'failed');assert.equal(v.workers[1].acceptedFix,false);
});
test('credential, output and invalid count fields do not leak or inflate progress',()=>{
  const v=summarize({'worker-1':{completedSteps:999,token:'secret',proposal:'private',phase:'<script>bad</script>'}});
  assert.equal(v.percent,0);assert.ok(!JSON.stringify(v).includes('secret'));assert.ok(!JSON.stringify(v).includes('private'));
});
test('terminal jobs stop polling; only explicitly recoverable failures can be observed',()=>{
  assert.equal(shouldPollWorker({state:'completed_unaccepted'},'worker-1'),false);
  assert.equal(shouldPollWorker({state:'failed',errorType:'ValueError'},'worker-1'),false);
  assert.equal(shouldPollWorker({state:'failed',errorType:'TimeoutExpired',recoveryAttempts:1},'worker-1'),false);
  assert.equal(shouldPollWorker({state:'failed',errorType:'TimeoutExpired'},'worker-1'),true);
  assert.equal(shouldPollWorker({state:'failed',errorType:'FileNotFoundError',recoveryAttempts:1},'worker-3'),true);
  assert.equal(shouldPollWorker({state:'failed',errorType:'FileNotFoundError',recoveryAttempts:1,sourcePathRepair:1},'worker-3'),false);
});
test('new batch uses its own eight steps and rejects previous batch completion',()=>{
  const old = {'worker-1':{batchId:'0929',completedSteps:5,state:'completed_unaccepted'}};
  const v=summarize(old,'build-0929b');
  assert.equal(v.batchId,'build-0929b');assert.equal(v.totalSteps,8);assert.equal(v.percent,0);
  const current=summarize({'worker-1':{batchId:'build-0929b',completedSteps:2},
    'worker-2':{batchId:'build-0929b',completedSteps:4}},'build-0929b');
  assert.equal(current.percent,75);
  assert.throws(()=>summarize({},'unapproved'));
});

test('no polling before start confirmation or after an unconfirmed observation',()=>{
  assert.equal(pollAdmission({enrolled:true}),false);
  assert.equal(pollAdmission({enrolled:true,startConfirmed:true,startUnconfirmed:true}),false);
  assert.equal(pollAdmission({enrolled:true,startConfirmed:true}),true);
  assert.equal(pollAdmission({enrolled:true,startUnconfirmed:true,successorConfirmed:true}),true);
  assert.equal(pollAdmission({enrolled:false,successorConfirmed:true}),false);
  assert.equal(shouldPollWorker({observationStopped:true},'worker-1'),false);
});
