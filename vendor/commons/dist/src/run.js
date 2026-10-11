// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { canonicalize, sha256, CANONICAL_MAX_NODES, CANONICAL_MAX_BYTES, assertReceiptTextLimit } from "./canonical.js";
import { parseStrictJson } from "./strict-json.js";
import { executionRuntime } from "./runtime.js";
export { executionRuntime } from "./runtime.js";
import { DiscoverySession, FamilyAdequacyMonitor, validateFamilyAdequacyOptions, validateDiscoveryIdentifier } from "./inference/index.js";
import { evaluatePolicy } from "./policy.js";
import { EVIDENCE_LIMITS } from "./evidence.js";
export const MAX_DISCOVERY_OBSERVATIONS = 5000;
function object(v, label) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        throw new Error(`${label} must be an object`);
    return v;
}
function keys(v, allowed, required, label) {
    for (const k of Object.keys(v))
        if (!allowed.includes(k))
            throw new Error(`${label}: unknown field ${k}`);
    for (const k of required)
        if (!Object.hasOwn(v, k))
            throw new Error(`${label}: missing ${k}`);
}
function jsonNodeCount(value) {
    return value !== null && typeof value === 'object'
        ? 1 + Object.values(value).reduce((sum, child) => sum + jsonNodeCount(child), 0)
        : 1;
}
/** Conservative schema-derived bound on the complete integrated receipt, including
 * its input and both observation chains. It is checked before inference starts.
 * A hypothesis appears in every posterior and in multiple adequacy fields, so an
 * observation-count limit alone cannot bound the resulting canonical JSON tree. */
