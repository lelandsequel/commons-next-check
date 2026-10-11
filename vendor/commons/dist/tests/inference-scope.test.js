// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalize, CANONICAL_MAX_NODES, CANONICAL_MAX_BYTES } from "../src/canonical.js";
import { DiscoverySession, FamilyAdequacyMonitor } from "../src/inference/index.js";
import { packagePath } from "../src/package-root.js";
import { parseStrictJson } from "../src/strict-json.js";
import { runRequest, validateInput } from "../src/run.js";
function input(outcomes = ['yes', 'no'], monitored = true, count = 1, hypotheses = 2) {
    const ids = Array.from({ length: hypotheses }, (_, i) => `h${i}`);
    return { kind: 'discovery', definition: { modelId: 'adequacy-scope', budget: 5000,
            observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment',
            hypotheses: ids.map(id => ({ id, prior: 1 / hypotheses })),
            experiments: [{ id: 'probe', cost: 1, outcomes,
                    likelihoods: Object.fromEntries(ids.map(id => [id, Object.fromEntries(outcomes.map(outcome => [outcome, 1 / outcomes.length]))])) }] },
        observations: Array.from({ length: count }, (_, i) => ({ id: `o${i}`, experimentId: 'probe', outcome: outcomes[i % outcomes.length] })),
        ...(monitored ? { adequacy: { alpha: 0.05, epochId: 'scope' } } : {}),
        actions: [{ id: 'act', losses: Object.fromEntries(ids.map(id => [id, 0])) }] };
}
test('Original regression B1 fixtures both DEFER and suppress actions', () => {
    for (const name of ['with-zero-prior', 'without-zero-prior']) {
        const raw = readFileSync(packagePath('tests', 'fixtures', 'regression', 'adequacy', `${name}.json`), 'utf8');
        const result = runRequest(parseStrictJson(raw)).result;
        assert.equal(result.adequacy.status, 'REJECTED_DECLARED_FAMILY', name);
        assert.equal(result.decisionStatus, 'DEFER', name);
        assert.equal(result.action, null, name);
    }
});
test('omitted adequacy is explicitly NOT_EVALUATED and cannot suggest an integrated action', () => {
    const result = runRequest(input(['yes', 'no'], false)).result;
    assert.equal(result.adequacy.status, 'NOT_EVALUATED');
    assert.match(result.adequacy.reason, /not requested/);
    assert.equal(result.decisionStatus, 'DEFER');
    assert.equal(result.action, null);
    assert.equal(result.recommendation.reason, 'adequacy-not-evaluated');
    assert.deepEqual(result.snapshot.posterior, { h0: 0.5, h1: 0.5 });
    assert.equal(result.snapshot.receipts.length, 1);
});
test('a valid three-outcome discovery is UNSUPPORTED for adequacy, while retaining its conditional posterior', () => {
    const result = runRequest(input(['yes', 'no', 'other'])).result;
    assert.equal(result.adequacy.status, 'UNSUPPORTED');
    assert.deepEqual(result.adequacy.unsupportedExperimentIds, ['probe']);
    assert.equal(result.decisionStatus, 'DEFER');
    assert.equal(result.action, null);
    assert.equal(result.recommendation.reason, 'adequacy-unsupported');
    assert.deepEqual(result.snapshot.posterior, { h0: 0.5, h1: 0.5 });
    assert.equal(result.snapshot.receipts.length, 1);
    const malformed = input(['yes', 'no', 'other']);
    malformed.adequacy.alpha = 0;
    assert.throws(() => runRequest(malformed), /alpha/);
});
test('a supported nonrejected monitor retains model-conditional action suggestions', () => {
    const result = runRequest(input()).result;
    assert.equal(result.adequacy.status, 'NOT_REJECTED');
    assert.equal(result.decisionStatus, 'AVAILABLE');
    assert.ok(result.action);
});
test('receipt budget refuses oversize observation chains before inference and scales with family size', () => {
    assert.throws(() => validateInput(input(['yes', 'no'], true, 1100)), /DISCOVERY_RECEIPT_LIMIT/);
    assert.doesNotThrow(() => validateInput(input(['yes', 'no'], true, 100)));
    assert.throws(() => validateInput(input(['yes', 'no'], true, 200, 100)), /DISCOVERY_RECEIPT_LIMIT/);
    assert.throws(() => validateInput(input(['yes', 'no'], false, 5001)), /at most 5000/);
});
test('largest admitted chains fit canonical receipt limits with and without adequacy', () => {
    for (const monitored of [false, true]) {
        let low = 0, high = 5000;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            try {
                validateInput(input(['yes', 'no'], monitored, middle));
                low = middle;
            }
            catch (error) {
                assert.match(String(error), /DISCOVERY_RECEIPT_LIMIT/);
                high = middle - 1;
            }
        }
        assert.ok(low > 0 && low < 5000);
        const receipt = runRequest(input(['yes', 'no'], monitored, low));
        const encoded = canonicalize(receipt);
        const count = (value) => value !== null && typeof value === 'object'
            ? 1 + Object.values(value).reduce((sum, child) => sum + count(child), 0) : 1;
        assert.ok(count(JSON.parse(encoded)) <= CANONICAL_MAX_NODES);
        assert.ok(Buffer.byteLength(JSON.stringify(receipt, null, 2), 'utf8') <= CANONICAL_MAX_BYTES);
        assert.throws(() => validateInput(input(['yes', 'no'], monitored, low + 1)), /DISCOVERY_RECEIPT_LIMIT/);
    }
});
test('long identifier amplification is refused before inference in integrated and low-level APIs', () => {
    const request = input(['yes', 'no'], true, 100);
    const ids = ['a'.repeat(20_000), 'b'.repeat(20_000)];
    request.definition.hypotheses = ids.map(id => ({ id, prior: 0.5 }));
    request.definition.experiments[0].likelihoods = Object.fromEntries(ids.map(id => [id, { yes: 0.5, no: 0.5 }]));
    delete request.actions;
    assert.ok(Buffer.byteLength(JSON.stringify(request), 'utf8') < 100_000);
    assert.throws(() => validateInput(request), /DISCOVERY_IDENTIFIER_LIMIT/);
    assert.throws(() => new DiscoverySession(request.definition), /DISCOVERY_IDENTIFIER_LIMIT/);
    assert.throws(() => new FamilyAdequacyMonitor(input().definition, { alpha: 0.05, epochId: 'x'.repeat(257) }), /DISCOVERY_IDENTIFIER_LIMIT/);
});
test('byte preflight accounts for escaped and multibyte identifiers in repeated receipt fields', () => {
    const request = input(['yes', 'no'], true, 1);
    const ids = ['a' + '\u0001'.repeat(255), 'b' + '漢'.repeat(255)];
    const outcomes = ['x' + '\u0002'.repeat(255), 'y' + '龍'.repeat(255)];
    const experimentId = 'e' + '\u0003'.repeat(255);
    request.definition.modelId = 'm' + '字'.repeat(255);
    request.definition.hypotheses = ids.map(id => ({ id, prior: 0.5 }));
    request.definition.experiments = [{ id: experimentId, cost: 1, outcomes,
            likelihoods: Object.fromEntries(ids.map(id => [id, Object.fromEntries(outcomes.map(outcome => [outcome, 0.5]))])) }];
    request.adequacy.epochId = 'z' + '\u0004'.repeat(255);
    request.actions = [{ id: 'a' + '\u0005'.repeat(255), losses: Object.fromEntries(ids.map(id => [id, 0])) }];
    let admitted = 0;
    for (let length = 1; length <= 100; length++) {
        request.observations = Array.from({ length }, (_, i) => ({ id: String(i).padEnd(256, '\u0006'), experimentId, outcome: outcomes[i % 2] }));
        try {
            validateInput(request);
            admitted = length;
        }
        catch (error) {
            assert.match(String(error), /DISCOVERY_RECEIPT_LIMIT/);
            break;
        }
    }
    assert.ok(admitted > 0 && admitted < 100);
    request.observations = request.observations.slice(0, admitted);
    const receipt = runRequest(request);
    assert.ok(Buffer.byteLength(JSON.stringify(receipt, null, 2), 'utf8') <= CANONICAL_MAX_BYTES);
});
