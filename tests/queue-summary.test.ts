import {test, expect} from 'bun:test';
import {summarizeTasks} from '../src/queue-summary.ts';

test('empty queue has explicit zeros', () => {
  expect(summarizeTasks([])).toEqual({total:0, counts:{queued:0,running:0,needs_attention:0,needs_review:0,tests_passed:0},needsActionIds:[]});
});
test('all states counted and action order preserved', () => {
  const tasks=Object.freeze([
    Object.freeze({id:'a',status:'needs_review'}),Object.freeze({id:'b',status:'queued'}),
    Object.freeze({id:'c',status:'needs_attention'}),Object.freeze({id:'d',status:'running'}),
    Object.freeze({id:'e',status:'tests_passed'}),Object.freeze({id:'f',status:'queued'})
  ]);
  expect(summarizeTasks(tasks)).toEqual({total:6,counts:{queued:2,running:1,needs_attention:1,needs_review:1,tests_passed:1},needsActionIds:['a','c']});
});
test('reject unsupported state without pretending done',()=>{
  expect(()=>summarizeTasks([{id:'x',status:'done'}])).toThrow();
  expect(()=>summarizeTasks([{id:'x',status:'__proto__'}])).toThrow();
});
test('reject blank and duplicate IDs',()=>{
  expect(()=>summarizeTasks([{id:' ',status:'queued'}])).toThrow();
  expect(()=>summarizeTasks([{id:'x',status:'queued'},{id:'x',status:'running'}])).toThrow();
});
test('large queue reconciles totals',()=>{
  const rows=Array.from({length:10000},(_,i)=>({id:String(i),status:i%2?'queued':'needs_review'}));
  const result=summarizeTasks(rows);
  expect(result.total).toBe(10000);
  expect(result.counts.queued).toBe(5000);
  expect(result.needsActionIds.length).toBe(5000);
  expect(rows[0]?.status).toBe('needs_review');
});
