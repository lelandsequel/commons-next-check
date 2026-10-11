// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packagePath } from "../src/package-root.js";
import { canonicalize } from "../src/canonical.js";
import { spawnSync } from 'node:child_process';
import { parseStrictJson, StrictJsonError, MAX_JSON_BYTES } from "../src/strict-json.js";
import { evaluatePolicy } from "../src/policy.js";
import { runRequest, verifyRun, verifyRunText } from "../src/run.js";
import { createReceipt, verifyReceipt, verifyReceiptText, captureEnvironment } from "../src/receipt.js";
import { createWorkbenchServer } from "../src/server.js";
const code = 'NUMBER_NOT_ROUNDTRIPPABLE';
const asOf = '2026-10-02T00:00:00Z';
function request(op, actual, expected) {
    return `{"kind":"policy","asOf":"${asOf}","policy":{"id":"reconstructed-b6","version":"1","rules":[{"id":"limit","factId":"number","op":"${op}","value":${expected}}]},"evidence":{"sources":[{"id":"declared"}],"facts":[{"id":"number","sourceId":"declared","value":${actual}}]}}`;
}
function rejects(raw, expectedCode = code) {
    assert.throws(() => parseStrictJson(raw), (error) => error instanceof StrictJsonError && error.code === expectedCode, raw.slice(0, 200));
}
test('strict JSON retains ordinary decimals, safe boundaries and exactly equivalent spellings', () => {
    for (const raw of [
        '0', '0.000e99999999999999999999999999999999999', '0.1', '1.00e-1', '1e0',
        '1.2300', '-1.2300', '1E+0002', '9007199254740991', '-9007199254740991',
        '9007199254740991.0', '9.007199254740991e15', '-9.007199254740991e15',
        '5e-324', '2.2250738585072014e-308',
        '[{"n":0.1},{"n":1.00e-1}]', '{"9007199254740993":"0.10000000000000001"}',
    ])
        assert.deepEqual(parseStrictJson(raw), JSON.parse(raw), raw);
});
test('strict JSON refuses exactly round-tripping integers outside the safe range at every depth', () => {
    for (const token of [
        '9007199254740992', '-9007199254740992', '9007199254740992.0',
        '9.007199254740992e15', '-9.007199254740992e15',
        '1e20', '-1E+00020', '1000000000000000100', '1.7976931348623157e308',
    ]) {
        rejects(token, 'UNSAFE_INTEGER');
        rejects(`{"outer":[{"n":${token}}]}`, 'UNSAFE_INTEGER');
    }
    for (const malformed of ['9007199254740992x', '9007199254740992.', '9007199254740992e', '09007199254740992']) {
        rejects(malformed, 'INVALID_JSON');
    }
});
test('strict JSON refuses decimal collapse, underflow, overflow and negative zero at every depth', () => {
    for (const raw of [
        '9007199254740993', '-9007199254740993', '0.10000000000000001',
        '1.0000000000000001', '1e-400', '-1e-400', '4e-324', '1e309', '-1e309',
        '-0', '-0.000e1000000', '1e99999999999999999999999999999999999',
        '1e-99999999999999999999999999999999999',
        '{"rules":[{"value":{"nested":[0.10000000000000001]}}]}',
    ])
        rejects(raw);
});
test('numeric validation handles long bounded tokens without expanding huge exponents', () => {
    const zeroes = '0'.repeat(100_000);
    assert.equal(parseStrictJson('1' + zeroes + 'e-100000'), 1);
    assert.equal(parseStrictJson('1e+' + zeroes + '0'), 1);
    assert.equal(parseStrictJson('0e' + '9'.repeat(MAX_JSON_BYTES - 2)), 0);
    rejects('1e' + '9'.repeat(MAX_JSON_BYTES - 2));
    rejects('1' + zeroes + '1e-100001');
});
test('reconstructed B6 false ALLOW cases are refused before policy evaluation', () => {
    // These independent cases supplement original regression files preserved below.
    for (const [op, actual, expected] of [
        ['lte', '9007199254740993', '9007199254740992'],
        ['gte', '0.1', '0.10000000000000001'],
        ['eq', '9007199254740993', '9007199254740992'],
        ['eq', '{"nested":[0.10000000000000001]}', '{"nested":[0.1]}'],
        ['in', '0.10000000000000001', '[0.1]'],
    ]) {
        const raw = request(op, actual, expected);
        const materialized = JSON.parse(raw);
        if (op === 'lte' || op === 'eq' && actual === '9007199254740993') {
            assert.equal(materialized.policy.rules[0].value, materialized.evidence.facts[0].value);
            assert.equal(evaluatePolicy(materialized.policy, materialized.evidence, asOf).verdict, 'ERROR');
            // Rule values occur before evidence values in this fixture's raw text.
            rejects(raw, 'UNSAFE_INTEGER');
        }
        else {
            assert.equal(evaluatePolicy(materialized.policy, materialized.evidence, asOf).verdict, 'ALLOW');
            rejects(raw);
        }
    }
    const ordinary = parseStrictJson(request('gte', '0.1', '0.100'));
    assert.equal(evaluatePolicy(ordinary.policy, ordinary.evidence, asOf).verdict, 'ALLOW');
    const distinct = parseStrictJson(request('gte', '0.1', '0.10000000000000002'));
    assert.equal(evaluatePolicy(distinct.policy, distinct.evidence, asOf).verdict, 'DENY');
});
const numberRegressions = [
    { name: 'bigint-eq', sha256: 'fac169ecdc38c58affbf7df81e1b53baf9c5db4d3aa36f0ff57f74daf42a4e11' },
    { name: 'underflow-lte', sha256: '57415048f1a748bb4d64fcf2d2177a458b9f4cfd08a6b57b7d5bbe646375603b' },
];
test('Original regression B6 files retain their exact bytes and refuse before policy evaluation', () => {
    for (const fixture of numberRegressions) {
        const bytes = readFileSync(packagePath('tests', 'fixtures', 'regression', 'numbers', `${fixture.name}.json`));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.sha256);
        rejects(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
});
test('object and generated receipt boundaries refuse unsafe integers consistently', () => {
    for (const value of [9007199254740992, -9007199254740992, 1e20, Number.MAX_VALUE]) {
        assert.throws(() => canonicalize({ nested: [value] }), /UNSAFE_INTEGER/);
        const input = JSON.parse(request('eq', String(value), String(value)));
        assert.throws(() => runRequest(input), /UNSAFE_INTEGER/);
        assert.throws(() => createReceipt({ policy: input.policy, evidence: input.evidence, asOf, environment: captureEnvironment() }), /UNSAFE_INTEGER/);
    }
    const safe = JSON.parse(request('eq', '9007199254740991', '9007199254740991'));
    const run = runRequest(safe);
    assert.equal(verifyRunText(JSON.stringify(run), run.digest).valid, true);
});
test('SDK receipt text APIs refuse unsafe integers before replay or integrity checks', () => {
    const input = JSON.parse(request('gte', '9007199254740991', '9007199254740991'));
    const run = runRequest(input);
    const runAttack = JSON.stringify(run).replace('9007199254740991', '9007199254740992');
    const answer = verifyRunText(runAttack, run.digest);
    assert.equal(answer.valid, false);
    assert.equal(answer.replay, 'NOT_RUN');
    assert.match(answer.reason, /^UNSAFE_INTEGER:/);
    const receipt = createReceipt({ policy: input.policy, evidence: input.evidence, asOf, environment: captureEnvironment() });
    const policyAttack = JSON.stringify(receipt).replace('9007199254740991', '9007199254740992');
    const policyAnswer = verifyReceiptText(policyAttack, { trustedDigest: receipt.digest });
    assert.equal(policyAnswer.valid, false);
    assert.equal(policyAnswer.replayValid, false);
    assert.equal(policyAnswer.integrityValid, false);
    assert.equal(policyAnswer.issues[0], 'UNSAFE_INTEGER');
});
test('receipt text refuses a decimal substitution even when materialized replay and trusted digest match', () => {
    const input = JSON.parse(request('gte', '0.1', '0.1'));
    const run = runRequest(input);
    const runText = JSON.stringify(run);
    const runAttack = runText.replace('"value":0.1', '"value":0.10000000000000001');
    assert.notEqual(runAttack, runText);
    assert.equal(verifyRun(JSON.parse(runAttack), run.digest).valid, true);
    assert.equal(verifyRunText(runText, run.digest).valid, true);
    const refused = verifyRunText(runAttack, run.digest);
    assert.equal(refused.valid, false);
    assert.equal(refused.replay, 'NOT_RUN');
    assert.match(refused.reason, /^NUMBER_NOT_ROUNDTRIPPABLE:/);
    const receipt = createReceipt({ policy: input.policy, evidence: input.evidence, asOf, environment: captureEnvironment() });
    const text = JSON.stringify(receipt);
    const attack = text.replace('"value":0.1', '"value":0.10000000000000001');
    assert.notEqual(attack, text);
    assert.equal(verifyReceipt(JSON.parse(attack), { trustedDigest: receipt.digest }).valid, true);
    assert.equal(verifyReceiptText(text, { trustedDigest: receipt.digest }).valid, true);
    const policyRefused = verifyReceiptText(attack, { trustedDigest: receipt.digest });
    assert.equal(policyRefused.valid, false);
    assert.equal(policyRefused.integrityValid, false);
    assert.equal(policyRefused.replayValid, false);
    assert.equal(policyRefused.issues[0], code);
});
test('CLI rejects numeric collapse in raw run inputs and anchored receipts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'commons-numeric-'));
    const cli = packagePath('bin', 'cosmic.mjs');
    try {
        const inputPath = join(directory, 'input.json');
        writeFileSync(inputPath, request('gte', '0.1', '0.10000000000000001'));
        const run = spawnSync(process.execPath, [cli, 'run', inputPath], { encoding: 'utf8' });
        assert.equal(run.status, 2, run.stderr);
        assert.match(run.stderr, /^COSMIC: NUMBER_NOT_ROUNDTRIPPABLE:/);
        assert.equal(run.stdout, '');
        const receipt = runRequest(JSON.parse(request('gte', '0.1', '0.1')));
        const receiptPath = join(directory, 'receipt.json');
        writeFileSync(receiptPath, JSON.stringify(receipt).replace('"value":0.1', '"value":0.10000000000000001'));
        const verification = spawnSync(process.execPath, [cli, 'verify', receiptPath, '--expect', receipt.digest], { encoding: 'utf8' });
        assert.equal(verification.status, 1, verification.stderr);
        const answer = JSON.parse(verification.stdout);
        assert.equal(answer.valid, false);
        assert.equal(answer.replay, 'NOT_RUN');
        assert.match(answer.reason, /^NUMBER_NOT_ROUNDTRIPPABLE:/);
    }
    finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
test('CLI refuses Original regression B6 inputs and exactly represented unsafe integers', () => {
    const directory = mkdtempSync(join(tmpdir(), 'commons-number-regression-'));
    const cli = packagePath('bin', 'cosmic.mjs');
    try {
        for (const fixture of numberRegressions) {
            const inputPath = packagePath('tests', 'fixtures', 'regression', 'numbers', `${fixture.name}.json`);
            const result = spawnSync(process.execPath, [cli, 'run', inputPath], { encoding: 'utf8' });
            assert.equal(result.error, undefined);
            assert.equal(result.status, 2, result.stderr);
            assert.equal(result.stdout, '');
            assert.match(result.stderr, /^COSMIC: NUMBER_NOT_ROUNDTRIPPABLE:/);
        }
        const inputPath = join(directory, 'unsafe.json');
        writeFileSync(inputPath, request('eq', '9007199254740992', '9007199254740992'));
        const unsafe = spawnSync(process.execPath, [cli, 'run', inputPath], { encoding: 'utf8' });
        assert.equal(unsafe.error, undefined);
        assert.equal(unsafe.status, 2, unsafe.stderr);
        assert.equal(unsafe.stdout, '');
        assert.match(unsafe.stderr, /^COSMIC: UNSAFE_INTEGER:/);
        const receipt = runRequest(JSON.parse(request('gte', '9007199254740991', '9007199254740991')));
        const receiptPath = join(directory, 'receipt.json');
        writeFileSync(receiptPath, JSON.stringify(receipt).replace('9007199254740991', '9007199254740992'));
        const verification = spawnSync(process.execPath, [cli, 'verify', receiptPath, '--expect', receipt.digest], { encoding: 'utf8' });
        assert.equal(verification.error, undefined);
        assert.equal(verification.status, 1, verification.stderr);
        const answer = JSON.parse(verification.stdout);
        assert.equal(answer.valid, false);
        assert.equal(answer.replay, 'NOT_RUN');
        assert.match(answer.reason, /^UNSAFE_INTEGER:/);
    }
    finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
test('HTTP rejects numeric collapse in raw run inputs and both receipt envelope forms', async () => {
    const server = createWorkbenchServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const receipt = runRequest(JSON.parse(request('gte', '0.1', '0.1')));
    const receiptText = JSON.stringify(receipt);
    const attack = receiptText.replace('"value":0.1', '"value":0.10000000000000001');
    const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cosmic-Expected-Digest': receipt.digest }, body });
    try {
        const valid = await post('/api/run', request('gte', '0.1', '0.1'));
        assert.equal(valid.status, 200);
        const invalid = await post('/api/run', request('gte', '0.1', '0.10000000000000001'));
        assert.equal(invalid.status, 400);
        assert.equal((await invalid.json()).code, code);
        for (const fixture of numberRegressions) {
            const raw = readFileSync(packagePath('tests', 'fixtures', 'regression', 'numbers', `${fixture.name}.json`), 'utf8');
            const result = await post('/api/run', raw);
            assert.equal(result.status, 400);
            assert.equal((await result.json()).code, code);
        }
        const unsafe = await post('/api/run', request('eq', '9007199254740992', '9007199254740992'));
        assert.equal(unsafe.status, 400);
        assert.equal((await unsafe.json()).code, 'UNSAFE_INTEGER');
        assert.equal((await (await post('/api/verify', receiptText)).json()).valid, true);
        for (const body of [attack, `{"receipt":${attack}}`]) {
            const result = await (await post('/api/verify', body)).json();
            assert.equal(result.valid, false);
            assert.equal(result.replay, 'NOT_RUN');
            assert.match(result.reason, /^NUMBER_NOT_ROUNDTRIPPABLE:/);
        }
        const safeIntegerRun = runRequest(JSON.parse(request('eq', '9007199254740991', '9007199254740991')));
        const unsafeReceipt = JSON.stringify(safeIntegerRun).replace('9007199254740991', '9007199254740992');
        for (const body of [unsafeReceipt, `{"receipt":${unsafeReceipt}}`]) {
            const result = await (await post('/api/verify', body)).json();
            assert.equal(result.valid, false);
            assert.equal(result.replay, 'NOT_RUN');
            assert.match(result.reason, /^UNSAFE_INTEGER:/);
        }
    }
    finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});
