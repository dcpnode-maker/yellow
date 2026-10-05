import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as operator from './operator.mjs';
import { WORKERS, BATCHES, BROWSER_CAPTURE_MS, validateEnrollment, existingMetadataKernelId, wire } from './operator.mjs';

const now = Date.parse('2026-09-29T00:00:00.000Z');
function fixture(id) {
  return { version:1, workerId:id, owner:WORKERS[id].owner, notebook:WORKERS[id].notebook,
    protectedConnectionFile:path.join('D:/Yellow/harness/state-workspace','credentials',`${id}-jobs-0929.dpapi`),
    issuedAt:new Date(now-1000).toISOString(), expiresAt:new Date(now+3600000).toISOString() };
}
test('only the three exact approved notebook identities enroll', () => {
  for (const id of Object.keys(WORKERS)) assert.equal(validateEnrollment(fixture(id),id,now).workerId,id);
  assert.throws(()=>validateEnrollment(fixture('worker-1'),'worker-4',now));
  assert.throws(()=>validateEnrollment(fixture('worker-1'),'worker-2',now));
});
test('expiry, owner, notebook, private path and extra keys fail closed', () => {
  for (const patch of [
    {owner:'other'}, {notebook:'other'}, {protectedConnectionFile:'C:/other.dpapi'}, {credential:'not-permitted'},
    {expiresAt:new Date(now).toISOString()}, {issuedAt:new Date(now+1).toISOString()},
    {expiresAt:new Date(now+86400001).toISOString()},
  ]) assert.throws(()=>validateEnrollment({...fixture('worker-1'),...patch},'worker-1',now));
});
test('next batch cannot reuse the preceding enrollment or invent a new batch', () => {
  assert.deepEqual(Object.keys(BATCHES), ['fit-0930e','0929', 'build-0929b', 'micro-0929c']);
  const v = {...fixture('worker-1'), protectedConnectionFile:path.join(
    'D:/Yellow/harness/state-workspace','credentials','worker-1-jobs-build-0929b.dpapi')};
  assert.equal(validateEnrollment(v,'worker-1',now,'build-0929b').workerId,'worker-1');
  assert.throws(()=>validateEnrollment(fixture('worker-1'),'worker-1',now,'build-0929b'));
  assert.throws(()=>validateEnrollment(v,'worker-1',now,'0929'));
  assert.throws(()=>validateEnrollment(v,'worker-1',now,'../other'));
  assert.equal(BATCHES['build-0929b'].sessions['worker-2'],'yellow_worker2_login_0929b');
  assert.throws(()=>validateEnrollment(v,'worker-1',now,'micro-0929c'));
});

test('fit trial is Worker1 only and cannot dispatch the older generic runtime job',()=>{
  const v={...fixture('worker-1'),protectedConnectionFile:path.join(
    'D:/Yellow/harness/state-workspace','credentials','worker-1-jobs-fit-0930e.dpapi')};
  assert.equal(validateEnrollment(v,'worker-1',now,'fit-0930e').workerId,'worker-1');
  assert.throws(()=>validateEnrollment(fixture('worker-1'),'worker-1',now,'fit-0930e'));
  assert.throws(()=>validateEnrollment({...v,workerId:'worker-2',owner:WORKERS['worker-2'].owner,
    notebook:WORKERS['worker-2'].notebook},'worker-2',now,'fit-0930e'));
  assert.throws(()=>operator.fixedJobSource('worker-1','start','fit-0930e'));
});
test('slow local browser capture remains finite and does not extend credential expiry',()=>{
  assert.equal(BROWSER_CAPTURE_MS,30000);
  assert.throws(()=>validateEnrollment({...fixture('worker-1'),
    expiresAt:new Date(now+86400001).toISOString()},'worker-1',now));
});

test('metadata handshake selects only one existing idle or starting Python kernel',()=>{
  const id='c3a9d1c9-4682-4025-bcdf-13b26f117b84';
  for (const state of ['starting','idle']) {
    assert.equal(existingMetadataKernelId([{id,name:'python3',state}]),id);
  }
  for (const kernels of [null,[],[{id,name:'python3',state:'busy'}],
    [{id,name:'python3',state:'unknown'}], [{id:'not-a-kernel-id',name:'python3',state:'idle'}],
    [{id:{toString:()=>id},name:'python3',state:'idle'}],
    [{id,name:'python3',state:'idle'},{id,name:'python3',state:'starting'}],
    [{id,name:'other',state:'idle'}]]) assert.throws(()=>existingMetadataKernelId(kernels));
});

test('metadata handshake rejects unapproved identity or batch before private connection access',async()=>{
  await assert.rejects(wire('worker-4','build-0929b'));
  await assert.rejects(wire('worker-1','unknown'));
  await assert.rejects(wire('__proto__','build-0929b'));
});

test('fixed dispatch stays within the unchanged 40000-byte transport contract and preserves Python AST',()=>{
  const body=readFileSync(new URL('./owned-job.py',import.meta.url),'utf8');
  const raw=`_yellow_job_operation = "start"\n_yellow_job_worker = "worker-1"\n_yellow_job_batch = "micro-0929c"\n`+body;
  const source=operator.fixedJobSource?.('worker-1','start','micro-0929c') ?? raw;
  assert.ok(Buffer.byteLength(source)<=40000,`payload ${Buffer.byteLength(source)} exceeds existing transport budget`);
  const ast=spawnSync('python',['-c',"import ast,json,sys; a,b=json.load(sys.stdin); assert ast.dump(ast.parse(a))==ast.dump(ast.parse(b)); print('AST identical')"],{input:JSON.stringify([raw,source]),encoding:'utf8'});
  assert.equal(ast.status,0,ast.stderr);assert.match(ast.stdout,/AST identical/);
});

test('successor requires exact same-kernel no-job proof and oversized original pin',()=>{
  const id='worker-1',batch='micro-0929c',kernel='bc4d4dee-0d41-40b0-a500-83cf66984b46';
  const original='x'.repeat(40001),digest=v=>createHash('sha256').update(v).digest('hex');
  const failure={workerId:id,batchId:batch,kernelId:kernel,mode:'start',sourceDigest:digest(original),
    failureCode:'unknown',remoteErrorType:null,issuedAt:'2026-09-30T10:31:13.912Z'};
  const proof={workerId:id,batchId:batch,kernelId:kernel,mode:'confirm-no-job',
    sourceDigest:digest(operator.fixedJobSource(id,'confirm-no-job',batch)),issuedAt:'2026-09-30T10:40:00.000Z',
    result:{batchId:batch,state:'no_job',completedSteps:0}};
  operator.assertSuccessorProof(failure,original,proof,id,batch,kernel);
  for(const patch of [{kernelId:'other'},{batchId:'0929'},{sourceDigest:'0'.repeat(64)},
    {result:{...proof.result,state:'running'}},{issuedAt:'invalid'},
    {issuedAt:'2026-09-30T10:00:00.000Z'}])
    assert.throws(()=>operator.assertSuccessorProof(failure,original,{...proof,...patch},id,batch,kernel));
  for(const patch of [{failureCode:'remote_error'},{sourceDigest:'0'.repeat(64)},{issuedAt:'invalid'}])
    assert.throws(()=>operator.assertSuccessorProof({...failure,...patch},original,proof,id,batch,kernel));
  assert.throws(()=>operator.assertSuccessorProof(failure,'small',proof,id,batch,kernel));
  assert.throws(()=>operator.fixedJobSource('worker-2','start-successor',batch));
});
