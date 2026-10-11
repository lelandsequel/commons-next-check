// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { packagePath } from "../src/package-root.js";
import { request as httpRequest } from 'node:http';
import { runRequest, verifyRun, validateInput } from "../src/run.js";
import { sha256 } from "../src/canonical.js";
import { createWorkbenchServer } from "../src/server.js";
const declaration = () => ({ kind: 'policy', asOf: '2026-10-02T00:00:00Z', policy: { id: 'adversarial', version: '1', rules: [{ id: 'rule', factId: 'fact', op: 'eq', value: true }] }, evidence: { sources: [{ id: 'source' }], facts: [{ id: 'fact', sourceId: 'source', value: false }] } });
function rehash(receipt) {
    const { digest: _digest, ...body } = receipt;
    return { ...body, digest: sha256(body) };
}
test('receipt verification refuses changed runtime or source artifact even with recomputed digest', () => {
    const receipt = runRequest(declaration());
    for (const field of ['node', 'v8', 'platform', 'architecture', 'endianness', 'sourceDigest', 'codeDigest', 'implementation']) {
        const changed = structuredClone(receipt);
        changed.runtime[field] = 'attacker-value';
        const verification = verifyRun(rehash(changed));
        assert.equal(verification.valid, false, field);
        assert.equal(verification.integrity, 'VALID', field);
        assert.equal(verification.replay, 'UNSUPPORTED', field);
    }
});
test('a freshly recomputed digest does not hide a false result', () => {
    const receipt = runRequest(declaration());
    receipt.result.verdict = 'ALLOW';
    assert.equal(verifyRun(receipt).integrity, 'INVALID');
    const verification = verifyRun(rehash(receipt));
    assert.equal(verification.integrity, 'VALID');
    assert.equal(verification.replay, 'MISMATCH');
    assert.equal(verification.valid, false);
});
test('self-consistent replacement passes unanchored replay but fails the original external digest', () => {
    const original = runRequest(declaration());
    const alteredInput = declaration();
    alteredInput.evidence.facts[0].value = true;
    const replacement = runRequest(alteredInput);
    const unanchored = verifyRun(replacement);
    assert.equal(unanchored.valid, true);
    assert.equal(unanchored.anchoring, 'UNANCHORED');
    assert.match(unanchored.reason, /not origin or historical completeness/);
    const anchored = verifyRun(replacement, original.digest);
    assert.equal(anchored.valid, false);
    assert.equal(anchored.anchoring, 'MISMATCH');
    assert.equal(verifyRun(original, original.digest).anchoring, 'MATCH');
});
test('wrong top-level kind, unknown fields and malformed digest are refused', () => {
    const changed = runRequest(declaration());
    changed.kind = 'discovery';
    assert.equal(verifyRun(rehash(changed)).replay, 'MISMATCH');
    assert.equal(verifyRun({ ...runRequest(declaration()), extra: true }).valid, false);
    assert.equal(verifyRun(runRequest(declaration()), 'not-a-sha256').valid, false);
    assert.throws(() => validateInput({ ...declaration(), extra: true }), /unknown field/);
    assert.throws(() => validateInput({ kind: 'unrecognized' }), /Input kind/);
    const { asOf: _asOf, ...missingTime } = declaration();
    assert.throws(() => validateInput(missingTime), /missing asOf/);
});
test('certain posterior and exact-zero likelihoods remain serializable and replayable', () => {
    const input = {
        kind: 'discovery',
        definition: {
            modelId: 'perfect-test', budget: 3,
            observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment',
            hypotheses: [{ id: 'a', prior: 0.5 }, { id: 'b', prior: 0.5 }],
            experiments: [{ id: 'probe', cost: 1, outcomes: ['yes', 'no'], likelihoods: { a: { yes: 1, no: 0 }, b: { yes: 0, no: 1 } } }],
        },
        observations: [{ id: 'one', experimentId: 'probe', outcome: 'yes' }],
        adequacy: { alpha: 0.05, epochId: 'perfect-laws' },
    };
    const receipt = runRequest(input);
    assert.equal(receipt.result.snapshot.entropyNats, 0);
    assert.equal(verifyRun(receipt).valid, true);
});
test('rejected model family cannot yield an expected-loss action', () => {
    const input = {
        kind: 'discovery',
        definition: {
            modelId: 'declared-fair-models', budget: 10,
            observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment',
            hypotheses: [{ id: 'a', prior: 0.5 }, { id: 'b', prior: 0.5 }],
            experiments: [{ id: 'probe', cost: 1, outcomes: ['yes', 'no'], likelihoods: { a: { yes: 0.5, no: 0.5 }, b: { yes: 0.5, no: 0.5 } } }],
        },
        observations: [0, 1, 2].map(i => ({ id: String(i), experimentId: 'probe', outcome: 'yes' })),
        adequacy: { alpha: 0.5, epochId: 'fair-laws' },
        actions: [{ id: 'act', losses: { a: 0, b: 1 } }],
    };
    const result = runRequest(input).result;
    assert.equal(result.adequacy.status, 'REJECTED_DECLARED_FAMILY');
    assert.equal(result.action, null);
    assert.equal(result.recommendation.status, 'stop');
});
test('HTTP boundary rejects foreign origin/host, malformed JSON and executable input', async () => {
    const server = createWorkbenchServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const address = `http://127.0.0.1:${port}`;
    try {
        assert.equal((await fetch(address + '/api/run', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
        assert.equal((await fetch(address + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.example' }, body: '{}' })).status, 403);
        assert.equal((await fetch(address + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
        assert.equal((await fetch(address + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'eval', code: 'process.exit()' }) })).status, 400);
        const foreignHostStatus = await new Promise((resolve, reject) => {
            const req = httpRequest({ hostname: '127.0.0.1', port, path: '/api/health', headers: { Host: 'foreign.example' } }, res => { res.resume(); resolve(res.statusCode); });
            req.on('error', reject);
            req.end();
        });
        assert.equal(foreignHostStatus, 403);
        assert.equal((await fetch(address + '/src/run.ts')).status, 404);
        const valid = await fetch(address + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(declaration()) });
        assert.equal(valid.status, 200);
        const receipt = await valid.json();
        const verification = await fetch(address + '/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt, expectedDigest: receipt.digest }) });
        assert.equal((await verification.json()).valid, true);
        assert.match(valid.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    }
    finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});
test('CLI returns nonzero for missing input, unsupported command and invalid options', () => {
    const cli = packagePath('bin', 'cosmic.mjs');
    for (const args of [['run'], ['unknown-command'], ['examples', '--expect', 'abc']]) {
        const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
        assert.equal(result.status, 2, args.join(' '));
        assert.match(result.stderr, /COSMIC:/);
    }
});
