// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, appendFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../../', import.meta.url));
const api = await import(pathToFileURL(join(root, 'dist/src/index.js')));
const { getExample, listExamples } = await import(pathToFileURL(join(root, 'dist/src/examples.js')));
const { createWorkbenchServer } = await import(pathToFileURL(join(root, 'dist/src/server.js')));
const result = { reviewer: 'same-model engineering review, not independent clearance', runtime: api.executionRuntime(), checks: [] };
const mark = (name, detail) => result.checks.push({name, passed: true, ...detail});

// Independent exact-rational oracle; deliberately not the scanner's normalization algorithm.
let state = 0x6a09e667;
const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
function rational(token) {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(token);
  const numerator = BigInt(m[2] + (m[3] ?? '')) * (m[1] ? -1n : 1n);
  const exponent = Number(m[4] ?? 0) - (m[3]?.length ?? 0);
  return exponent >= 0 ? [numerator * 10n ** BigInt(exponent), 1n] : [numerator, 10n ** BigInt(-exponent)];
}
function decimalEqual(a, b) { const [x,y] = rational(a), [z,w] = rational(b); return x*w === z*y; }
let accepted = 0, refused = 0;
for (let i = 0; i < 20000; i++) {
  const length = 1 + random() % 25;
  let digits = String(1 + random() % 9);
  for (let j = 1; j < length; j++) digits += random() % 10;
  const at = 1 + random() % digits.length;
  const fraction = digits.slice(at);
  const token = (random() % 2 ? '-' : '') + digits.slice(0, at) + (fraction ? '.' + fraction : '') + 'e' + (Number(random() % 701) - 350);
  const numeric = Number(token);
  const expected = Number.isFinite(numeric) && !Object.is(numeric, -0)
    && (!Number.isInteger(numeric) || Number.isSafeInteger(numeric))
    && decimalEqual(token, JSON.stringify(numeric));
  let actual;
  try { api.parseStrictJson(token); actual = true; accepted++; } catch { actual = false; refused++; }
  assert.equal(actual, expected, token);
}
mark('decimal parser versus exact rational oracle', {tokens: 20000, accepted, refused, mismatches: 0});

const base = {
  modelId: 'review-support-invariance',
  observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment', budget: 20,
  hypotheses: [{id:'active-a',prior:0.4},{id:'active-b',prior:0.6}],
  experiments: [{id:'probe',cost:1,outcomes:['on','off'],likelihoods:{'active-a':{on:0.99,off:0.01},'active-b':{on:0.9,off:0.1}}}],
};
const withDecoy = structuredClone(base);
withDecoy.hypotheses.push({id:'zero-prior-decoy',prior:0});
withDecoy.experiments[0].likelihoods['zero-prior-decoy'] = {on:0,off:1};
const observations = Array.from({length:6}, (_,i) => ({id:`observation-${i}`,experimentId:'probe',outcome:'off'}));
const runBase = api.runRequest({kind:'discovery',definition:base,observations,adequacy:{alpha:0.05,epochId:'review'}});
const runDecoy = api.runRequest({kind:'discovery',definition:withDecoy,observations,adequacy:{alpha:0.05,epochId:'review'},actions:[{id:'proceed',losses:{'active-a':0,'active-b':0,'zero-prior-decoy':1}}]});
assert.equal(runBase.result.adequacy.logEValue, runDecoy.result.adequacy.logEValue);
assert.equal(runBase.result.adequacy.firstCrossingSequence, runDecoy.result.adequacy.firstCrossingSequence);
assert.deepEqual(runDecoy.result.adequacy.nullHypothesisIds, ['active-a','active-b']);
assert.deepEqual(runDecoy.result.adequacy.excludedZeroPriorHypothesisIds, ['zero-prior-decoy']);
assert.equal(runDecoy.result.decisionStatus, 'DEFER');
assert.equal(runDecoy.result.action, null);
mark('zero-prior decoy cannot shield active family', {logEValue:runDecoy.result.adequacy.logEValue, firstCrossing:runDecoy.result.adequacy.firstCrossingSequence, decisionStatus:runDecoy.result.decisionStatus});

