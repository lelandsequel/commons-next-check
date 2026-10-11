// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  DiscoverySession, FamilyAdequacyMonitor, replaySession, replayFamilyAdequacy,
  compareReceiptNumerics, canonicalJSON, hashJSON, currentReplayRuntime,
} from '../src/inference/index.ts';
import type { DiscoveryConfig } from '../src/inference/index.ts';

function definition(): DiscoveryConfig {
  return {
    modelId: 'component-diagnostic-v1', budget: 10,
    observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment',
    hypotheses: [{ id: 'faulty', prior: 0.2 }, { id: 'healthy', prior: 0.8 }],
    experiments: [{ id: 'test', cost: 1, outcomes: ['positive', 'negative'], likelihoods: {
      faulty: { positive: 0.9, negative: 0.1 }, healthy: { positive: 0.1, negative: 0.9 },
    } }],
  };
}
function near(actual: number, expected: number, tolerance = 1e-14): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('Bayes matches hand-derived odds and expected-loss decisions', () => {
  const session = new DiscoverySession(definition());
  session.observe({ id: 'one', experimentId: 'test', outcome: 'positive' });
  // P(F|+) = .18/(.18+.08) = 9/13.
  near(session.posterior().faulty, 9 / 13);
  session.observe({ id: 'two', experimentId: 'test', outcome: 'positive' });
  // Posterior odds = prior odds * LR^2 = .25*81 = 20.25.
  near(session.posterior().faulty, 81 / 85);
  const action = session.chooseAction([
    { id: 'repair', losses: { faulty: 1, healthy: 5 } },
    { id: 'ignore', losses: { faulty: 20, healthy: 0 } },
  ]);
  assert.equal(action.actionId, 'repair');
  near(action.expectedLoss, 101 / 85);
});

test('perfect test yields log(2) nats; tie-break is stable lexical ID', () => {
  const config = definition();
  config.hypotheses.forEach(h => h.prior = 0.5);
  config.experiments[0].likelihoods = { faulty: { positive: 1, negative: 0 }, healthy: { positive: 0, negative: 1 } };
  config.experiments.push({ ...structuredClone(config.experiments[0]), id: 'a-test' });
  const session = new DiscoverySession(config);
  near(session.experimentUtilities()[0].expectedInformationGainNats, Math.log(2));
  const recommendation = session.recommend();
  assert.equal(recommendation.status, 'experiment');
  if (recommendation.status === 'experiment') assert.equal(recommendation.experimentId, 'a-test');
});

test('decimal budgets permit exactly three 0.1-cost observations', () => {
  const config = definition(); config.budget = 0.3; config.experiments[0].cost = 0.1;
  const session = new DiscoverySession(config);
  for (let i = 0; i < 3; i++) session.observe({ id: String(i), experimentId: 'test', outcome: 'positive' });
  assert.equal(session.remainingBudget(), 0);
  assert.equal(session.snapshot().spent, 0.3);
  assert.throws(() => session.observe({ id: 'excess', experimentId: 'test', outcome: 'positive' }), /budget/);
});

test('input and receipt mutations cannot change an active session; duplicate evidence is rejected', () => {
  const config = definition(); const session = new DiscoverySession(config);
  config.hypotheses[0].prior = 1;
  const receipt = session.observe({ id: 'one', experimentId: 'test', outcome: 'positive' });
  receipt.posterior.faulty = 0;
  near(session.posterior().faulty, 9 / 13);
  near(session.snapshot().receipts[0].posterior.faulty, 9 / 13);
  assert.throws(() => session.observe({ id: 'one', experimentId: 'test', outcome: 'positive' }), /Duplicate/);
  assert.equal(session.snapshot().spent, 1);
});

test('zero support halts action recommendation and preserves explicit mismatch', () => {
  const config = definition();
  config.experiments[0].likelihoods = { faulty: { positive: 1, negative: 0 }, healthy: { positive: 1, negative: 0 } };
  const session = new DiscoverySession(config);
  const receipt = session.observe({ id: 'impossible', experimentId: 'test', outcome: 'negative' });
  assert.equal(receipt.status, 'model-mismatch');
  assert.equal(receipt.priorPredictiveLogProbability, null);
  assert.deepEqual(session.recommend(), { status: 'stop', reason: 'model-mismatch' });
  assert.throws(() => session.chooseAction([{ id: 'act', losses: { faulty: 0, healthy: 0 } }]), /mismatch/);
});

