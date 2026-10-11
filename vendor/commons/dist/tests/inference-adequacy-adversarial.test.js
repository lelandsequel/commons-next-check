// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADEQUACY_SCHEMA_VERSION, ADEQUACY_SUPPORT_POLICY, FamilyAdequacyMonitor, currentAdequacyRuntime, hashJSON, replayFamilyAdequacy, } from "../src/inference/index.js";
import { runRequest } from "../src/run.js";
// Reconstructed from the reported zero-prior failure. This is not the original regression input.
function decoyDefinition(includeDecoy = true) {
    const config = {
        modelId: 'reconstructed-decoy-regression', budget: 4,
        observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment',
        hypotheses: [{ id: 'active-a', prior: 0.5 }, { id: 'active-b', prior: 0.5 }],
        experiments: [{ id: 'probe', cost: 1, outcomes: ['positive', 'negative'], likelihoods: {
                    'active-a': { positive: 0.1, negative: 0.9 },
                    'active-b': { positive: 0.1, negative: 0.9 },
                } }],
    };
    if (includeDecoy) {
        config.hypotheses.push({ id: 'zero-prior-decoy', prior: 0 });
        config.experiments[0].likelihoods['zero-prior-decoy'] = { positive: 1, negative: 0 };
    }
    return config;
}
const options = { alpha: 0.05, epochId: 'b1-decoy' };
const observations = Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, experimentId: 'probe', outcome: 'positive' }));
test('B1: a zero-prior decoy cannot keep an inadequate active family AVAILABLE', () => {
    const receipt = runRequest({ kind: 'discovery', definition: decoyDefinition(), observations,
        adequacy: options, actions: [{ id: 'ship', losses: { 'active-a': 0, 'active-b': 0, 'zero-prior-decoy': 100 } }] });
    const result = receipt.result;
    assert.equal(result.snapshot.posterior['zero-prior-decoy'], 0);
    assert.equal(result.adequacy.status, 'REJECTED_DECLARED_FAMILY');
    // Q=(1/2)(3/4)(5/6)(7/8)=35/128; max active L=(1/10)^4.
    assert.ok(Math.abs(result.adequacy.logEValue - Math.log((35 / 128) / 0.0001)) < 1e-13);
    assert.equal(result.adequacy.firstCrossingSequence, 2);
    assert.equal(result.decisionStatus, 'DEFER');
    assert.equal(result.action, null);
    assert.deepEqual(result.recommendation, { status: 'stop', reason: 'declared-family-rejected' });
});
test('adding excluded laws leaves the adequacy statistics unchanged and records their exclusion', () => {
    const base = new FamilyAdequacyMonitor(decoyDefinition(false), options);
    const decoy = new FamilyAdequacyMonitor(decoyDefinition(), options);
    for (const observation of observations) {
        base.observe(base.prepare(observation.id, observation.experimentId), observation.outcome);
        decoy.observe(decoy.prepare(observation.id, observation.experimentId), observation.outcome);
        const actual = decoy.snapshot();
        const expected = base.snapshot();
        for (const field of ['status', 'logEValue', 'maxLogEValue', 'firstCrossingSequence',
            'nullLogLikelihoods', 'effectiveNullLaws', 'alternativeLogLikelihood']) {
            assert.deepEqual(actual[field], expected[field], field);
        }
    }
    const snapshot = decoy.snapshot();
    assert.equal(snapshot.schemaVersion, ADEQUACY_SCHEMA_VERSION);
    assert.equal(snapshot.supportPolicy, ADEQUACY_SUPPORT_POLICY);
    assert.deepEqual(snapshot.nullHypothesisIds, ['active-a', 'active-b']);
    assert.deepEqual(snapshot.excludedZeroPriorHypothesisIds, ['zero-prior-decoy']);
    assert.equal(snapshot.nullSemantics, 'frozen-positive-prior-conditional-bernoulli-laws');
    assert.notEqual(snapshot.definitionHash, base.snapshot().definitionHash);
    assert.notEqual(snapshot.chainAnchorHash, base.snapshot().chainAnchorHash);
});
test('all strictly positive prior laws remain admitted, independent of prior magnitude', () => {
    const definition = decoyDefinition();
    definition.hypotheses[0].prior = 0.5;
    definition.hypotheses[1].prior = 0.5 - Number.EPSILON;
    definition.hypotheses[2].prior = Number.EPSILON;
    const monitor = new FamilyAdequacyMonitor(definition, options);
    for (const observation of observations)
        monitor.observe(monitor.prepare(observation.id, observation.experimentId), observation.outcome);
    assert.equal(monitor.snapshot().status, 'NOT_REJECTED');
    assert.deepEqual(monitor.snapshot().nullHypothesisIds, ['active-a', 'active-b', 'zero-prior-decoy']);
    assert.deepEqual(monitor.snapshot().excludedZeroPriorHypothesisIds, []);
    // The denominator is max L, not a prior-weighted mixture: a small admitted
    // prior must not turn the monitor into a test against a different null family.
    assert.ok(Math.abs(monitor.snapshot().logEValue - Math.log(35 / 128)) < 1e-13);
});
test('zero support is determined by the active family even when an excluded law predicts the outcome', () => {
    const definition = decoyDefinition();
    for (const id of ['active-a', 'active-b'])
        definition.experiments[0].likelihoods[id] = { positive: 0, negative: 1 };
    const monitor = new FamilyAdequacyMonitor(definition, options);
    const receipt = monitor.observe(monitor.prepare('impossible', 'probe'), 'positive');
    assert.equal(receipt.status, 'ZERO_SUPPORT_CONTRADICTION');
    assert.equal(receipt.eValueState, 'infinite-zero-support');
    assert.deepEqual(receipt.impossibleHypothesisIds, ['active-a', 'active-b']);
    assert.throws(() => monitor.prepare('after-contradiction', 'probe'), /zero support contradiction/);
    const run = runRequest({ kind: 'discovery', definition, adequacy: options,
        observations: [{ id: 'impossible', experimentId: 'probe', outcome: 'positive' }] });
    const result = run.result;
    assert.equal(result.decisionStatus, 'DEFER');
    assert.equal(result.action, null);
    assert.equal(result.adequacy.status, 'ZERO_SUPPORT_CONTRADICTION');
});
test('the admitted support is fixed before outcomes and cannot change through caller mutation', () => {
    const definition = decoyDefinition();
    const monitor = new FamilyAdequacyMonitor(definition, options);
    definition.hypotheses[2].prior = 1;
    const prepared = monitor.prepare('one', 'probe');
    assert.ok(Object.isFrozen(prepared.nullHypothesisIds));
    assert.ok(Object.isFrozen(prepared.excludedZeroPriorHypothesisIds));
    const forged = structuredClone(prepared);
    forged.nullHypothesisIds.push('zero-prior-decoy');
    const { hash: _hash, ...body } = forged;
    forged.hash = hashJSON(body);
    assert.throws(() => monitor.observe(forged, 'positive'), /verification failed/);
    assert.equal(monitor.snapshot().observationCount, 0);
    monitor.observe(prepared, 'positive');
    const snapshot = monitor.snapshot();
    snapshot.nullHypothesisIds.push('zero-prior-decoy');
    assert.deepEqual(monitor.snapshot().nullHypothesisIds, ['active-a', 'active-b']);
});
test('v2 adequacy replay binds the support contract and refuses v1 receipts', () => {
    const definition = decoyDefinition();
    const monitor = new FamilyAdequacyMonitor(definition, options);
    for (const observation of observations)
        monitor.observe(monitor.prepare(observation.id, observation.experimentId), observation.outcome);
    const snapshot = monitor.snapshot();
    assert.deepEqual(replayFamilyAdequacy(definition, options, snapshot.receipts).snapshot(), snapshot);
    assert.deepEqual(replayFamilyAdequacy(definition, options, [], currentAdequacyRuntime()).snapshot().nullHypothesisIds, ['active-a', 'active-b']);
    const changed = structuredClone(snapshot.receipts);
    changed[0].excludedZeroPriorHypothesisIds = [];
    const { hash: _hash, ...body } = changed[0];
    changed[0].hash = hashJSON(body);
    assert.throws(() => replayFamilyAdequacy(definition, options, changed), /verification failed/);
    const old = structuredClone(snapshot.receipts);
    Object.assign(old[0], { schemaVersion: 1 });
    assert.throws(() => replayFamilyAdequacy(definition, options, old), /schema mismatch/);
});
