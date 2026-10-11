import type { JsonValue } from './canonical.ts';
export interface EvidenceSource {
    id: string;
    uri?: string;
    content?: JsonValue;
    digest?: string;
}
export interface EvidenceFact {
    id: string;
    sourceId: string;
    value: JsonValue;
    /** Independent records about the same claim conflict if their values or units disagree. */
    claimId?: string;
    unit?: string;
    observedAt?: string;
    expiresAt?: string;
    dependsOn?: string[];
}
export interface EvidenceBundle {
    sources: EvidenceSource[];
    facts: EvidenceFact[];
}
export type FactStatus = 'AVAILABLE' | 'MISSING' | 'EXPIRED' | 'FUTURE' | 'CONFLICT' | 'INVALID';
export interface EvidenceIssue {
    code: string;
    severity: 'ERROR' | 'UNAVAILABLE';
    factIds: string[];
    message: string;
}
export interface FactState {
    id: string;
    status: FactStatus;
    reasons: string[];
}
export interface EvidenceReport {
    asOf: string;
    valid: boolean;
    issues: EvidenceIssue[];
    facts: FactState[];
    lineage: {
        factId: string;
        sourceId: string;
        dependsOn: string[];
    }[];
    sources: {
        id: string;
        contentStatus: 'DIGEST_VERIFIED' | 'DIGEST_MISMATCH' | 'CONTENT_ONLY' | 'REFERENCE_ONLY';
        computedDigest?: string;
    }[];
}
/** Bounds graph work and diagnostic output independently of the JSON byte limit. */
export declare const EVIDENCE_LIMITS: Readonly<{
    sources: 1000;
    facts: 1000;
    dependencies: 10000;
}>;
export declare function requiredId(value: unknown, label: string): asserts value is string;
export declare function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void;
/** Checks declared structure, references, time-based availability and contradictions, not source truth. */
export declare function inspectEvidence(bundle: EvidenceBundle, asOf: string): EvidenceReport;
