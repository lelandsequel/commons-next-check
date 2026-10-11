// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, CANONICAL_MAX_BYTES, assertReceiptTextLimit } from '../src/canonical.ts';
import { runRequest, verifyRunText } from '../src/run.ts';
import { createReceipt, captureEnvironment } from '../src/receipt.ts';
import { parseStrictJson } from '../src/strict-json.ts';
import type { PolicyInput } from '../src/run.ts';

test('canonical byte accounting matches UTF-8, escaped strings, keys, and container punctuation',()=>{
  for(const value of [null,true,false,17,'é\n😀',[1,2,[]],{b:'"\\',a:{'é':null}}]) {
    const output=canonicalize(value);
    assert.deepEqual(parseStrictJson(output),value);
  }
  const text='x'.repeat(CANONICAL_MAX_BYTES-2);
  assert.equal(Buffer.byteLength(canonicalize(text)),CANONICAL_MAX_BYTES);
  assert.throws(()=>canonicalize(text+'x'),/JSON_BYTE_LIMIT/);
  assert.throws(()=>canonicalize('é'.repeat(CANONICAL_MAX_BYTES/2)),/JSON_BYTE_LIMIT/);
  assert.throws(()=>canonicalize('\n'.repeat(CANONICAL_MAX_BYTES/2)),/JSON_BYTE_LIMIT/);
  assert.throws(()=>canonicalize({[text]:0}),/JSON_BYTE_LIMIT/);
});

test('repeated large values stop serialization at the byte budget before traversing later members',()=>{
  let touched=false;
  const value:any={a:Array(1000).fill('x'.repeat(100_000))};
  Object.defineProperty(value,'z',{enumerable:true,get(){touched=true;return true;}});
  assert.throws(()=>canonicalize(value),/JSON_BYTE_LIMIT/);
  assert.equal(touched,false);
});

test('a small request cannot emit a huge receipt by echoing one fact through many policy rules',()=>{
  const input:PolicyInput={kind:'policy',asOf:'2026-10-02T00:00:00Z',
    evidence:{sources:[{id:'s'}],facts:[{id:'large',sourceId:'s',value:'x'.repeat(500_000)}]},
    policy:{id:'amplification',version:'1',rules:Array.from({length:100},(_,i)=>({id:`r${i}`,factId:'large',op:'exists'}))}};
  assert.ok(Buffer.byteLength(JSON.stringify(input))<CANONICAL_MAX_BYTES);
  assert.throws(()=>runRequest(input),/JSON_BYTE_LIMIT/);
  assert.throws(()=>createReceipt({policy:input.policy,evidence:input.evidence,asOf:input.asOf,environment:captureEnvironment()}),/JSON_BYTE_LIMIT/);
  input.evidence.facts[0].value='ordinary';
  const receipt=runRequest(input);
  const raw=JSON.stringify(receipt,null,2)+'\n';
  assert.ok(Buffer.byteLength(raw)<=CANONICAL_MAX_BYTES);
  assert.equal(verifyRunText(raw,receipt.digest).valid,true);
});

test('formatting overhead is included in the standard receipt export limit',()=>{
  const value={a:'x'.repeat(CANONICAL_MAX_BYTES-8)};
  assert.equal(Buffer.byteLength(canonicalize(value)),CANONICAL_MAX_BYTES);
  assert.throws(()=>assertReceiptTextLimit(value),/RECEIPT_BYTE_LIMIT/);
});
