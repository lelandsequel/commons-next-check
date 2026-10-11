import type { JsonValue } from './canonical.ts';
import type { EvidenceBundle, EvidenceReport } from './evidence.ts';
export type PredicateOperator = 'exists' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
export interface PolicyRule {
    id: string;
    factId: string;
    op: PredicateOperator;
    value?: JsonValue;
}
/** All listed rules are requirements. No executable expressions or implicit conversions. */
export interface Policy {
    id: string;
    version: string;
    rules: PolicyRule[];
}
export type Verdict = 'ALLOW' | 'DENY' | 'DEFER' | 'ERROR';
export interface RuleTrace {
    ruleId: string;
    factId: string;
    result: 'PASS' | 'FAIL' | 'DEFER' | 'ERROR';
    code: string;
    actual?: JsonValue;
    expected?: JsonValue;
    reasons?: string[];
}
export interface PolicyReport {
    schema: 'cosmic.policy-report.v1';
    policyId: string | null;
    policyVersion: string | null;
    asOf: string;
    verdict: Verdict;
    trace: RuleTrace[];
    errors: {
        code: string;
        message: string;
    }[];
    evidence?: EvidenceReport;
}
export declare function validatePolicy(value: unknown): asserts value is Policy;
/** Precedence: ERROR > DENY > DEFER > ALLOW. A failed requirement proves denial even when another is unknown. */
export declare function evaluatePolicy(policy: Policy, bundle: EvidenceBundle, asOf: string): PolicyReport;
export interface ThresholdSensitivityInput {
    lower: number;
    upper: number;
    op: 'gt' | 'gte' | 'lt' | 'lte';
    threshold: number;
}
export interface ThresholdSensitivityReport extends ThresholdSensitivityInput {
    classification: 'ALWAYS_PASS' | 'ALWAYS_FAIL' | 'SENSITIVE';
    lowerPass: boolean;
    upperPass: boolean;
}
/** Exact interval endpoint analysis for one monotone threshold predicate; not a probability. */
export declare function thresholdSensitivity(input: ThresholdSensitivityInput): ThresholdSensitivityReport;
