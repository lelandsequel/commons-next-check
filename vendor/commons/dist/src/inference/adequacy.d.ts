import type { DiscoveryConfig, ReplayRuntime } from './types.ts';
export declare const ADEQUACY_SCHEMA_VERSION: 2;
export declare const ADEQUACY_IMPLEMENTATION: "@cosmic/commons-adequacy/0.2.2";
export declare const ADEQUACY_NORMALIZATION_POLICY: "normalize-row-preserve-smaller-tail-binary64-v1";
export declare const ADEQUACY_SUPPORT_POLICY: "strictly-positive-declared-prior-frozen-at-construction-v1";
export type AdequacyRuntime = Omit<ReplayRuntime, 'implementation'> & {
    implementation: typeof ADEQUACY_IMPLEMENTATION;
};
export interface FamilyAdequacyOptions {
    alpha: number;
    epochId: string;
}
export type AdequacyStatus = 'NOT_REJECTED' | 'REJECTED_DECLARED_FAMILY' | 'ZERO_SUPPORT_CONTRADICTION';
/** Exact Bernoulli interpretation: P(tailOutcome)=tailProbability and the other
 * probability is its mathematical complement. The displayed complement may round
 * to one; log1p(-tailProbability) preserves its log contribution. */
export interface EffectiveBernoulliLaw {
    tailOutcome: string;
    tailProbability: number;
    complementOutcome: string;
}
interface AdequacyIdentity {
    schemaVersion: typeof ADEQUACY_SCHEMA_VERSION;
    runtime: AdequacyRuntime;
    epochId: string;
    definitionHash: string;
    optionsHash: string;
    chainAnchorHash: string;
    alpha: number;
    supportPolicy: typeof ADEQUACY_SUPPORT_POLICY;
    /** The frozen null family, selected once from the original declaration. */
    nullHypothesisIds: string[];
    /** Zero prior excludes a law from both inference and this adequacy guarantee. */
    excludedZeroPriorHypothesisIds: string[];
    normalizationPolicy: typeof ADEQUACY_NORMALIZATION_POLICY;
    effectiveLawHash: string;
}
export interface PreparedAdequacyObservation extends AdequacyIdentity {
    id: string;
    experimentId: string;
    sequence: number;
    outcomes: [string, string];
    nullProbabilities: Record<string, Record<string, number>>;
    /** Effective log probabilities; null means an exact zero, never underflow. */
    nullLogProbabilities: Record<string, Record<string, number | null>>;
    alternativeProbabilities: Record<string, number>;
    previousHash: string;
    hash: string;
}
interface AdequacyStatistics {
    status: AdequacyStatus;
    /** null represents positive infinity only when eValueState says zero support. */
    logEValue: number | null;
    eValueState: 'finite' | 'infinite-zero-support';
    /** Includes E_0 = 1. This historical maximum is not itself an e-process. */
    maxLogEValue: number | null;
    firstCrossingSequence: number | null;
    /** null is negative infinity: that candidate assigns zero probability to the path. */
    nullLogLikelihoods: Record<string, number | null>;
    impossibleHypothesisIds: string[];
    alternativeLogLikelihood: number;
}
export interface AdequacyReceipt extends AdequacyIdentity, AdequacyStatistics {
    id: string;
    experimentId: string;
    outcome: string;
    sequence: number;
    prepared: PreparedAdequacyObservation;
    previousHash: string;
    hash: string;
}
export interface FamilyAdequacySnapshot extends AdequacyIdentity, AdequacyStatistics {
    modelId: string;
    nullSemantics: 'frozen-positive-prior-conditional-bernoulli-laws';
    notRejectedSemantics: 'insufficient-evidence-against-declared-laws-not-approval';
    budgetSemantics: 'external-discovery-session-only';
    alternative: 'per-experiment-beta-half-prequential';
    observationCount: number;
    effectiveNullLaws: Record<string, Record<string, EffectiveBernoulliLaw>>;
    counts: Record<string, Record<string, number>>;
    pending: PreparedAdequacyObservation | null;
    receipts: AdequacyReceipt[];
}
export declare function currentAdequacyRuntime(): AdequacyRuntime;
/** Validate requested monitoring options even when the experiment family is
 * outside the Bernoulli monitor's supported scope. */
export declare function validateFamilyAdequacyOptions(options: FamilyAdequacyOptions): void;
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
export declare class FamilyAdequacyMonitor {
    private readonly definition;
    private readonly options;
    private readonly identity;
    private readonly ids;
    private readonly experiments;
    private readonly countState;
    private readonly effectiveNullLaws;
    private readonly evidenceIds;
    private readonly receipts;
    private pending;
    private logs;
    private alternativeLog;
    private logE;
    private maxLogE;
    private firstCrossing;
    constructor(definition: DiscoveryConfig, options: FamilyAdequacyOptions);
    private statistics;
    prepare(observationId: string, experimentId: string): PreparedAdequacyObservation;
    observe(token: PreparedAdequacyObservation, outcome: string): AdequacyReceipt;
    snapshot(): FamilyAdequacySnapshot;
    exportDefinition(): DiscoveryConfig;
    exportOptions(): FamilyAdequacyOptions;
}
/** Recompute every prediction and body; hash consistency alone is insufficient.
 * A recorded runtime is mandatory for an empty committed prefix. A pending prepare
 * is not an observation receipt and is not restored by this helper. */
export declare function replayFamilyAdequacy(definition: DiscoveryConfig, options: FamilyAdequacyOptions, receipts: AdequacyReceipt[], recordedRuntime?: AdequacyRuntime): FamilyAdequacyMonitor;
export {};
