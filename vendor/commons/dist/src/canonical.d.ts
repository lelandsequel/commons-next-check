export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export declare const CANONICAL_MAX_NODES = 100000;
export declare const CANONICAL_MAX_BYTES = 2000000;
/** Strict canonical JSON v1: UTF-16 key order, JSON number format, no coercions. */
export declare function canonicalize(value: unknown): string;
/** Receipt exports use two-space JSON plus a newline. Refuse an artifact that
 * our own raw-text boundary could not ingest, including formatting overhead. */
export declare function assertReceiptTextLimit(value: unknown): void;
/** SHA-256 of the canonical JSON bytes; this is not a signature. */
export declare function sha256(value: unknown): string;
export declare function sha256Bytes(text: string): string;
export declare function jsonClone<T>(value: T): T;
/** Requires an explicit UTC instant and rejects invalid calendar dates. */
export declare function timestamp(value: unknown, label?: string): number;
