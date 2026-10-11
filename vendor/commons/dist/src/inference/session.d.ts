import type { DecisionAction, DiscoveryConfig, DiscoverySnapshot, EvidenceReceipt, ExperimentUtility, Observation, Recommendation, ReplayRuntime } from './types.ts';
/** Deterministic finite JSON encoding for receipts. No timestamps or global counters. */
export declare function canonicalJSON(value: unknown): string;
export declare function hashJSON(value: unknown): string;
export declare const DISCOVERY_MAX_IDENTIFIER_LENGTH = 256;
export declare function validateDiscoveryIdentifier(value: unknown, name: string): asserts value is string;
export declare function entropy(probabilities: number[]): number;
/**
 * Exact Bayes over a declared discrete model family. This does not discover arbitrary
 * structural graphs or prove the family contains the truth. Experiment utility is a
 * greedy one-step mutual-information/cost criterion, not globally optimal planning.
 */
export declare class DiscoverySession {
    private readonly definition;
    private readonly definitionHash;
    private readonly runtime;
    private readonly chainAnchorHash;
    private readonly experiments;
    private logWeights;
    private readonly ids;
    private readonly costScale;
    private readonly budgetUnits;
    private readonly costUnits;
    private spentUnits;
    private mismatch;
    private readonly receipts;
    private readonly evidenceIds;
    constructor(config: DiscoveryConfig);
    private probabilities;
    posterior(): Record<string, number>;
    remainingBudget(): number;
    canAfford(experimentId: string): boolean;
    experimentUtilities(): ExperimentUtility[];
    recommend(): Recommendation;
    observe(observation: Observation): EvidenceReceipt;
    /** Rank caller-defined actions by posterior expected loss; include abstention as an action if needed. */
    chooseAction(actions: DecisionAction[]): {
        actionId: string;
        expectedLoss: number;
        alternatives: Array<{
            actionId: string;
            expectedLoss: number;
        }>;
    };
    snapshot(): DiscoverySnapshot;
    /** Export the exact declaration needed to reproduce this numerical receipt chain. */
    exportDefinition(): DiscoveryConfig;
}
/** Exact v2 replay only. Runtime compatibility is necessary, not sufficient:
 * every body and hash is still recomputed; no float rounding/tolerance is applied. */
export declare function replaySession(config: DiscoveryConfig, receipts: EvidenceReceipt[], recordedRuntime?: ReplayRuntime): DiscoverySession;
