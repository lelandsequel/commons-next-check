// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchServer } from '../src/server.ts';
import { runRequest, verifyRunText } from '../src/run.ts';
import { createReceipt, captureEnvironment, verifyReceiptText } from '../src/receipt.ts';
import { getExample } from '../src/examples.ts';

test('format endpoint refuses ambiguous keys and numbers before changing editable input', async () => {
  const server=createWorkbenchServer();
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address(); assert.ok(address && typeof address==='object');
  const post=(body:string | Uint8Array,path='/api/format')=>fetch(`http://127.0.0.1:${address.port}${path}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body,
  });
  try {
    const valid=await post('{"amount":0.10,"rows":[{"x":1},{"x":2}]}');
    assert.equal(valid.status,200);
    assert.deepEqual(JSON.parse(((await valid.json() as any)).formatted),{amount:0.1,rows:[{x:1},{x:2}]});
    for(const [raw,code] of [
      ['{"status":"ALLOW","status":"DEFER"}','DUPLICATE_JSON_KEY'],
      ['{"amount":9007199254740993}','NUMBER_NOT_ROUNDTRIPPABLE'],
      ['{"amount":0.10000000000000001}','NUMBER_NOT_ROUNDTRIPPABLE'],
    ]) {
      const result=await post(raw); assert.equal(result.status,400);
      const error=(await result.json() as any); assert.equal(error.code,code); assert.equal(error.formatted,undefined);
    }
    // Invalid UTF-8 must not become a replacement character that hashes differently.
    const invalid=Uint8Array.from([123,34,120,34,58,34,0xc0,0xaf,34,125]);
    for(const endpoint of ['/api/run','/api/verify','/api/format']) assert.equal((await post(invalid,endpoint)).status,400);
    assert.equal((await post('\uFEFF{}')).status,400);
    const malformedEnvelope=await post('{"receipt":{"x":1,"x":2},"expectedDigest":"'+'a'.repeat(64)+'"}','/api/verify');
    const refused=await malformedEnvelope.json() as any;
    assert.equal(refused.valid,false); assert.equal(refused.anchoring,'NOT_CHECKED');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

test('early receipt refusal cannot label a supplied anchor as absent or matched',()=>{
  const input=getExample('release-deferred');
  const run=runRequest(input);
  const policy=createReceipt({policy:input.policy,evidence:input.evidence,asOf:input.asOf,environment:captureEnvironment()});
  assert.equal(verifyRunText('{"x":1,"x":2}',run.digest).anchoring,'MISMATCH');
  assert.equal(verifyRunText('{"x":1,"x":2}').anchoring,'UNANCHORED');
  assert.equal(verifyReceiptText('{"x":1,"x":2}',{trustedDigest:policy.digest}).anchoring,'MISMATCH');
  assert.equal(verifyReceiptText('{"x":1,"x":2}').anchoring,'UNANCHORED');
});
