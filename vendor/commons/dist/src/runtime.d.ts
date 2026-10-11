export interface RuntimeContract {
    implementation: string;
    node: string;
    v8: string;
    platform: string;
    architecture: string;
    endianness: string;
    sourceDigest: string;
    codeDigest: string;
}
export declare function executionRuntime(): RuntimeContract;
/** Separate deployments cannot silently replay each other's policy receipts. */
export declare function policyImplementation(): string;
