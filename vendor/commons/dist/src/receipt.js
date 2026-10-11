// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { policyImplementation } from "./runtime.js";
import { canonicalize, jsonClone, sha256, timestamp, assertReceiptTextLimit } from "./canonical.js";
import { parseStrictJson, StrictJsonError } from "./strict-json.js";
import { exactKeys, requiredId } from "./evidence.js";
import { evaluatePolicy, validatePolicy } from "./policy.js";
export function captureEnvironment() {
    return { implementation: policyImplementation(), runtime: `node/${process.versions.node}`, platform: process.platform, arch: process.arch };
}
function validateEnvironment(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError('environment must be an object');
    const environment = value;
    exactKeys(environment, ['implementation', 'runtime', 'platform', 'arch'], 'environment');
    for (const key of ['implementation', 'runtime', 'platform', 'arch'])
        requiredId(environment[key], `environment.${key}`);
}
function validateInput(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError('receipt input must be an object');
    const input = value;
    exactKeys(input, ['policy', 'evidence', 'asOf', 'environment'], 'receipt input');
    timestamp(input.asOf, 'asOf');
    validatePolicy(input.policy);
    validateEnvironment(input.environment);
    if (!Object.hasOwn(input, 'evidence'))
        throw new TypeError('receipt evidence is required');
}
/** A receipt binds the declared input and recomputable output. It does not certify facts or authorship. */
export function createReceipt(input) {
    const copy = jsonClone(input);
    validateInput(copy);
    const report = evaluatePolicy(copy.policy, copy.evidence, copy.asOf);
    const payload = { schema: 'cosmic.policy-receipt.v1', input: copy, report };
    const receipt = { payload, digest: sha256(payload) };
    assertReceiptTextLimit(receipt);
    return receipt;
}
/**
 * Object-only API: use verifyReceiptText for external JSON. trustedDigest must come
 * from an independently trusted channel. Exact replay always requires the current
 * environment; expectedEnvironment adds a caller constraint and cannot override it.
 */
export function verifyReceipt(receipt, options = {}) {
    const result = {
        valid: false, integrity: 'NOT_CHECKED', replay: 'NOT_RUN', integrityValid: false, replayValid: false, anchoring: options.trustedDigest === undefined ? 'UNANCHORED' : 'MISMATCH',
        environmentMatches: null, authenticity: 'NOT_ESTABLISHED', issues: [],
    };
    try {
        canonicalize(options);
        exactKeys(options, ['trustedDigest', 'expectedEnvironment'], 'verification options');
        if (options.trustedDigest !== undefined && (typeof options.trustedDigest !== 'string' || !/^[0-9a-f]{64}$/.test(options.trustedDigest)))
            throw new TypeError('trustedDigest must be lowercase SHA-256 hex');
        if (options.expectedEnvironment !== undefined)
            validateEnvironment(options.expectedEnvironment);
        canonicalize(receipt);
        if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt))
            throw new TypeError('receipt must be an object');
        const envelope = receipt;
        exactKeys(envelope, ['payload', 'digest'], 'receipt');
        if (typeof envelope.digest !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.digest))
            throw new TypeError('receipt digest must be lowercase SHA-256 hex');
        const payload = envelope.payload;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
            throw new TypeError('payload must be an object');
        exactKeys(payload, ['schema', 'input', 'report'], 'receipt payload');
        const candidate = payload;
        if (candidate.schema !== 'cosmic.policy-receipt.v1')
            throw new TypeError('Unsupported receipt schema');
        validateInput(candidate.input);
        const computedDigest = sha256(payload);
        result.integrityValid = computedDigest === envelope.digest;
        result.integrity = result.integrityValid ? 'VALID' : 'INVALID';
        if (!result.integrityValid)
            result.issues.push('DIGEST_MISMATCH');
        if (options.trustedDigest !== undefined) {
            result.anchoring = computedDigest === options.trustedDigest && envelope.digest === options.trustedDigest ? 'ANCHORED' : 'MISMATCH';
            if (result.anchoring === 'MISMATCH')
                result.issues.push('TRUSTED_DIGEST_MISMATCH');
        }
        else
            result.issues.push('UNANCHORED_SELF_CONSISTENCY_ONLY');
        const declaredEnvironment = canonicalize(candidate.input.environment);
        const currentEnvironmentMatches = declaredEnvironment === canonicalize(captureEnvironment());
        const expectedEnvironmentMatches = options.expectedEnvironment === undefined || declaredEnvironment === canonicalize(options.expectedEnvironment);
        result.environmentMatches = currentEnvironmentMatches && expectedEnvironmentMatches;
        if (!result.environmentMatches)
            result.issues.push('ENVIRONMENT_MISMATCH');
        if (!currentEnvironmentMatches) {
            result.replay = 'UNSUPPORTED';
            result.issues.push('UNSUPPORTED_ENVIRONMENT');
            return result;
        }
        const replayed = evaluatePolicy(candidate.input.policy, candidate.input.evidence, candidate.input.asOf);
        result.replayedReport = replayed;
        result.replayValid = canonicalize(replayed) === canonicalize(candidate.report);
        result.replay = result.replayValid ? 'MATCH' : 'MISMATCH';
        if (!result.replayValid)
            result.issues.push('REPLAY_MISMATCH');
        result.valid = result.integrityValid && result.replayValid && result.anchoring !== 'MISMATCH' && result.environmentMatches !== false;
    }
    catch (error) {
        result.valid = false;
        result.issues.push(`MALFORMED_RECEIPT:${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return result;
}
/** Safe text entrypoint for policy receipts, before any canonicalization. */
export function verifyReceiptText(raw, options = {}) {
    try {
        return verifyReceipt(parseStrictJson(raw), options);
    }
    catch (error) {
        return { valid: false, integrity: 'NOT_CHECKED', replay: 'NOT_RUN', integrityValid: false, replayValid: false, anchoring: options.trustedDigest === undefined ? 'UNANCHORED' : 'MISMATCH', environmentMatches: null, authenticity: 'NOT_ESTABLISHED',
            issues: [error instanceof StrictJsonError ? error.code : 'MALFORMED_RECEIPT', error instanceof Error ? error.message : String(error)] };
    }
}