for (const name of ['with-zero-prior','without-zero-prior']) {
  const original = readFileSync(join(root,'tests/fixtures/regression/adequacy',`${name}.json`),'utf8');
  const checked = api.runRequest(api.parseStrictJson(original));
  assert.equal(checked.result.decisionStatus,'DEFER');
  assert.equal(checked.result.action,null);
}
for (const name of ['bigint-eq','underflow-lte']) {
  const original = readFileSync(join(root,'tests/fixtures/regression/numbers',`${name}.json`),'utf8');
  assert.throws(()=>api.parseStrictJson(original),/NUMBER_NOT_ROUNDTRIPPABLE|UNSAFE_INTEGER/);
}
for (const raw of ['9007199254740992','-9007199254740992','9.007199254740992e15','9007199254740992.00']) {
  assert.throws(()=>api.parseStrictJson(raw),/UNSAFE_INTEGER/);
  assert.throws(()=>api.canonicalize(Number(raw)),/UNSAFE_INTEGER/);
}
mark('original regression B1 and B6 fixtures plus safe-integer object boundary', {originalB1:2,originalB6:2,unsafeIntegerSpellings:4});

const unmonitored = api.runRequest({kind:'discovery',definition:base,observations,actions:[{id:'act',losses:{'active-a':0,'active-b':0}}]});
assert.equal(unmonitored.result.adequacy.status,'NOT_EVALUATED');
assert.equal(unmonitored.result.decisionStatus,'DEFER');
assert.equal(unmonitored.result.action,null);
const threeOutcome = structuredClone(base);
threeOutcome.experiments[0].outcomes=['on','off','unknown'];
for (const id of ['active-a','active-b']) threeOutcome.experiments[0].likelihoods[id]={on:0.2,off:0.4,unknown:0.4};
const unsupported = api.runRequest({kind:'discovery',definition:threeOutcome,observations,adequacy:{alpha:0.05,epochId:'review'},actions:[{id:'act',losses:{'active-a':0,'active-b':0}}]});
assert.equal(unsupported.result.adequacy.status,'UNSUPPORTED');
assert.equal(unsupported.result.decisionStatus,'DEFER');
assert.equal(unsupported.result.action,null);
mark('absent and unsupported adequacy both suppress integrated actions', {statuses:['NOT_EVALUATED','UNSUPPORTED']});

const longIds=['a'.repeat(20000),'b'.repeat(20000)];
const discoveryAmplifier={kind:'discovery',definition:{modelId:'review-preflight',budget:1000,
  observationAssumption:'conditionally-independent-given-hypothesis-and-experiment',
  hypotheses:longIds.map(id=>({id,prior:0.5})),
  experiments:[{id:'probe',cost:1,outcomes:['yes','no'],likelihoods:Object.fromEntries(longIds.map(id=>[id,{yes:0.5,no:0.5}]))}]},
  observations:Array.from({length:100},(_,i)=>({id:`o${i}`,experimentId:'probe',outcome:'yes'})),
  adequacy:{alpha:0.05,epochId:'review'}};
assert.ok(Buffer.byteLength(JSON.stringify(discoveryAmplifier))<100000);
const preflightStarted=performance.now();
assert.throws(()=>api.validateInput(discoveryAmplifier),/identifier|at most 256|DISCOVERY_RECEIPT_LIMIT|DISCOVERY_BYTE_LIMIT/i);
mark('discovery long-identifier amplification refuses before inference', {inputBytes:Buffer.byteLength(JSON.stringify(discoveryAmplifier)),observations:100,preflightMs:performance.now()-preflightStarted});

