// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageRoot, packagePath } from '../src/package-root.ts';
import { spawnSync } from 'node:child_process';
import { parseStrictJson, StrictJsonError, MAX_JSON_BYTES, MAX_JSON_DEPTH } from '../src/strict-json.ts';
import { runRequest, verifyRun, verifyRunText } from '../src/run.ts';
import { createReceipt, verifyReceiptText, captureEnvironment } from '../src/receipt.ts';
import { getExample } from '../src/examples.ts';
import { createWorkbenchServer } from '../src/server.ts';

function rejects(raw: string, code = 'DUPLICATE_JSON_KEY'): void {
  assert.throws(() => parseStrictJson(raw), (error: unknown) => error instanceof StrictJsonError && error.code === code);
}
function duplicateVerdict(raw: string): string {
  const needle = '"verdict":"DEFER"';
  assert.ok(raw.includes(needle));
  return raw.replace(needle, '"verdict":"ALLOW",' + needle);
}

test('strict JSON rejects duplicate decoded keys throughout nested objects and arrays', () => {
  for (const raw of [
    '{"status":"SUPPORTED_WITHIN_SCOPE","status":"OUT_OF_GRAMMAR"}',
    '{"status":1,"status":1}',
    String.raw`{"status":1,"sta\u0074us":2}`,
    '{"a":[{"inner":{"x":1,"x":2}}]}',
    '{"":1,"":2}',
    '{"__proto__":{},"__proto__":{}}',
    String.raw`{"😀":1,"\ud83d\ude00":2}`,
    String.raw`{"a\\b":1,"a\u005cb":2}`,
  ]) rejects(raw);
});

