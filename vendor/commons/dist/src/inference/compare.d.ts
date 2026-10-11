import type { DiscoveryConfig, EvidenceReceipt, ReplayRuntime } from './types.ts';
/** Both v1 and v2 numerical records can be inspected; hashes are intentionally not trusted here. */
export type ComparableReceipt = Pick<EvidenceReceipt, 'id' | 'experimentId' | 'outcome' | 'sequence' | 'status' | 'cost' | 'posterior' | 'entropyNats' | 'priorPredictiveProbability' | 'priorPredictiveLogProbability'> & {
    runtime?: ReplayRuntime;
};
export interface NumericalComparisonOptions {
    absoluteTolerance: number;
    relativeTolerance: number;
}
/** Recompute given observations and compare numerical fields with caller-declared
 * tolerances. This is explicitly NOT verification of hashes, runtime, source or truth. */
export declare function compareReceiptNumerics(config: DiscoveryConfig, receipts: ComparableReceipt[], options: NumericalComparisonOptions): {
    mode: "numerical-comparison";
    exactReplayVerified: false;
    claim: string;
    currentRuntime: ReplayRuntime;
    recordedRuntime: ReplayRuntime | null;
    tolerances: {
        absoluteTolerance: number;
        relativeTolerance: number;
    };
    comparedNumbers: number;
    exactlyEqualNumbers: number;
    withinTolerance: boolean;
    differences: {
        path: string;
        recorded: number;
        recomputed: number;
        absoluteDifference: number;
        withinTolerance: boolean;
    }[];
    structuralDifferences: string[];
};
