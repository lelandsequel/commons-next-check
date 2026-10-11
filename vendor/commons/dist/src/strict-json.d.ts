/** Raw JSON trust boundary. Object APIs cannot recover keys or numbers discarded by a parser. */
export declare const MAX_JSON_BYTES = 2000000;
export declare const MAX_JSON_DEPTH = 128;
export type StrictJsonErrorCode = 'DUPLICATE_JSON_KEY' | 'UNSAFE_INTEGER' | 'NUMBER_NOT_ROUNDTRIPPABLE' | 'INVALID_JSON' | 'JSON_TOO_LARGE' | 'JSON_TOO_DEEP';
export declare class StrictJsonError extends SyntaxError {
    readonly code: StrictJsonErrorCode;
    readonly offset: number;
    constructor(code: StrictJsonErrorCode, offset: number, detail: string);
}
/**
 * Reject ambiguous JSON before materializing an object. Names are compared after
 * JSON escape decoding, within their containing object. Native JSON.parse only
 * runs on the complete document after the bounded grammar scan succeeds.
 * Each numeric token must have the same exact decimal value as the native JSON
 * serialization of its binary64 value. This is not arbitrary-precision arithmetic;
 * it prevents distinct source decimals from silently collapsing at this boundary.
 * All integer values must additionally be within the binary64 safe integer range.
 */
export declare function parseStrictJson(raw: string): unknown;