test('strict JSON preserves native values, repeated keys in separate objects, and safe own __proto__', () => {
  for (const raw of [
    '{"a":{"x":1},"b":{"x":2},"rows":[{"x":3},{"x":4}]}',
    String.raw`{"quote\"slash\\": "braces {}, commas , and quote \"", "n":-1.25e+4}`,
    String.raw`["\u0000","\ud800",null,false,true,0,1.5e-2]`,
    '{"__proto__":{"polluted":true},"constructor":7}',
    ' \r\n\t {"wide":9007199254740991} ',
  ]) assert.deepEqual(parseStrictJson(raw), JSON.parse(raw));
  const value = parseStrictJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal(Object.hasOwn(value, '__proto__'), true);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('strict JSON rejects malformed syntax, escapes, control characters, and trailing content', () => {
  for (const raw of ['', '{', '[', '{"a":1,}', '[1,]', '{"a" 1}', '{a:1}', '01', '-01', '1.', '1e', 'NaN', '+1', 'true false', '{}{}', '"unterminated', String.raw`"\q"`, String.raw`"\u00xz"`, '"\n"', '\u00a0{}', '[undefined]']) {
    rejects(raw, 'INVALID_JSON');
  }
});

test('strict JSON enforces UTF-8 byte and nested-container limits with controlled errors', () => {
  assert.equal((parseStrictJson('"' + 'a'.repeat(MAX_JSON_BYTES - 2) + '"') as string).length, MAX_JSON_BYTES - 2);
  rejects('"' + 'a'.repeat(MAX_JSON_BYTES - 1) + '"', 'JSON_TOO_LARGE');
  rejects('"' + 'é'.repeat(MAX_JSON_BYTES / 2) + '"', 'JSON_TOO_LARGE');
  assert.doesNotThrow(() => parseStrictJson('['.repeat(MAX_JSON_DEPTH) + '0' + ']'.repeat(MAX_JSON_DEPTH)));
  rejects('['.repeat(MAX_JSON_DEPTH + 1) + '0' + ']'.repeat(MAX_JSON_DEPTH + 1), 'JSON_TOO_DEEP');
});

test('run receipt text rejects a false first verdict even when parsed replay and external anchor match', () => {
  const receipt = runRequest(getExample('release-deferred'));
  const raw = JSON.stringify(receipt);
  const attack = duplicateVerdict(raw);
  // Demonstrate the former failure: the attack preserves the last-wins object.
  assert.equal(verifyRun(JSON.parse(attack), receipt.digest).valid, true);
  assert.equal(verifyRunText(raw, receipt.digest).valid, true);
  const refused = verifyRunText(attack, receipt.digest);
  assert.equal(refused.valid, false);
  assert.equal(refused.replay, 'NOT_RUN');
  assert.match(refused.reason, /^DUPLICATE_JSON_KEY:/);
  assert.match(verifyRunText(attack.replace('"verdict":"ALLOW"', '"ver\\u0064ict":"ALLOW"'), receipt.digest).reason, /^DUPLICATE_JSON_KEY:/);
});

test('policy receipt text rejects duplicate verdicts before canonicalization', () => {
  const request = getExample('release-deferred');
  const receipt = createReceipt({policy:request.policy,evidence:request.evidence,asOf:request.asOf,environment:captureEnvironment()});
  const raw = JSON.stringify(receipt);
  assert.equal(verifyReceiptText(raw, {trustedDigest:receipt.digest}).valid, true);
  const refused = verifyReceiptText(duplicateVerdict(raw), {trustedDigest:receipt.digest});
  assert.equal(refused.valid, false);
  assert.equal(refused.integrityValid, false);
  assert.equal(refused.replayValid, false);
  assert.equal(refused.issues[0], 'DUPLICATE_JSON_KEY');
});

test('CLI refuses raw duplicate keys while a valid receipt still passes anchored replay', () => {
  const directory = mkdtempSync(join(tmpdir(), 'commons-duplicate-'));
  const cli = packagePath('bin','cosmic.mjs');
  const receipt = runRequest(getExample('release-deferred'));
  const raw = JSON.stringify(receipt);
  try {
    const path = join(directory, 'receipt.json');
    for (const [content, expected] of [[raw, true], [duplicateVerdict(raw), false]] as const) {
      writeFileSync(path, content);
      const result = spawnSync(process.execPath, [cli, 'verify', path, '--expect', receipt.digest], {encoding:'utf8'});
      assert.equal(result.status, expected ? 0 : 1, result.stderr);
      const answer = JSON.parse(result.stdout);
      assert.equal(answer.valid, expected);
      if (!expected) assert.match(answer.reason, /^DUPLICATE_JSON_KEY:/);
    }
  } finally { rmSync(directory, {recursive:true,force:true}); }
});

test('HTTP refuses raw and legacy-envelope duplicates without losing uploaded text', async () => {
  const server = createWorkbenchServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  const receipt = runRequest(getExample('release-deferred'));
  const raw = JSON.stringify(receipt);
  const attack = duplicateVerdict(raw);
  const post = async (path: string, body: string) => fetch(url + path, {method:'POST',headers:{'Content-Type':'application/json','X-Cosmic-Expected-Digest':receipt.digest},body});
  try {
    assert.equal(((await (await post('/api/verify', raw)).json() as any)).valid, true);
    for (const body of [attack, `{"receipt":${attack}}`, `{"receipt":${raw},"receipt":${raw}}`, `{"receipt":${raw},"expectedDigest":"${receipt.digest}","expectedDigest":"${receipt.digest}"}`]) {
      const response = await post('/api/verify', body);
      const result = (await response.json() as any);
      assert.equal(result.valid, false);
      assert.equal(result.replay, 'NOT_RUN');
      assert.match(result.reason, /^DUPLICATE_JSON_KEY:/);
    }
    const input = JSON.stringify(getExample('release-deferred')).replace('"kind":"policy"', '"kind":"discovery","kind":"policy"');
    const response = await post('/api/run', input);
    assert.equal(response.status, 400);
    assert.equal(((await response.json() as any)).code, 'DUPLICATE_JSON_KEY');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
