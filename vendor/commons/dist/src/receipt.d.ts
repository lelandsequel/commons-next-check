import type { EvidenceBundle } from './evidence.ts';
import type { Policy, PolicyReport } from './policy.ts';
export interface ReceiptEnvironment {
    implementation: string;
    runtime: string;
    platform: string;
    arch: string;
}
export interface ReceiptInput {
    policy: Policy;
    evidence: EvidenceBundle;
    asOf: string;
    environment: ReceiptEnvironment;
}
export interface ReceiptPayload {
    schema: 'cosmic.policy-receipt.v1';
    input: ReceiptInput;
    report: PolicyReport;
}
export interface PolicyReceipt {
    payload: ReceiptPayload;
    digest: string;
}
export interface ReceiptVerification {
    valid: boolean;
    integrity: 'VALID' | 'INVALID' | 'NOT_CHECKED';
    replay: 'MATCH' | 'MISMATCH' | 'UNSUPPORTED' | 'NOT_RUN';
    integrityValid: boolean;
    replayValid: boolean;
    anchoring: 'ANCHORED' | 'UNANCHORED' | 'MISMATCH';
    environmentMatches: boolean | null;
    authenticity: 'NOT_ESTABLISHED';
    issues: string[];
    replayedReport?: PolicyReport;
}
export interface ReceiptVerificationOptions {
    trustedDigest?: string;
    expectedEnvironment?: ReceiptEnvironment;
}
export declare function captureEnvironment(): ReceiptEnvironment;
/** A receipt binds the declared input and recomputable output. It does not certify facts or authorship. */
export declare function createReceipt(input: ReceiptInput): PolicyReceipt;
/**
 * Object-only API: use verifyReceiptText for external JSON. trustedDigest must come
 * from an independently trusted channel. Exact replay always requires the current
 * environment; expectedEnvironment adds a caller constraint and cannot override it.
 */
export declare function verifyReceipt(receipt: unknown, options?: ReceiptVerificationOptions): ReceiptVerification;
/** Safe text entrypoint for policy receipts, before any canonicalization. */
export declare function verifyReceiptText(raw: string, options?: ReceiptVerificationOptions): ReceiptVerification;
