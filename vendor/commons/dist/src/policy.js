// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { canonicalize, timestamp } from "./canonical.js";
import { exactKeys, inspectEvidence, requiredId } from "./evidence.js";
export function validatePolicy(value) {
    canonicalize(value);
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError('Policy must be an object');
    const policy = value;
    exactKeys(policy, ['id', 'version', 'rules'], 'policy');
    requiredId(policy.id, 'policy.id');
    requiredId(policy.version, 'policy.version');
    if (!Array.isArray(policy.rules) || policy.rules.length < 1 || policy.rules.length > 1000)
        throw new TypeError('Policy must contain between 1 and 1000 rules');
    const ids = new Set();
    for (const item of policy.rules) {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            throw new TypeError('Rule must be an object');
        const rule = item;
        exactKeys(rule, ['id', 'factId', 'op', 'value'], 'rule');
        requiredId(rule.id, 'rule.id');
        requiredId(rule.factId, 'rule.factId');
        if (ids.has(rule.id))
            throw new TypeError(`Duplicate rule id: ${rule.id}`);
        ids.add(rule.id);
        if (!['exists', 'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'].includes(rule.op))
            throw new TypeError('Unsupported rule operator');
        if (rule.op === 'exists') {
            if (Object.hasOwn(rule, 'value'))
                throw new TypeError('exists must not declare value');
        }
        else if (!Object.hasOwn(rule, 'value'))
            throw new TypeError('Comparison rule requires value');
        if (['gt', 'gte', 'lt', 'lte'].includes(rule.op) && typeof rule.value !== 'number')
            throw new TypeError('Ordered comparison requires numeric value');
        if (rule.op === 'in' && (!Array.isArray(rule.value) || rule.value.length === 0))
            throw new TypeError('in requires a nonempty array');
    }
}
function compare(actual, op, expected) {
    if (op === 'exists')
        return true;
    if (op === 'eq')
        return canonicalize(actual) === canonicalize(expected);
    if (op === 'ne')
        return canonicalize(actual) !== canonicalize(expected);
    if (op === 'in')
        return expected.some((item) => canonicalize(actual) === canonicalize(item));
    if (typeof actual !== 'number' || typeof expected !== 'number')
        throw new TypeError('Ordered comparison requires a numeric fact and threshold');
    switch (op) {
        case 'gt': return actual > expected;
        case 'gte': return actual >= expected;
        case 'lt': return actual < expected;
        case 'lte': return actual <= expected;
    }
}
/** Precedence: ERROR > DENY > DEFER > ALLOW. A failed requirement proves denial even when another is unknown. */
export function evaluatePolicy(policy, bundle, asOf) {
    const report = {
        schema: 'cosmic.policy-report.v1', policyId: null, policyVersion: null, asOf,
        verdict: 'ERROR', trace: [], errors: [],
    };
    try {
        timestamp(asOf, 'asOf');
        validatePolicy(policy);
    }
    catch (error) {
        report.errors.push({ code: 'MALFORMED_INPUT', message: error instanceof Error ? error.message : 'Malformed policy input' });
        return report;
    }
    report.policyId = policy.id;
    report.policyVersion = policy.version;
    const evidence = inspectEvidence(bundle, asOf);
    report.evidence = evidence;
    if (!evidence.valid) {
        report.errors = evidence.issues.filter((item) => item.severity === 'ERROR').map((item) => ({ code: item.code, message: item.message }));
        return report;
    }
    const facts = new Map(bundle.facts.map((fact) => [fact.id, fact]));
    const states = new Map(evidence.facts.map((fact) => [fact.id, fact]));
    for (const rule of policy.rules) {
        const trace = { ruleId: rule.id, factId: rule.factId, result: 'DEFER', code: 'MISSING_FACT' };
        if (Object.hasOwn(rule, 'value'))
            trace.expected = rule.value;
        const fact = facts.get(rule.factId);
        const state = states.get(rule.factId);
        if (fact && state) {
            trace.actual = fact.value;
            if (state.status !== 'AVAILABLE') {
                trace.code = `EVIDENCE_${state.status}`;
                trace.reasons = state.reasons;
            }
            else {
                try {
                    const passed = compare(fact.value, rule.op, rule.value);
                    trace.result = passed ? 'PASS' : 'FAIL';
                    trace.code = passed ? 'REQUIREMENT_SATISFIED' : 'REQUIREMENT_FAILED';
                }
                catch (error) {
                    trace.result = 'ERROR';
                    trace.code = 'TYPE_MISMATCH';
                    report.errors.push({ code: 'TYPE_MISMATCH', message: `Rule ${rule.id}: ${error instanceof Error ? error.message : 'Type mismatch'}` });
                }
            }
        }
        report.trace.push(trace);
    }
    report.verdict = report.trace.some((rule) => rule.result === 'ERROR') ? 'ERROR'
        : report.trace.some((rule) => rule.result === 'FAIL') ? 'DENY'
            : report.trace.some((rule) => rule.result === 'DEFER') ? 'DEFER' : 'ALLOW';
    return report;
}
/** Exact interval endpoint analysis for one monotone threshold predicate; not a probability. */
export function thresholdSensitivity(input) {
    canonicalize(input);
    exactKeys(input, ['lower', 'upper', 'op', 'threshold'], 'sensitivity');
    if (![input.lower, input.upper, input.threshold].every((value) => typeof value === 'number' && Number.isFinite(value)))
        throw new TypeError('Sensitivity endpoints and threshold must be finite numbers');
    if (input.lower > input.upper)
        throw new TypeError('lower must not exceed upper');
    if (!['gt', 'gte', 'lt', 'lte'].includes(input.op))
        throw new TypeError('Sensitivity requires a monotone numeric operator');
    const lowerPass = compare(input.lower, input.op, input.threshold);
    const upperPass = compare(input.upper, input.op, input.threshold);
    return { ...input, lowerPass, upperPass, classification: lowerPass === upperPass ? lowerPass ? 'ALWAYS_PASS' : 'ALWAYS_FAIL' : 'SENSITIVE' };
}
