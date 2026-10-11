// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.
import { canonicalJSON, DiscoverySession, hashJSON, validateDiscoveryIdentifier as identifier } from "./session.js";
import { currentReplayRuntime, ReplayRuntimeError } from "./runtime.js";
export const ADEQUACY_SCHEMA_VERSION = 2;
export const ADEQUACY_IMPLEMENTATION = '@cosmic/commons-adequacy/0.2.2';
export const ADEQUACY_NORMALIZATION_POLICY = 'normalize-row-preserve-smaller-tail-binary64-v1';
export const ADEQUACY_SUPPORT_POLICY = 'strictly-positive-declared-prior-frozen-at-construction-v1';
export function currentAdequacyRuntime() {
    return { ...currentReplayRuntime(), implementation: ADEQUACY_IMPLEMENTATION };
}
function assertAdequacyRuntime(recorded) {
    const current = currentAdequacyRuntime();
    const keys = Object.keys(current);
    if (!recorded || keys.some(key => typeof recorded[key] !== 'string' || !recorded[key])) {
        throw new ReplayRuntimeError('MISSING_REPLAY_RUNTIME', 'Adequacy replay requires a complete recorded runtime');
    }
    if (keys.some(key => recorded[key] !== current[key])) {
        throw new ReplayRuntimeError('REPLAY_RUNTIME_MISMATCH', 'Adequacy replay runtime or implementation mismatch');
    }
}
/** Validate requested monitoring options even when the experiment family is
 * outside the Bernoulli monitor's supported scope. */
export function validateFamilyAdequacyOptions(options) {
    if (!options || !Number.isFinite(options.alpha) || options.alpha <= 0 || options.alpha >= 1) {
        throw new Error('alpha must be finite and strictly between zero and one');
    }
    identifier(options.epochId, 'epochId');
}
function freezeDeep(value) {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value))
            freezeDeep(child);
        Object.freeze(value);
    }
    return value;
}
function finite(value) {
    if (!Number.isFinite(value))
        throw new Error('Adequacy numeric range exceeded; no observation was committed');
    return value;
}
/**
 * Monitors only the declared, frozen, fully specified conditional Bernoulli laws
 * whose original priors are strictly positive. Zero prior excludes a hypothesis
 * from inference and from this null family; it cannot shield the active family
 * from rejection. Positive prior magnitudes do not weight the null likelihoods.
 * The support is fixed at construction, never refitted to a posterior or outcome.
 * Approximate input rows (legacy tolerance 1e-12) are explicitly transformed into
 * effective normalized laws: normalize the smaller tail, use its exact complement.
 * Raw definition and effective-law digests are both retained. The null guarantee
 * concerns the effective laws; their probabilities can differ from raw inputs at
 * rounding scale. Tiny positive tails are never silently clipped to zero.
 * E_t = Q_t / max_h L_h,t, with Q learned strictly from previous observations.
 * Under any admitted positive-prior true conditional law, threshold crossing has probability at
 * most alpha (in exact arithmetic). Native binary64 calculations are not a formal
 * numerical proof. NOT_REJECTED does not validate a law or authorize an action.
 *
 * Experiment choice may adapt to past observations. Candidate discovery, refitting,
 * batch observations, parameter-family rejection, and automatic resets are absent.
 * The originating DiscoverySession owns budget enforcement; this monitor spends
 * no budget and does not change the old session or its v2 evidence format.
 */
