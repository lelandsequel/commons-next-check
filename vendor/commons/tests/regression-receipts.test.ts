// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { packagePath } from '../src/package-root.ts';
import { verifyRunText } from '../src/run.ts';
import { createWorkbenchServer } from '../src/server.ts';

const fixture=(name:string)=>packagePath('tests','fixtures','regression','receipts',name);
const raw=(name:string)=>readFileSync(fixture(name),'utf8');
const trusted=raw('c-clean.digest').trim();

test('Original regression clean Mac receipt retains valid integrity and anchor but refuses this implementation runtime',()=>{
  const result=verifyRunText(raw('c-clean.json'),trusted);
  assert.equal(result.valid,false);
  assert.equal(result.integrity,'VALID');
  assert.equal(result.anchoring,'MATCH');
  assert.equal(result.replay,'UNSUPPORTED');
});

test('Original regression duplicate verdicts refuse before integrity or runtime checks through SDK and CLI',()=>{
  for(const name of ['c-A1.json','denied.TAMPERED.receipt.json']) {
    const result=verifyRunText(raw(name),trusted);
    assert.equal(result.valid,false); assert.equal(result.integrity,'NOT_CHECKED');
    assert.equal(result.anchoring,'MISMATCH'); assert.equal(result.replay,'NOT_RUN');
    assert.match(result.reason,/^DUPLICATE_JSON_KEY:/);
    const cli=spawnSync(process.execPath,[packagePath('bin','cosmic.mjs'),'verify',fixture(name),'--expect',trusted],{encoding:'utf8'});
    assert.equal(cli.status,1,cli.stderr);
    const output=JSON.parse(cli.stdout);
    assert.equal(output.integrity,'NOT_CHECKED'); assert.equal(output.anchoring,'MISMATCH');
    assert.equal(output.replay,'NOT_RUN'); assert.match(output.reason,/^DUPLICATE_JSON_KEY:/);
  }
});

test('Original regression duplicate receipts refuse on raw and envelope HTTP paths',async()=>{
  const server=createWorkbenchServer();
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address(); assert.ok(address && typeof address==='object');
  try {
    for(const name of ['c-A1.json','denied.TAMPERED.receipt.json']) {
      for(const envelope of [false,true]) {
        const body=envelope?`{"receipt":${raw(name)},"expectedDigest":"${trusted}"}`:raw(name);
        const response=await fetch(`http://127.0.0.1:${address.port}/api/verify`,{
          method:'POST',headers:{'Content-Type':'application/json',...(!envelope?{'X-Cosmic-Expected-Digest':trusted}:{})},body,
        });
        const result=await response.json() as any;
        assert.equal(response.status,200); assert.equal(result.valid,false);
        assert.equal(result.integrity,'NOT_CHECKED'); assert.equal(result.replay,'NOT_RUN');
        assert.equal(result.anchoring,envelope?'NOT_CHECKED':'MISMATCH');
        assert.match(result.reason,/^DUPLICATE_JSON_KEY:/);
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
