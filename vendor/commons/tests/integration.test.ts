// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRequest, verifyRun } from '../src/run.ts';
import { getExample, listExamples } from '../src/examples.ts';
import { createWorkbenchServer } from '../src/server.ts';
import { sha256 } from '../src/canonical.ts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageRoot, packagePath } from '../src/package-root.ts';

test('complete examples yield hand-calculated outputs',()=>{
 const discovery=runRequest(getExample('sensor-investigation')).result as any;
 assert.ok(Math.abs(discovery.snapshot.posterior.positive-16/17)<1e-14);
 assert.equal(discovery.snapshot.remainingBudget,4);
 assert.equal(discovery.action.actionId,'investigate');
 assert.equal((runRequest(getExample('release-authorization')).result as any).verdict,'ALLOW');
 assert.equal((runRequest(getExample('release-deferred')).result as any).verdict,'DEFER');
 assert.equal((runRequest(getExample('release-denied')).result as any).verdict,'DENY');
});
test('every example roundtrips through exact replay with separate anchor status',()=>{
 for(const example of listExamples()){
  const receipt=JSON.parse(JSON.stringify(runRequest(example.input)));
  assert.deepEqual(runRequest(example.input),receipt);
  assert.equal(verifyRun(receipt).valid,true);
  assert.equal(verifyRun(receipt).anchoring,'UNANCHORED');
  assert.equal(verifyRun(receipt,receipt.digest).anchoring,'MATCH');
  assert.equal(verifyRun(receipt,'f'.repeat(64)).valid,false);
 }
});
test('forged policy approval fails replay even after a new digest is computed',()=>{
 const receipt=runRequest(getExample('release-denied'));
 (receipt.result as any).verdict='ALLOW';
 const {digest,...payload}=receipt;
 receipt.digest=sha256(payload);
 const check=verifyRun(receipt);
 assert.equal(check.integrity,'VALID');assert.equal(check.replay,'MISMATCH');assert.equal(check.valid,false);
});
test('a retained envelope digest cannot anchor a changed payload',()=>{
 const receipt=runRequest(getExample('release-denied'));const trusted=receipt.digest;
 (receipt.result as any).verdict='ALLOW';
 const result=verifyRun(receipt,trusted);
 assert.equal(result.valid,false);assert.equal(result.integrity,'INVALID');assert.equal(result.anchoring,'MISMATCH');
});
test('runtime changes refuse exact replay instead of falling back to tolerance',()=>{
 const receipt=runRequest(getExample());receipt.runtime.architecture='different-arch';
 const {digest,...payload}=receipt;receipt.digest=sha256(payload);
 assert.equal(verifyRun(receipt).replay,'UNSUPPORTED');
});
test('rejected model families suppress expected-loss action suggestions',()=>{
 const input=getExample('sensor-investigation');input.definition.budget=20;
 input.definition.experiments=[{id:'probe',cost:1,outcomes:['1','0'],likelihoods:{positive:{'1':0.5,'0':0.5},negative:{'1':0.5,'0':0.5}}}];
 input.observations=Array.from({length:12},(_,i)=>({id:`o${i}`,experimentId:'probe',outcome:'1'}));
 const result=runRequest(input).result as any;
 assert.equal(result.adequacy.status,'REJECTED_DECLARED_FAMILY');
 assert.equal(result.decisionStatus,'DEFER');assert.equal(result.action,null);
 assert.equal(result.recommendation.reason,'declared-family-rejected');
});
test('policy expiry is evaluated against explicit input time',()=>{
 const input=getExample('release-authorization');input.asOf='2026-09-30T18:00:00.000Z';
 assert.equal((runRequest(input).result as any).verdict,'DEFER');
});
test('CLI writes and verifies a portable receipt file and uses error exit codes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cosmic-test-'));const root=packageRoot;
 try {
  const path=join(dir,'receipt.json');
  let run=spawnSync(process.execPath,['bin/cosmic.mjs','demo','release-authorization','--out',path],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const receipt=JSON.parse(readFileSync(path,'utf8'));
  run=spawnSync(process.execPath,['bin/cosmic.mjs','verify',path,'--expect',receipt.digest],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).valid,true);
  run=spawnSync(process.execPath,['bin/cosmic.mjs','verify',path,'--expect','0'.repeat(64)],{cwd:root,encoding:'utf8'});assert.equal(run.status,1);
  run=spawnSync(process.execPath,['bin/cosmic.mjs','run'],{cwd:root,encoding:'utf8'});assert.equal(run.status,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('local API runs examples, rejects malformed input and cross-origin requests',async()=>{
 const server=createWorkbenchServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address && typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
 try {
  for(const [path,type] of [['/','text/html'],['/app.js','text/javascript'],['/styles.css','text/css']]) {
    const asset=await fetch(url+path);assert.equal(asset.status,200,path);assert.ok(asset.headers.get('content-type')?.startsWith(type));assert.ok((await asset.text()).length>100);
  }
  const listing=await fetch(url+'/api/examples');assert.equal(listing.status,200);assert.equal(((await listing.json() as any)).examples.length,listExamples().length);
  let response=await fetch(url+'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(getExample('release-authorization'))});
  assert.equal(response.status,200);const receipt=(await response.json() as any);assert.equal(receipt.result.verdict,'ALLOW');
  response=await fetch(url+'/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt,expectedDigest:receipt.digest})});
  assert.equal(((await response.json() as any)).valid,true);
  response=await fetch(url+'/api/run',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.invalid'},body:'{}'});assert.equal(response.status,403);
  response=await fetch(url+'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"kind":"unknown"}'});assert.equal(response.status,400);
  response=await fetch(url+'/../../package.json');assert.equal(response.status,404);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