function boundedDiscovery(hypotheses,experiments,actions,monitored,observations,escaped=false) {
  const ids=Array.from({length:hypotheses},(_,i)=>escaped?String(i)+'\u0001'.repeat(255):`h${i}`);
  const outcomes=escaped?['x'+'\u0002'.repeat(255),'y'+'漢'.repeat(255)]:['yes','no'];
  const experimentIds=Array.from({length:experiments},(_,i)=>escaped?String(i)+'\u0003'.repeat(255):`e${i}`);
  return {kind:'discovery',definition:{modelId:'review-max-bound',budget:5000,
    observationAssumption:'conditionally-independent-given-hypothesis-and-experiment',
    hypotheses:ids.map(id=>({id,prior:1/hypotheses})),
    experiments:experimentIds.map(id=>({id,cost:1,outcomes,likelihoods:Object.fromEntries(ids.map(h=>[h,Object.fromEntries(outcomes.map(outcome=>[outcome,0.5]))]))}))},
    observations:Array.from({length:observations},(_,i)=>({id:escaped?String(i).padEnd(256,'\u0004'):`o${i}`,experimentId:experimentIds[i%experiments],outcome:outcomes[i%2]})),
    ...(monitored?{adequacy:{alpha:0.05,epochId:escaped?'z'+'\u0005'.repeat(255):'review'}}:{}),
    actions:Array.from({length:actions},(_,i)=>({id:`a${i}`,losses:Object.fromEntries(ids.map(id=>[id,0]))}))};
}
const maxCases=[];
const nodeCount=value=>value!==null&&typeof value==='object'?1+Object.values(value).reduce((sum,child)=>sum+nodeCount(child),0):1;
for(const [hypotheses,experiments,actions,monitored,escaped] of [[2,1,1,true,false],[2,1,1,false,false],[10,10,100,true,false],[100,1,100,true,false],[100,100,100,true,false],[2,1,1,true,true]]) {
  const build=n=>boundedDiscovery(hypotheses,experiments,actions,monitored,n,escaped);
  const details={hypotheses,experiments,actions,monitored,escaped};
  try{api.validateInput(build(0));}catch(error){assert.match(String(error),/DISCOVERY_RECEIPT_LIMIT/);maxCases.push({...details,baseRefused:true});continue;}
  let lower=0,upper=5000;
  while(lower<upper) {
    const middle=Math.ceil((lower+upper)/2);
    try{api.validateInput(build(middle));lower=middle;}catch(error){assert.match(String(error),/DISCOVERY_RECEIPT_LIMIT|JSON_BYTE_LIMIT|JSON_LIMIT/);upper=middle-1;}
  }
  const generated=api.runRequest(build(lower));
  const text=JSON.stringify(generated,null,2)+'\n';
  const bytes=Buffer.byteLength(text);
  const nodes=nodeCount(generated);
  assert.ok(bytes<=api.MAX_JSON_BYTES);
  assert.ok(nodes<=api.CANONICAL_MAX_NODES);
  assert.equal(api.verifyRunText(text,generated.digest).valid,true);
  assert.throws(()=>api.validateInput(build(lower+1)),/DISCOVERY_RECEIPT_LIMIT/);
  maxCases.push({...details,maxAdmittedObservations:lower,receiptBytes:bytes,receiptNodes:nodes});
}
mark('maximum admitted discovery chains fit both byte and node caps and verify as text', {cases:maxCases});

const asOf='2026-10-02T00:00:00Z';
const denseIds=Array.from({length:100},(_,i)=>`dense-${i}`);
const dense=api.inspectEvidence({sources:[{id:'s'}],facts:denseIds.map(id=>({id,sourceId:'s',value:true,dependsOn:denseIds}))},asOf);
assert.equal(dense.valid,false);
assert.equal(dense.issues.filter(issue=>issue.code==='DEPENDENCY_CYCLE').length,1);
assert.equal(dense.issues.find(issue=>issue.code==='DEPENDENCY_CYCLE').factIds.length,100);
assert.ok(dense.facts.every(fact=>fact.status==='INVALID'));
assert.ok(dense.facts.reduce((sum,fact)=>sum+fact.reasons.length,0)<=10100);
const tooDenseIds=Array.from({length:101},(_,i)=>`dense-${i}`);
const tooDense=api.inspectEvidence({sources:[{id:'s'}],facts:tooDenseIds.map(id=>({id,sourceId:'s',value:true,dependsOn:tooDenseIds}))},asOf);
assert.equal(tooDense.issues[0].code,'EVIDENCE_LIMIT');
const chain=Array.from({length:1000},(_,i)=>({id:`chain-${i}`,sourceId:'s',value:true,...(i===0?{expiresAt:asOf}:{dependsOn:[`chain-${i-1}`]})})).reverse();
const propagated=api.inspectEvidence({sources:[{id:'s'}],facts:chain},asOf);
assert.ok(propagated.facts.every(fact=>fact.status==='EXPIRED'));
mark('bounded SCC diagnostics and reverse-chain availability propagation', {denseNodes:100,denseEdges:10000,cycleDiagnostics:1,chainNodes:1000});

