// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, thresholdSensitivity } from "../src/policy.js";
const asOf = '2026-09-29T00:00:00Z';
const policy = () => ({ id: 'launch', version: '1', rules: [{ id: 'threshold', factId: 'score', op: 'gte', value: 80 }] });
const bundle = () => ({ sources: [{ id: 's' }], facts: [{ id: 'score', sourceId: 's', value: 85 }] });
test('known pass, known fail, absent evidence and malformed rule produce four distinct outcomes', () => {
    assert.equal(evaluatePolicy(policy(), bundle(), asOf).verdict, 'ALLOW');
    const low = bundle();
    low.facts[0].value = 79;
    assert.equal(evaluatePolicy(policy(), low, asOf).verdict, 'DENY');
    assert.equal(evaluatePolicy(policy(), { sources: [], facts: [] }, asOf).verdict, 'DEFER');
    const invalid = policy();
    invalid.rules[0].op = 'eval';
    assert.equal(evaluatePolicy(invalid, bundle(), asOf).verdict, 'ERROR');
});
test('numeric comparison never coerces a string into a number', () => {
    const value = bundle();
    value.facts[0].value = '85';
    const report = evaluatePolicy(policy(), value, asOf);
    assert.equal(report.verdict, 'ERROR');
    assert.equal(report.trace[0].code, 'TYPE_MISMATCH');
});
test('missing exists is unknown while a recorded null value exists', () => {
    const rule = policy();
    rule.rules = [{ id: 'required', factId: 'score', op: 'exists' }];
    const value = bundle();
    value.facts[0].value = null;
    assert.equal(evaluatePolicy(rule, value, asOf).verdict, 'ALLOW');
    assert.equal(evaluatePolicy(rule, { sources: [], facts: [] }, asOf).verdict, 'DEFER');
});
test('all-requirement evaluation records every rule and makes a known failure decisive', () => {
    const rule = policy();
    rule.rules.push({ id: 'other', factId: 'absent', op: 'exists' });
    const value = bundle();
    value.facts[0].value = 70;
    const report = evaluatePolicy(rule, value, asOf);
    assert.equal(report.verdict, 'DENY');
    assert.deepEqual(report.trace.map((item) => item.result), ['FAIL', 'DEFER']);
});
test('equality handles structured JSON and membership remains type-sensitive', () => {
    const value = bundle();
    value.facts[0].value = { b: 2, a: 1 };
    const rule = policy();
    rule.rules[0] = { id: 'same', factId: 'score', op: 'eq', value: { a: 1, b: 2 } };
    assert.equal(evaluatePolicy(rule, value, asOf).verdict, 'ALLOW');
    value.facts[0].value = 1;
    rule.rules[0] = { id: 'member', factId: 'score', op: 'in', value: ['1', 2] };
    assert.equal(evaluatePolicy(rule, value, asOf).verdict, 'DENY');
});
test('fact IDs are exact map keys with no property traversal', () => {
    const value = bundle();
    value.facts[0].id = '__proto__';
    const rule = policy();
    rule.rules[0].factId = '__proto__';
    assert.equal(evaluatePolicy(rule, value, asOf).verdict, 'ALLOW');
    rule.rules[0].factId = 'score.constructor';
    assert.equal(evaluatePolicy(rule, value, asOf).verdict, 'DEFER');
});
test('expired or conflicted required facts defer and cycles error', () => {
    const expired = bundle();
    expired.facts[0].expiresAt = asOf;
    assert.equal(evaluatePolicy(policy(), expired, asOf).verdict, 'DEFER');
    const conflict = bundle();
    conflict.facts[0].claimId = 'assessment';
    conflict.facts.push({ id: 'alternate', sourceId: 's', value: 1, claimId: 'assessment' });
    assert.equal(evaluatePolicy(policy(), conflict, asOf).verdict, 'DEFER');
    const cycle = bundle();
    cycle.facts[0].dependsOn = ['score'];
    assert.equal(evaluatePolicy(policy(), cycle, asOf).verdict, 'ERROR');
});
test('vacuous allow and unknown schema fields are rejected', () => {
    const rule = policy();
    rule.rules = [];
    assert.equal(evaluatePolicy(rule, bundle(), asOf).verdict, 'ERROR');
    assert.equal(evaluatePolicy({ ...policy(), magic: true }, bundle(), asOf).verdict, 'ERROR');
});
test('interval sensitivity respects open and closed thresholds without inventing confidence', () => {
    assert.equal(thresholdSensitivity({ lower: 80, upper: 90, op: 'gte', threshold: 80 }).classification, 'ALWAYS_PASS');
    assert.equal(thresholdSensitivity({ lower: 80, upper: 90, op: 'gt', threshold: 80 }).classification, 'SENSITIVE');
    assert.equal(thresholdSensitivity({ lower: 70, upper: 79, op: 'gte', threshold: 80 }).classification, 'ALWAYS_FAIL');
    assert.equal(thresholdSensitivity({ lower: 80, upper: 80, op: 'lte', threshold: 80 }).classification, 'ALWAYS_PASS');
    assert.throws(() => thresholdSensitivity({ lower: 2, upper: 1, op: 'lte', threshold: 80 }));
});
