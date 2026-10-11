#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
/** Original number-regression inputs and additional numeric-boundary attacks. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { executionRuntime, runRequest, verifyRun, verifyRunText } from '../dist/src/run.js';
import { createWorkbenchServer } from '../dist/src/server.js';
import { parseStrictJson } from '../dist/src/strict-json.js';

const scriptPath = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'verification', 'numeric-attacks');
const cli = join(root, 'bin', 'cosmic.mjs');
const runtime = executionRuntime();
const refusalCode = 'NUMBER_NOT_ROUNDTRIPPABLE';
const digestBytes = bytes => createHash('sha256').update(bytes).digest('hex');
mkdirSync(directory, {recursive:true});

function write(name, content) {
  const bytes = typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n';
  const path = join(directory, name);
  mkdirSync(dirname(path), {recursive:true});
  writeFileSync(path, bytes);
  return {file:`verification/numeric-attacks/${name}`,sha256:digestBytes(bytes)};
}

function rawRequest(op, actual, expected) {
  return `{"kind":"policy","asOf":"2026-10-02T00:00:00Z","policy":{"id":"reconstructed-b6","version":"1","rules":[{"id":"limit","factId":"number","op":"${op}","value":${expected}}]},"evidence":{"sources":[{"id":"declared"}],"facts":[{"id":"number","sourceId":"declared","value":${actual}}]}}\n`;
}

function command(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {cwd:root,encoding:'utf8'});
  if (result.error) throw result.error;
  assert.equal(result.signal, null);
  return {exitCode:result.status,stdout:result.stdout,stderr:result.stderr};
}

const server = createWorkbenchServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
async function post(path, raw, expectedDigest) {
  const headers = {'Content-Type':'application/json'};
  if (expectedDigest !== undefined) headers['X-Cosmic-Expected-Digest'] = expectedDigest;
  const response = await fetch(base + path, {method:'POST',headers,body:raw});
  return {status:response.status,body:await response.json()};
}

function assertRefused(verification, code = refusalCode) {
  assert.equal(verification.valid, false);
  assert.equal(verification.integrity, 'NOT_CHECKED');
  assert.equal(verification.replay, 'NOT_RUN');
  assert.equal(verification.anchoring, 'MISMATCH');
  assert.ok(verification.reason.startsWith(code + ':'));
}

try {
  const cases = [];
  const attackCases = [
    {id:'B6-integer-lte',origin:'ADDITIONAL_RECONSTRUCTION',op:'lte',actual:'9007199254740993',expected:'9007199254740992',exactRelation:'actual > threshold; lte must not allow',code:'UNSAFE_INTEGER',objectResult:'UNSAFE_INTEGER'},
    {id:'B6-decimal-gte',origin:'ADDITIONAL_RECONSTRUCTION',op:'gte',actual:'0.1',expected:'0.10000000000000001',exactRelation:'actual < threshold; gte must not allow',code:refusalCode,objectResult:'ALLOW'},
    {id:'B6-integer-eq',origin:'ADDITIONAL_RECONSTRUCTION',op:'eq',actual:'9007199254740993',expected:'9007199254740992',exactRelation:'actual != threshold; eq must not allow',code:'UNSAFE_INTEGER',objectResult:'UNSAFE_INTEGER'},
    {id:'B6-exact-unsafe-integer',origin:'ADDITIONAL_BOUNDARY',op:'eq',actual:'9007199254740992',expected:'9007199254740992',exactRelation:'The integer round-trips unchanged but lies outside the safe integer range; refusal is required',code:'UNSAFE_INTEGER',objectResult:'UNSAFE_INTEGER'},
    {id:'Regression-numbers-bigint-eq',origin:'ORIGINAL_REGRESSION',op:'eq',actual:'1234567890123456788',expected:'1234567890123456789',exactRelation:'actual != threshold; eq must not allow',code:refusalCode,objectResult:'UNSAFE_INTEGER',sourceFile:'tests/fixtures/regression/numbers/bigint-eq.json',sourceSha256:'fac169ecdc38c58affbf7df81e1b53baf9c5db4d3aa36f0ff57f74daf42a4e11'},
    {id:'Regression-numbers-underflow-lte',origin:'ORIGINAL_REGRESSION',op:'lte',actual:'1e-400',expected:'0',exactRelation:'actual is positive and greater than zero; lte must not allow',code:refusalCode,objectResult:'ALLOW',sourceFile:'tests/fixtures/regression/numbers/underflow-lte.json',sourceSha256:'57415048f1a748bb4d64fcf2d2177a458b9f4cfd08a6b57b7d5bbe646375603b'},
  ];
  for (const {id, origin, op, actual, expected, exactRelation, code, objectResult, sourceFile, sourceSha256} of attackCases) {
    let raw, fixture;
    if (sourceFile) {
      const bytes = readFileSync(join(root, sourceFile));
      assert.equal(digestBytes(bytes), sourceSha256, 'Original regression fixture bytes changed');
      raw = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
      fixture = {file:sourceFile,sha256:sourceSha256};
    } else {
      raw = rawRequest(op, actual, expected);
      fixture = write(id + '.input.json', raw);
    }
    // After permissive parsing, unsafe integers are still rejected by the
    // object contract. Lost decimal precision and underflow cannot be recovered.
    const parsed = JSON.parse(raw);
    const permissiveParse = {actual:parsed.evidence.facts[0].value,threshold:parsed.policy.rules[0].value};
    try {
      const permissive = runRequest(parsed);
      permissiveParse.verdict = permissive.result.verdict;
      assert.equal(objectResult, 'ALLOW');
      assert.equal(permissiveParse.verdict, 'ALLOW');
    } catch (error) {
      assert.equal(objectResult, 'UNSAFE_INTEGER');
      assert.match(error.message, /^UNSAFE_INTEGER/);
      permissiveParse.refused = true;
      permissiveParse.reason = error.message;
    }
    let sdkTextInput;
    try {
      runRequest(parseStrictJson(raw));
      assert.fail('Strict SDK input boundary accepted an unsupported number');
    } catch (error) {
      assert.equal(error.code, code);
      sdkTextInput = {refused:true,code:error.code,reason:error.message};
    }
    const cliRun = command(['run', join(root, fixture.file)]);
    assert.equal(cliRun.exitCode, 2);
    assert.equal(cliRun.stdout, '');
    assert.ok(cliRun.stderr.startsWith('COSMIC: ' + code + ':'));
    const httpRun = await post('/api/run', raw);
    assert.equal(httpRun.status, 400);
    assert.equal(httpRun.body.code, code);
    cases.push({id,origin,fixture,operator:op,actualToken:actual,thresholdToken:expected,exactRelation,expectedRefusalCode:code,
      permissiveParse,sdkTextInput,cliRun,httpRun});
  }

  const cleanInput = rawRequest('gte', '0.1', '0.1');
  const cleanInputFile = write('clean.input.json', cleanInput);
  const clean = runRequest(JSON.parse(cleanInput));
  const cleanText = JSON.stringify(clean) + '\n';
  const cleanFile = write('clean.receipt.json', cleanText);
  const anchorFile = write('trusted-clean-digest.txt', clean.digest + '\n');
  const cleanCli = command(['verify', join(root, cleanFile.file), '--expect', clean.digest]);
  assert.equal(cleanCli.exitCode, 0);
  assert.equal(JSON.parse(cleanCli.stdout).valid, true);
  const cleanHttp = await post('/api/verify', cleanText, clean.digest);
  assert.equal(cleanHttp.status, 200);
  assert.equal(cleanHttp.body.valid, true);
  assert.equal(cleanHttp.body.anchoring, 'MATCH');

  const attack = cleanText.replace('"value":0.1', '"value":0.10000000000000001');
  assert.notEqual(attack, cleanText);
  const attackFile = write('B6-decimal-threshold.receipt.json', attack);
  const permissiveVerification = verifyRun(JSON.parse(attack), clean.digest);
  assert.equal(permissiveVerification.valid, true);
  assert.equal(permissiveVerification.anchoring, 'MATCH');
  const strictTextVerification = verifyRunText(attack, clean.digest);
  assertRefused(strictTextVerification);
  const attackCli = command(['verify', join(root, attackFile.file), '--expect', clean.digest]);
  assert.equal(attackCli.exitCode, 1);
  assertRefused(JSON.parse(attackCli.stdout));
  const attackHttp = await post('/api/verify', attack, clean.digest);
  assert.equal(attackHttp.status, 200);
  assertRefused(attackHttp.body);
  const legacyEnvelope = `{"receipt":${attack.trim()},"expectedDigest":"${clean.digest}"}\n`;
  const envelopeFile = write('B6-decimal-threshold.envelope.json', legacyEnvelope);
  const envelopeHttp = await post('/api/verify', legacyEnvelope, clean.digest);
  assert.equal(envelopeHttp.status, 200);
  assertRefused(envelopeHttp.body);

  const runtimeAfter = executionRuntime();
  assert.deepEqual(runtimeAfter, runtime, 'Production source/code or runtime changed during evidence generation');
  const results = {
    schema:'cosmic.commons.numeric-attack-evidence.v2',
    origin:'ORIGINAL_REGRESSION_AND_ADDITIONAL_BOUNDARIES',
    originalRegressionInputAvailable:true,
    scope:'Both original regression B6 files are read without rewriting and checked against their original SHA-256 hashes. Additional cases cover decimal collapse and exact-spelling unsafe integers. These are builder checks; independent validation remains required.',
    runtime,
    runtimeStable:true,
    script:{file:'verification/numeric-attack-evidence.mjs',sha256:digestBytes(readFileSync(scriptPath))},
    cases,
    receiptAttack:{
      cleanInput:cleanInputFile,cleanReceipt:cleanFile,trustedDigest:clean.digest,anchorFile,
      cleanCli,cleanHttp,
      attack:attackFile,mutation:'Only the first policy threshold token 0.1 was replaced with 0.10000000000000001; the digest was not changed.',
      permissiveVerification,strictTextVerification,cli:attackCli,http:attackHttp,
      legacyEnvelope:envelopeFile,legacyEnvelopeHttp:envelopeHttp,
    },
    passed:true,
  };
  const text = JSON.stringify(results, null, 2) + '\n';
  write('results.json', text);
  process.stdout.write(text);
} finally {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