const receipt = api.runRequest(getExample('release-deferred'));
const raw = JSON.stringify(receipt);
const duplicate = raw.replace('"verdict":"DEFER"', '"verdict":"ALLOW","verdict":"DEFER"');
assert.notEqual(duplicate, raw);
assert.equal(api.verifyRunText(raw, receipt.digest).valid, true);
const checked = api.verifyRunText(duplicate, receipt.digest);
assert.equal(checked.valid, false);
assert.equal(checked.replay, 'NOT_RUN');
assert.equal(checked.anchoring, 'MISMATCH');
assert.equal(checked.integrity, 'NOT_CHECKED');
mark('duplicate false verdict cannot pass anchored verification', {reason:checked.reason});

for (const {id:example} of listExamples()) {
  const generated = api.runRequest(getExample(example));
  const pretty = JSON.stringify(generated,null,2)+'\n';
  assert.ok(Buffer.byteLength(pretty)<=api.MAX_JSON_BYTES,example);
  assert.equal(api.verifyRunText(pretty,generated.digest).valid,true,example);
}
const policyInput=getExample('release-deferred');
const foreign=api.createReceipt({policy:policyInput.policy,evidence:policyInput.evidence,asOf:policyInput.asOf,environment:{...api.captureEnvironment(),runtime:'node/999.0.0'}});
for(const options of [{trustedDigest:foreign.digest},{trustedDigest:foreign.digest,expectedEnvironment:foreign.payload.input.environment}]) {
  const rejected=api.verifyReceiptText(JSON.stringify(foreign),options);
  assert.equal(rejected.valid,false); assert.equal(rejected.replay,'UNSUPPORTED');
  assert.equal(rejected.integrity,'VALID');
}
mark('generated example receipts round-trip and foreign policy runtime cannot be overridden', {examples:listExamples().length});

const boundedPolicy = (characters,rules) => ({kind:'policy',asOf,
  policy:{id:'review-byte-bound',version:'1',rules:Array.from({length:rules},(_,i)=>({id:`rule-${i}`,factId:'large-value',op:'exists'}))},
  evidence:{sources:[{id:'s'}],facts:[{id:'large-value',sourceId:'s',value:'x'.repeat(characters)}]}});
const admittedLarge = api.runRequest(boundedPolicy(700000,1));
const admittedText = JSON.stringify(admittedLarge,null,2)+'\n';
assert.ok(Buffer.byteLength(admittedText)<=api.MAX_JSON_BYTES);
assert.equal(api.verifyRunText(admittedText,admittedLarge.digest).valid,true);
const amplified = boundedPolicy(40000,100);
assert.ok(Buffer.byteLength(JSON.stringify(amplified))<50000);
assert.throws(()=>api.runRequest(amplified),/JSON_BYTE_LIMIT|RECEIPT_BYTE_LIMIT/);
assert.throws(()=>api.createReceipt({policy:amplified.policy,evidence:amplified.evidence,asOf,environment:api.captureEnvironment()}),/JSON_BYTE_LIMIT|RECEIPT_BYTE_LIMIT/);
mark('receipt text admission bounds expanded policy reports', {admittedReceiptBytes:Buffer.byteLength(admittedText),refusedInputBytes:Buffer.byteLength(JSON.stringify(amplified)),refusedExpansionCopies:100});

