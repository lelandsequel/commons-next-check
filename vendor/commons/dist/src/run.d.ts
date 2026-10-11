import type { RuntimeContract } from './runtime.ts';
export { executionRuntime } from './runtime.ts';
export type { RuntimeContract } from './runtime.ts';
import type { DiscoveryConfig, Observation, DecisionAction } from './inference/index.ts';
import type { Policy } from './policy.ts';
import type { EvidenceBundle } from './evidence.ts';
export type DiscoveryInput = {
    kind: 'discovery';
    definition: DiscoveryConfig;
    observations: Observation[];
    adequacy?: {
        alpha: number;
        epochId: string;
    };
    actions?: DecisionAction[];
};
export type PolicyInput = {
    kind: 'policy';
    policy: Policy;
    evidence: EvidenceBundle;
    asOf: string;
};
export type RunInput = DiscoveryInput | PolicyInput;
export declare const MAX_DISCOVERY_OBSERVATIONS = 5000;
export interface RunReceipt {
    schemaVersion: 1;
    kind: RunInput['kind'];
    input: RunInput;
    result: unknown;
    runtime: RuntimeContract;
    digest: string;
}
export interface VerificationResult {
    valid: boolean;
    integrity: 'VALID' | 'INVALID' | 'NOT_CHECKED';
    replay: 'MATCH' | 'MISMATCH' | 'UNSUPPORTED' | 'NOT_RUN';
    anchoring: 'MATCH' | 'MISMATCH' | 'UNANCHORED';
    reason: string;
}
export declare function validateInput(value: unknown): RunInput;
export declare function evaluateInput(input: RunInput): unknown;
export declare function runRequest(value: unknown): RunReceipt;
/** Verifies an already parsed object. Use verifyRunText at external JSON boundaries. */
export declare function verifyRun(value: unknown, expectedDigest?: string): VerificationResult;
/** Safe text entrypoint: reject duplicates before hashing or runtime checks. */
export declare function verifyRunText(raw: string, expectedDigest?: string): VerificationResult;