test('exact replay rejects tampering even when the attacker recomputes a hash', () => {
  const config = definition(); const session = new DiscoverySession(config);
  session.observe({ id: 'one', experimentId: 'test', outcome: 'positive' });
  const receipts = session.snapshot().receipts;
  assert.deepEqual(replaySession(config, receipts).snapshot(), session.snapshot());
  const tampered = structuredClone(receipts);
  tampered[0].posterior.faulty = 0.7;
  const { hash: _hash, ...body } = tampered[0];
  tampered[0].hash = hashJSON(body);
  assert.throws(() => replaySession(config, tampered), /verification failed/);
});

test('runtime mismatch is refused while numerical comparison disclaims exact verification', () => {
  const config = definition(); const session = new DiscoverySession(config);
  session.observe({ id: 'one', experimentId: 'test', outcome: 'positive' });
  const receipts = session.snapshot().receipts;
  receipts[0].runtime.architecture = 'different-architecture';
  assert.throws(() => replaySession(config, receipts), /runtime mismatch/);
  const comparison = compareReceiptNumerics(config, receipts, { absoluteTolerance: 0, relativeTolerance: 0 });
  assert.equal(comparison.withinTolerance, true);
  assert.equal(comparison.exactReplayVerified, false);
  assert.throws(() => replaySession(config, []), /runtime contract/);
  assert.equal(replaySession(config, [], currentReplayRuntime()).snapshot().receipts.length, 0);
});

test('finite JSON hashing is stable and refuses sparse/nonfinite values', () => {
  assert.equal(canonicalJSON({ z: 2, a: 1 }), '{"a":1,"z":2}');
  assert.equal(hashJSON({ z: 2, a: 1 }), createHash('sha256').update('{"a":1,"z":2}').digest('hex'));
  assert.throws(() => canonicalJSON([, 1]), /dense/);
  assert.throws(() => canonicalJSON({ x: Infinity }), /finite/);
});

test('adequacy e-value matches a closed-form prequential Bernoulli calculation', () => {
  const config = definition();
  config.experiments[0].likelihoods = { faulty: { positive: 0.5, negative: 0.5 }, healthy: { positive: 0.5, negative: 0.5 } };
  const options = { alpha: 0.5, epochId: 'fixed-law-epoch' };
  const monitor = new FamilyAdequacyMonitor(config, options);
  for (let i = 0; i < 3; i++) monitor.observe(monitor.prepare(String(i), 'test'), 'positive');
  // Q = (1/2)(3/4)(5/6), L = (1/2)^3 => E = 5/2.
  near(monitor.snapshot().logEValue!, Math.log(2.5));
  assert.equal(monitor.snapshot().status, 'REJECTED_DECLARED_FAMILY');
  assert.equal(monitor.snapshot().firstCrossingSequence, 3);
  assert.deepEqual(replayFamilyAdequacy(config, options, monitor.snapshot().receipts).snapshot(), monitor.snapshot());
});

test('adequacy preparation commits predictions before the outcome and rejects forged tokens', () => {
  const monitor = new FamilyAdequacyMonitor(definition(), { alpha: 0.05, epochId: 'epoch' });
  const prepared = monitor.prepare('one', 'test');
  assert.ok(Object.isFrozen(prepared.alternativeProbabilities));
  assert.throws(() => monitor.prepare('two', 'test'), /pending/);
  const forged = structuredClone(prepared); forged.alternativeProbabilities.positive = 0.9;
  assert.throws(() => monitor.observe(forged, 'positive'), /verification failed/);
  assert.equal(monitor.snapshot().observationCount, 0);
  monitor.observe(prepared, 'positive');
  assert.equal(monitor.snapshot().observationCount, 1);
  assert.equal(monitor.snapshot().status, 'NOT_REJECTED');
});