export class FamilyAdequacyMonitor {
    definition;
    options;
    identity;
    ids;
    experiments;
    countState;
    effectiveNullLaws;
    evidenceIds = new Set();
    receipts = [];
    pending = null;
    logs;
    alternativeLog = 0;
    logE = 0;
    maxLogE = 0;
    firstCrossing = null;
    constructor(definition, options) {
        validateFamilyAdequacyOptions(options);
        // Reuse public validation and a defensive copy, never its posterior weights.
        this.definition = new DiscoverySession(definition).exportDefinition();
        this.ids = this.definition.hypotheses.filter(h => h.prior > 0).map(h => h.id);
        const excludedZeroPriorHypothesisIds = this.definition.hypotheses.filter(h => h.prior === 0).map(h => h.id);
        const effectiveEntries = [];
        for (const experiment of this.definition.experiments) {
            if (experiment.outcomes.length !== 2)
                throw new Error('Adequacy v2 requires exactly two outcome labels per experiment');
            const rows = this.ids.map((id) => {
                const row = experiment.likelihoods[id];
                const [left, right] = experiment.outcomes;
                const total = row[left] + row[right]; // Legacy validation already bounds |total-1| <= 1e-12.
                const tailOutcome = row[left] <= row[right] ? left : right;
                const complementOutcome = tailOutcome === left ? right : left;
                const tailProbability = row[tailOutcome] / total;
                if (!Number.isFinite(tailProbability) || tailProbability < 0 || tailProbability > 0.5 ||
                    (row[tailOutcome] > 0 && tailProbability === 0)) {
                    throw new Error('Normalized Bernoulli tail is not representable');
                }
                return [id, { tailOutcome, tailProbability, complementOutcome }];
            });
            effectiveEntries.push([experiment.id, Object.fromEntries(rows)]);
        }
        this.effectiveNullLaws = Object.fromEntries(effectiveEntries);
        this.options = { alpha: options.alpha, epochId: options.epochId };
        this.logs = this.ids.map(() => 0);
        this.experiments = new Map(this.definition.experiments.map(e => [e.id, e]));
        this.countState = new Map(this.definition.experiments.map(e => [e.id, [0, 0]]));
        const normalizationPolicy = ADEQUACY_NORMALIZATION_POLICY;
        const anchor = { schemaVersion: ADEQUACY_SCHEMA_VERSION, runtime: currentAdequacyRuntime(),
            definitionHash: hashJSON(this.definition), optionsHash: hashJSON(this.options), ...this.options,
            supportPolicy: ADEQUACY_SUPPORT_POLICY, nullHypothesisIds: [...this.ids], excludedZeroPriorHypothesisIds,
            normalizationPolicy, effectiveLawHash: hashJSON({ normalizationPolicy, laws: this.effectiveNullLaws }) };
        this.identity = { ...anchor, chainAnchorHash: hashJSON(anchor) };
    }
    statistics() {
        const impossible = this.logs.every(value => value === -Infinity);
        return {
            status: impossible ? 'ZERO_SUPPORT_CONTRADICTION' : this.firstCrossing === null ? 'NOT_REJECTED' : 'REJECTED_DECLARED_FAMILY',
            logEValue: impossible ? null : this.logE,
            eValueState: impossible ? 'infinite-zero-support' : 'finite',
            maxLogEValue: this.maxLogE === Infinity ? null : this.maxLogE,
            firstCrossingSequence: this.firstCrossing,
            nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, this.logs[i] === -Infinity ? null : this.logs[i]])),
            impossibleHypothesisIds: this.ids.filter((_, i) => this.logs[i] === -Infinity),
            alternativeLogLikelihood: this.alternativeLog,
        };
    }
    prepare(observationId, experimentId) {
        identifier(observationId, 'observation id');
        identifier(experimentId, 'experiment id');
        if (this.pending)
            throw new Error('A prepared observation is pending; commit it before preparing another');
        if (this.logs.every(value => value === -Infinity))
            throw new Error('Monitor stopped after zero support contradiction');
        if (this.evidenceIds.has(observationId))
            throw new Error('Duplicate observation id: evidence cannot be counted twice');
        const experiment = this.experiments.get(experimentId);
        if (!experiment)
            throw new Error('Unknown experiment');
        const counts = this.countState.get(experimentId);
        const total = counts[0] + counts[1];
        // Keep half-counts and the next count exactly representable, and q interior.
        if (total >= 2 ** 50 || !Number.isSafeInteger(this.receipts.length + 1))
            throw new Error('Adequacy observation count limit reached');
        const q0 = (counts[0] + 0.5) / (total + 1);
        const q1 = (counts[1] + 0.5) / (total + 1);
        if (!(q0 > 0 && q0 < 1 && q1 > 0 && q1 < 1))
            throw new Error('Alternative probabilities are not representable');
        const laws = this.effectiveNullLaws[experimentId];
        const nullProbabilities = Object.fromEntries(this.ids.map(id => {
            const law = laws[id];
            return [id, Object.fromEntries([[law.tailOutcome, law.tailProbability], [law.complementOutcome, 1 - law.tailProbability]])];
        }));
        const nullLogProbabilities = Object.fromEntries(this.ids.map(id => {
            const law = laws[id];
            return [id, Object.fromEntries([[law.tailOutcome, law.tailProbability === 0 ? null : Math.log(law.tailProbability)],
                    [law.complementOutcome, law.tailProbability === 0 ? 0 : Math.log1p(-law.tailProbability)]])];
        }));
        const body = { ...structuredClone(this.identity), id: observationId, experimentId,
            sequence: this.receipts.length + 1, outcomes: [...experiment.outcomes],
            nullProbabilities, nullLogProbabilities,
            alternativeProbabilities: Object.fromEntries([[experiment.outcomes[0], q0], [experiment.outcomes[1], q1]]),
            previousHash: this.receipts.at(-1)?.hash ?? this.identity.chainAnchorHash };
        const prepared = { ...body, hash: hashJSON(body) };
        this.pending = prepared;
        return freezeDeep(structuredClone(prepared));
    }
    observe(token, outcome) {
        if (!this.pending)
            throw new Error('No prepared observation is pending');
        if (canonicalJSON(token) !== canonicalJSON(this.pending))
            throw new Error('Prepared token verification failed');
        const prepared = this.pending;
        const index = prepared.outcomes.indexOf(outcome);
        if (index < 0)
            throw new Error('Outcome is outside the declared binary observation alphabet');
        const nextLogs = this.logs.map((value, i) => {
            const logProbability = prepared.nullLogProbabilities[this.ids[i]][outcome];
            return value === -Infinity || logProbability === null ? -Infinity : finite(value + logProbability);
        });
        const alternativeLog = finite(this.alternativeLog + Math.log(prepared.alternativeProbabilities[outcome]));
        const peak = nextLogs.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
        const logE = peak === -Infinity ? Infinity : finite(alternativeLog - peak);
        const firstCrossing = this.firstCrossing ?? (logE >= -Math.log(this.options.alpha) ? prepared.sequence : null);
        const maxLogE = Math.max(this.maxLogE, logE);
        const statistics = {
            status: peak === -Infinity ? 'ZERO_SUPPORT_CONTRADICTION' : firstCrossing === null ? 'NOT_REJECTED' : 'REJECTED_DECLARED_FAMILY',
            logEValue: logE === Infinity ? null : logE,
            eValueState: peak === -Infinity ? 'infinite-zero-support' : 'finite',
            maxLogEValue: maxLogE === Infinity ? null : maxLogE,
            firstCrossingSequence: firstCrossing,
            nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, nextLogs[i] === -Infinity ? null : nextLogs[i]])),
            impossibleHypothesisIds: this.ids.filter((_, i) => nextLogs[i] === -Infinity),
            alternativeLogLikelihood: alternativeLog,
        };
        const body = { ...structuredClone(this.identity), ...statistics, id: prepared.id,
            experimentId: prepared.experimentId, outcome, sequence: prepared.sequence,
            prepared: structuredClone(prepared), previousHash: prepared.previousHash };
        const receipt = { ...body, hash: hashJSON(body) };
        // All validation, numeric work, cloning and hashing precede state mutation.
        const result = structuredClone(receipt);
        this.logs = nextLogs;
        this.alternativeLog = alternativeLog;
        this.logE = logE;
        this.maxLogE = maxLogE;
        this.firstCrossing = firstCrossing;
        this.countState.get(prepared.experimentId)[index]++;
        this.evidenceIds.add(prepared.id);
        this.receipts.push(receipt);
        this.pending = null;
        return result;
    }
    snapshot() {
        return { ...structuredClone(this.identity), ...this.statistics(), modelId: this.definition.modelId,
            nullSemantics: 'frozen-positive-prior-conditional-bernoulli-laws',
            notRejectedSemantics: 'insufficient-evidence-against-declared-laws-not-approval',
            budgetSemantics: 'external-discovery-session-only', alternative: 'per-experiment-beta-half-prequential',
            observationCount: this.receipts.length,
            effectiveNullLaws: structuredClone(this.effectiveNullLaws),
            counts: Object.fromEntries([...this.experiments].map(([id, experiment]) => [id,
                Object.fromEntries(experiment.outcomes.map((label, i) => [label, this.countState.get(id)[i]]))])),
            pending: this.pending === null ? null : structuredClone(this.pending), receipts: structuredClone(this.receipts) };
    }
    exportDefinition() { return structuredClone(this.definition); }
    exportOptions() { return { ...this.options }; }
}
/** Recompute every prediction and body; hash consistency alone is insufficient.
 * A recorded runtime is mandatory for an empty committed prefix. A pending prepare
 * is not an observation receipt and is not restored by this helper. */
export function replayFamilyAdequacy(definition, options, receipts, recordedRuntime) {
    if (!Array.isArray(receipts))
        throw new Error('Receipts must be an array');
    if (recordedRuntime !== undefined || receipts.length === 0)
        assertAdequacyRuntime(recordedRuntime);
    for (const receipt of receipts) {
        if (receipt?.schemaVersion !== ADEQUACY_SCHEMA_VERSION)
            throw new Error('Adequacy receipt schema mismatch');
        assertAdequacyRuntime(receipt.runtime);
    }
    const monitor = new FamilyAdequacyMonitor(definition, options);
    for (const receipt of receipts) {
        const prepared = monitor.prepare(receipt.id, receipt.experimentId);
        const actual = monitor.observe(prepared, receipt.outcome);
        if (canonicalJSON(actual) !== canonicalJSON(receipt))
            throw new Error(`Adequacy receipt verification failed at sequence ${receipt.sequence}`);
    }
    return monitor;
}