function assertDiscoveryReceiptBudget(input) {
    const hypotheses = input.definition.hypotheses.length;
    const experiments = input.definition.experiments.length;
    const monitored = input.adequacy !== undefined && input.definition.experiments.every(e => e.outcomes.length === 2);
    const fixedNodes = 512 + 8 * hypotheses + experiments * (8 + 5 * hypotheses) + 4 * (input.actions?.length ?? 0);
    const nodesPerObservation = 40 + hypotheses + (monitored ? 128 + 10 * hypotheses : 0);
    const upperBound = jsonNodeCount(input) + fixedNodes + input.observations.length * nodesPerObservation;
    if (upperBound > CANONICAL_MAX_NODES) {
        throw new RangeError(`DISCOVERY_RECEIPT_LIMIT: estimated receipt bound ${upperBound} exceeds ${CANONICAL_MAX_NODES} JSON nodes; reduce observations, hypotheses, or experiments`);
    }
    // Quote actual identifiers before measuring: UTF-8 and JSON escaping can make
    // their byte sizes differ substantially from JavaScript string lengths.
    const quotedBytes = (text) => Buffer.byteLength(JSON.stringify(text), 'utf8');
    const hypothesisBytes = input.definition.hypotheses.reduce((sum, h) => sum + quotedBytes(h.id), 0);
    const experimentBytes = input.definition.experiments.reduce((sum, e) => sum + quotedBytes(e.id), 0);
    const outcomeBytes = input.definition.experiments.map(e => e.outcomes.reduce((sum, o) => sum + quotedBytes(o), 0));
    const allOutcomeBytes = outcomeBytes.reduce((sum, bytes) => sum + bytes, 0);
    const maxOutcomeBytes = Math.max(0, ...outcomeBytes);
    const epochBytes = input.adequacy ? quotedBytes(input.adequacy.epochId) : 0;
    const actionBytes = (input.actions ?? []).reduce((sum, a) => sum + quotedBytes(a.id), 0);
    // Fixed reserves cover property names, runtime/hash fields, punctuation,
    // finite-number spellings (at most 25 bytes) and two-space indentation at the
    // receipt schema's maximum depth. Variable keys/values are added separately.
    const fixedBytes = 32768 + 8 * hypothesisBytes + 4 * experimentBytes + 4 * quotedBytes(input.definition.modelId)
        + 4 * epochBytes + 4 * actionBytes + 256 * (input.actions?.length ?? 0)
        + experiments * (256 + 512 * hypotheses + 4 * hypothesisBytes) + 4 * hypotheses * allOutcomeBytes;
    let chainBytes = 0;
    for (const observation of input.observations) {
        const observationBytes = quotedBytes(observation.id) + quotedBytes(observation.experimentId) + quotedBytes(observation.outcome);
        chainBytes += 2048 + 64 * hypotheses + hypothesisBytes + 2 * observationBytes;
        if (monitored)
            chainBytes += 8192 + 256 * hypotheses + 12 * hypothesisBytes + 8 * observationBytes
                + 4 * epochBytes + 4 * (hypotheses + 1) * maxOutcomeBytes;
    }
    // The input is indented one additional level inside the final receipt. Four
    // bytes per node cover that extra indentation, including closing containers.
    const inputBytes = Buffer.byteLength(JSON.stringify(input, null, 2), 'utf8') + 4 * jsonNodeCount(input);
    const byteBound = inputBytes + fixedBytes + chainBytes;
    if (byteBound > CANONICAL_MAX_BYTES) {
        throw new RangeError(`DISCOVERY_RECEIPT_LIMIT: estimated pretty-printed receipt bound ${byteBound} exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes; reduce observations, hypotheses, or identifier lengths`);
    }
}
export function validateInput(value) {
    const copy = JSON.parse(canonicalize(value));
    const input = object(copy, 'Input');
    if (input.kind === 'discovery') {
        keys(input, ['kind', 'definition', 'observations', 'adequacy', 'actions'], ['kind', 'definition', 'observations'], 'Discovery input');
        if (!Array.isArray(input.observations) || input.observations.length > MAX_DISCOVERY_OBSERVATIONS)
            throw new Error(`Observations must be an array with at most ${MAX_DISCOVERY_OBSERVATIONS} entries and fit the discovery receipt budget`);
        const d = object(input.definition, 'Definition');
        keys(d, ['modelId', 'hypotheses', 'experiments', 'budget', 'observationAssumption', 'stopProbability', 'minInformationGainNats'], ['modelId', 'hypotheses', 'experiments', 'budget', 'observationAssumption'], 'Definition');
        if (!Array.isArray(d.hypotheses) || d.hypotheses.length > 100 || !Array.isArray(d.experiments) || d.experiments.length > 100)
            throw new Error('At most 100 hypotheses and 100 experiments are supported');
        validateDiscoveryIdentifier(d.modelId, 'modelId');
        for (const h of d.hypotheses) {
            const hypothesis = object(h, 'Hypothesis');
            keys(hypothesis, ['id', 'prior'], ['id', 'prior'], 'Hypothesis');
            validateDiscoveryIdentifier(hypothesis.id, 'hypothesis id');
        }
        for (const e of d.experiments) {
            const ex = object(e, 'Experiment');
            keys(ex, ['id', 'cost', 'outcomes', 'likelihoods'], ['id', 'cost', 'outcomes', 'likelihoods'], 'Experiment');
            if (!Array.isArray(ex.outcomes) || ex.outcomes.length > 100)
                throw new Error('At most 100 outcomes per experiment are supported');
            validateDiscoveryIdentifier(ex.id, 'experiment id');
            for (const outcome of ex.outcomes)
                validateDiscoveryIdentifier(outcome, 'outcome');
        }
        for (const obs of input.observations) {
            const observation = object(obs, 'Observation');
            keys(observation, ['id', 'experimentId', 'outcome'], ['id', 'experimentId', 'outcome'], 'Observation');
            for (const field of ['id', 'experimentId', 'outcome'])
                validateDiscoveryIdentifier(observation[field], `observation ${field}`);
        }
        if (input.adequacy !== undefined) {
            const adequacy = object(input.adequacy, 'Adequacy');
            keys(adequacy, ['alpha', 'epochId'], ['alpha', 'epochId'], 'Adequacy');
            validateDiscoveryIdentifier(adequacy.epochId, 'epochId');
        }
        if (input.actions !== undefined) {
            if (!Array.isArray(input.actions) || input.actions.length > 100)
                throw new Error('At most 100 actions are supported');
            for (const action of input.actions) {
                const candidate = object(action, 'Action');
                keys(candidate, ['id', 'losses'], ['id', 'losses'], 'Action');
                validateDiscoveryIdentifier(candidate.id, 'action id');
            }
        }
        assertDiscoveryReceiptBudget(copy);
    }
    else if (input.kind === 'policy') {
        keys(input, ['kind', 'policy', 'evidence', 'asOf'], ['kind', 'policy', 'evidence', 'asOf'], 'Policy input');
        const evidence = object(input.evidence, 'Evidence');
        const policy = object(input.policy, 'Policy');
        if (!Array.isArray(evidence.facts) || evidence.facts.length > EVIDENCE_LIMITS.facts || !Array.isArray(evidence.sources) || evidence.sources.length > EVIDENCE_LIMITS.sources)
            throw new Error('Evidence requires arrays of at most 1000 facts and sources');
        if (!Array.isArray(policy.rules) || policy.rules.length > 1000)
            throw new Error('Policy requires at most 1000 rules');
    }
    else
        throw new Error('Input kind is not supported by this edition');
    return copy;
}
export function evaluateInput(input) {
    if (input.kind === 'policy')
        return evaluatePolicy(input.policy, input.evidence, input.asOf);
    const session = new DiscoverySession(input.definition);
    if (input.adequacy)
        validateFamilyAdequacyOptions(input.adequacy);
    const unsupportedExperimentIds = input.definition.experiments.filter(e => e.outcomes.length !== 2).map(e => e.id);
    const monitor = input.adequacy && unsupportedExperimentIds.length === 0
        ? new FamilyAdequacyMonitor(input.definition, input.adequacy) : null;
    for (const observation of input.observations) {
        const prepared = monitor?.prepare(observation.id, observation.experimentId);
        session.observe(observation);
        if (monitor && prepared)
            monitor.observe(prepared, observation.outcome);
    }
    const snapshot = session.snapshot();
    const adequacy = monitor?.snapshot() ?? (input.adequacy
        ? { status: 'UNSUPPORTED', reason: 'Adequacy requires exactly two outcome labels for every experiment.', unsupportedExperimentIds }
        : { status: 'NOT_EVALUATED', reason: 'Adequacy was not requested; no family adequacy assessment was made.' });
    const available = !snapshot.modelMismatch && adequacy.status === 'NOT_REJECTED';
    const stopReason = adequacy.status === 'NOT_EVALUATED' ? 'adequacy-not-evaluated'
        : adequacy.status === 'UNSUPPORTED' ? 'adequacy-unsupported' : 'declared-family-rejected';
    return { snapshot, recommendation: adequacy.status === 'NOT_REJECTED' ? session.recommend() : { status: 'stop', reason: stopReason }, adequacy, decisionStatus: available ? 'AVAILABLE' : 'DEFER', action: input.actions && available ? session.chooseAction(input.actions) : null, assumptions: ['Probabilities are conditional on the declared finite candidate family.', 'Observations are conditionally independent given the hypothesis and experiment.', 'NOT_REJECTED means insufficient evidence against the declared family, not approval.', 'An absent or unsupported adequacy assessment defers integrated action suggestions.', 'Experiment selection is greedy expected information per cost, not global optimality.'] };
}
export function runRequest(value) {
    if (Number(process.versions.node.split('.')[0]) < 20)
        throw new Error('Unsupported execution runtime: Node 20 or newer is required');
    const input = validateInput(value);
    const payload = { schemaVersion: 1, kind: input.kind, input, result: evaluateInput(input), runtime: executionRuntime() };
    const receipt = { ...payload, digest: sha256(payload) };
    assertReceiptTextLimit(receipt);
    return receipt;
}
/** Verifies an already parsed object. Use verifyRunText at external JSON boundaries. */
export function verifyRun(value, expectedDigest) {
    const answer = { valid: false, integrity: 'NOT_CHECKED', replay: 'NOT_RUN', anchoring: expectedDigest === undefined ? 'UNANCHORED' : 'MISMATCH', reason: '' };
    try {
        if (expectedDigest !== undefined && (typeof expectedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedDigest)))
            throw new Error('Trusted digest must be 64 lowercase hexadecimal characters');
        const r = object(value, 'Receipt');
        keys(r, ['schemaVersion', 'kind', 'input', 'result', 'runtime', 'digest'], ['schemaVersion', 'kind', 'input', 'result', 'runtime', 'digest'], 'Receipt');
        if (r.schemaVersion !== 1 || typeof r.digest !== 'string' || !/^[a-f0-9]{64}$/.test(r.digest))
            throw new Error('Unsupported or malformed receipt');
        const { digest, ...payload } = r;
        const payloadDigest = sha256(payload);
        answer.integrity = payloadDigest === digest ? 'VALID' : 'INVALID';
        answer.anchoring = expectedDigest === undefined ? 'UNANCHORED' : digest === expectedDigest && payloadDigest === expectedDigest ? 'MATCH' : 'MISMATCH';
        if (payloadDigest !== digest)
            throw new Error('Receipt digest does not match its payload');
        if (answer.anchoring === 'MISMATCH')
            throw new Error('Receipt does not match the trusted external digest');
        if (canonicalize(r.runtime) !== canonicalize(executionRuntime())) {
            answer.replay = 'UNSUPPORTED';
            throw new Error('Exact replay requires the recorded source artifact, Node/V8, platform, architecture, and endianness');
        }
        const replay = runRequest(r.input);
        if (replay.digest !== digest) {
            answer.replay = 'MISMATCH';
            throw new Error('Payload is internally hashed but recomputation disagrees');
        }
        answer.replay = 'MATCH';
        answer.valid = true;
        answer.reason = expectedDigest ? 'Exact replay and trusted digest match.' : 'Exact replay matches. No trusted external digest was supplied; this verifies consistency, not origin or historical completeness.';
    }
    catch (error) {
        answer.reason = error instanceof Error ? error.message : String(error);
    }
    return answer;
}
/** Safe text entrypoint: reject duplicates before hashing or runtime checks. */
export function verifyRunText(raw, expectedDigest) {
    try {
        return verifyRun(parseStrictJson(raw), expectedDigest);
    }
    catch (error) {
        return { valid: false, integrity: 'NOT_CHECKED', replay: 'NOT_RUN', anchoring: expectedDigest === undefined ? 'UNANCHORED' : 'MISMATCH', reason: error instanceof Error ? error.message : String(error) };
    }
}
