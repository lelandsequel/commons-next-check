import type { ReplayRuntime } from './types.ts';
/** Validated reference runtime for recorded evidence; not an execution-version pin. */
export declare const VALIDATED_NODE_VERSION = "24.19.0";
export declare const RECEIPT_SCHEMA_VERSION: 2;
/** Runtime context, not proof of identical hardware, binary build or source bytes.
 * Exact replay also requires the same implementation artifact and matching receipts. */
export declare function currentReplayRuntime(): ReplayRuntime;
export declare class ReplayRuntimeError extends Error {
    readonly code: 'MISSING_REPLAY_RUNTIME' | 'REPLAY_RUNTIME_MISMATCH';
    constructor(code: ReplayRuntimeError['code'], message: string);
}
/** Reject absent/changed runtime context before any receipt is replayed. */
export declare function assertReplayRuntime(recorded: ReplayRuntime | undefined): void;
