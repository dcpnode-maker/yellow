import { describe, expect, test } from "bun:test";
import { allocateSignedLargestRemainder, SignedLargestRemainderError } from "../src/contexts/tax-fiscal";

const weights=(...values:string[])=>Object.freeze(values.map((weightMinor,index)=>Object.freeze({ordinal:String(index),weightMinor})));

describe("Order 350 signed largest-remainder allocator",()=>{
  test("allocates both signs with deterministic ordinal residual ties",()=>{
    expect(allocateSignedLargestRemainder("5",weights("1","1","1"))).toEqual([
      {ordinal:"0",amountMinor:"2"},{ordinal:"1",amountMinor:"2"},{ordinal:"2",amountMinor:"1"},
    ]);
    expect(allocateSignedLargestRemainder("-5",weights("1","1","1"))).toEqual([
      {ordinal:"0",amountMinor:"-2"},{ordinal:"1",amountMinor:"-2"},{ordinal:"2",amountMinor:"-1"},
    ]);
  });
  test("uses unequal exact integer weights and preserves input-independent result",()=>{
    const forward=allocateSignedLargestRemainder("101",weights("10","20","70"));
    const reversed=allocateSignedLargestRemainder("101",Object.freeze([...weights("70","20","10")].map((v,i)=>Object.freeze({...v,ordinal:String(2-i)}))));
    expect(forward).toEqual([{ordinal:"0",amountMinor:"10"},{ordinal:"1",amountMinor:"20"},{ordinal:"2",amountMinor:"71"}]);
    expect(reversed).toEqual(forward);
    expect(forward.reduce((sum,row)=>sum+BigInt(row.amountMinor),0n)).toBe(101n);
  });
  test("supports one minor unit, 366 nights and signed-int64 boundary",()=>{
    const many=weights(...Array.from({length:366},()=>"1"));
    expect(allocateSignedLargestRemainder("1",many).filter(v=>v.amountMinor==="1")).toHaveLength(1);
    const edge=allocateSignedLargestRemainder("9223372036854775807",weights("1","2"));
    expect(edge.reduce((sum,row)=>sum+BigInt(row.amountMinor),0n)).toBe(9223372036854775807n);
  });
  test("fails closed on zero, unsafe, duplicate, thawed and non-positive evidence",()=>{
    for(const run of [
      ()=>allocateSignedLargestRemainder("0",weights("1")),
      ()=>allocateSignedLargestRemainder("9223372036854775808",weights("1")),
      ()=>allocateSignedLargestRemainder("1",[{ordinal:"0",weightMinor:"1"}]),
      ()=>allocateSignedLargestRemainder("1",Object.freeze([Object.freeze({ordinal:"0",weightMinor:"0"})])),
      ()=>allocateSignedLargestRemainder("1",Object.freeze([Object.freeze({ordinal:"0",weightMinor:"1"}),Object.freeze({ordinal:"0",weightMinor:"2"})])),
    ]) expect(run).toThrow(SignedLargestRemainderError);
  });
});