const server = createWorkbenchServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const post = (path, body) => fetch(`http://127.0.0.1:${address.port}${path}`, {method:'POST',headers:{'Content-Type':'application/json','X-Cosmic-Expected-Digest':receipt.digest},body});
try {
  const refusedDuplicate = await (await post('/api/verify', duplicate)).json();
  assert.equal(refusedDuplicate.valid, false);
  const formatting = await post('/api/format','{"threshold":0.10000000000000001}');
  assert.equal(formatting.status,400);
  assert.equal((await formatting.json()).code,'NUMBER_NOT_ROUNDTRIPPABLE');
  const invalidBytes = Uint8Array.from([123,34,120,34,58,34,255,34,125]);
  for (const path of ['/api/run','/api/format','/api/verify']) assert.equal((await post(path,invalidBytes)).status,400);
  mark('HTTP rejects duplicate upload, lossy formatting, and invalid UTF-8', {surfaces:['run','format','verify']});
} finally {
  server.closeAllConnections();
  await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
}

const scratch = mkdtempSync(join(tmpdir(),'commons-review-'));
try {
  const copy = join(scratch,'package with spaces');
  cpSync(root, copy, {recursive:true,filter:path=>!path.includes('/node_modules') && !path.includes('/verification') && !path.includes('/.build-')});
  const cli = join(copy,'bin/cosmic.mjs');
  const run = (...args) => spawnSync(process.execPath,[cli,...args],{cwd:scratch,encoding:'utf8'});
  const receiptPath = join(scratch,'receipt.json');
  writeFileSync(receiptPath,raw);
  let check = run('verify',receiptPath,'--expect',receipt.digest);
  assert.equal(check.status,0,check.stderr+check.stdout);
  const doctor = run('doctor');
  assert.equal(doctor.status,0,doctor.stderr);
  assert.equal(JSON.parse(doctor.stdout).npmInstallRequired,false);
  const invalidPath = join(scratch,'invalid.json');
  writeFileSync(invalidPath,Buffer.from([123,34,120,34,58,34,255,34,125]));
  assert.notEqual(run('run',invalidPath).status,0);
  assert.notEqual(run('verify',invalidPath,'--expect',receipt.digest).status,0);
  assert.equal(run('verify',receiptPath,'--expect','invalid').status,2);
  const inputPath=join(scratch,'input.json');
  const inputText=JSON.stringify(getExample('release-deferred'));
  writeFileSync(inputPath,inputText);
  assert.equal(run('run',inputPath,'--out',inputPath).status,2);
  assert.equal(readFileSync(inputPath,'utf8'),inputText);
  const outputLink=join(scratch,'output-link.json');
  symlinkSync(inputPath,outputLink);
  assert.equal(run('run',inputPath,'--out',outputLink).status,2);
  assert.equal(readFileSync(inputPath,'utf8'),inputText);
  mark('dependency-free CLI works from another cwd and a path with spaces', {anchoredReceipt:receipt.digest});
  mark('CLI malformed anchor is exit 2 and output cannot replace input or final symlink', {protectedInputBytes:Buffer.byteLength(inputText)});
  const emitted = join(copy,'dist/src/policy.js');
  const original = readFileSync(emitted);
  appendFileSync(emitted,'\n// Independent review mutation: executed artifact identity must change.\n');
  check = run('verify',receiptPath,'--expect',receipt.digest);
  assert.equal(check.status,1,check.stderr+check.stdout);
  assert.equal(JSON.parse(check.stdout).replay,'UNSUPPORTED');
  writeFileSync(emitted,original);
  appendFileSync(join(copy,'src/policy.ts'),'\n// Independent review mutation: source artifact identity must change.\n');
  check = run('verify',receiptPath,'--expect',receipt.digest);
  assert.equal(check.status,1,check.stderr+check.stdout);
  assert.equal(JSON.parse(check.stdout).replay,'UNSUPPORTED');
  mark('source and emitted code mutations independently invalidate exact replay', {result:'UNSUPPORTED'});
} finally { rmSync(scratch,{recursive:true,force:true}); }

console.log(JSON.stringify(result,null,2));
