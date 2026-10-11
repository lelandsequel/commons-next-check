/** Posterior probabilities are conditional on the explicit finite family;
 * a zero declared prior excludes the hypothesis from posterior support and adequacy. */
export interface Hypothesis {
    id: string;
    prior: number;
}
/** A row P(outcome | hypothesis, experiment). Outcomes are mutually exclusive. */
export interface Experiment {
    id: string;
    cost: number;
    outcomes: string[];
    likelihoods: Record<string, Record<string, number>>;
}
export interface DiscoveryConfig {
    modelId: string;
    hypotheses: Hypothesis[];
    experiments: Experiment[];
    budget: number;
    /** Required declaration; repeated observations must satisfy this assumption. */
    observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment';
    /** Optional policy, not an empirical calibration guarantee. */
    stopProbability?: number;
    minInformationGainNats?: number;
}
export interface ExperimentUtility {
    experimentId: string;
    cost: number;
    expectedInformationGainNats: number;
    informationGainPerCost: number;
    predictiveOutcomes: Record<string, number>;
}
export type Recommendation = ({
    status: 'experiment';
} & ExperimentUtility) | {
    status: 'stop';
    reason: 'budget-exhausted' | 'posterior-threshold' | 'no-informative-experiment' | 'model-mismatch';
};
export interface Observation {
    id: string;
    experimentId: string;
    outcome: string;
}
export interface ReplayRuntime {
    implementation: '@cosmic/commons-discovery/0.2.1';
    node: string;
    v8: string;
    platform: string;
    architecture: string;
    endianness: 'LE' | 'BE';
    numericalModel: 'binary64-native-math';
}
export interface EvidenceReceipt extends Observation {
    schemaVersion: 2;
    runtime: ReplayRuntime;
    sequence: number;
    status: 'updated' | 'model-mismatch';
    cost: number;
    priorPredictiveProbability: number;
    /** null only for an outcome impossible under every supported candidate. */
    priorPredictiveLogProbability: number | null;
    posterior: Record<string, number>;
    entropyNats: number;
    previousHash: string;
    hash: string;
}
export interface DiscoverySnapshot {
    schemaVersion: 2;
    runtime: ReplayRuntime;
    /** Hash of schema version, definition hash and runtime; anchors the first receipt. */
    chainAnchorHash: string;
    modelId: string;
    definitionHash: string;
    observationAssumption: DiscoveryConfig['observationAssumption'];
    probabilitySemantics: 'posterior-within-declared-candidate-family';
    posterior: Record<string, number>;
    entropyNats: number;
    spent: number;
    remainingBudget: number;
    modelMismatch: boolean;
    receipts: EvidenceReceipt[];
}
export interface DecisionAction {
    id: string;
    /** Caller-specified loss under each hypothesis, in a consistent unit. */
    losses: Record<string, number>;
}
