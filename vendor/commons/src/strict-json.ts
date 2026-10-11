// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { CANONICAL_MAX_BYTES } from './canonical.ts';
/** Raw JSON trust boundary. Object APIs cannot recover keys or numbers discarded by a parser. */
export const MAX_JSON_BYTES = CANONICAL_MAX_BYTES;
export const MAX_JSON_DEPTH = 128;
export type StrictJsonErrorCode = 'DUPLICATE_JSON_KEY' | 'UNSAFE_INTEGER' | 'NUMBER_NOT_ROUNDTRIPPABLE' | 'INVALID_JSON' | 'JSON_TOO_LARGE' | 'JSON_TOO_DEEP';

export class StrictJsonError extends SyntaxError {
  readonly code: StrictJsonErrorCode;
  readonly offset: number;
  constructor(code: StrictJsonErrorCode, offset: number, detail: string) {
    super(`${code}: ${detail} at character ${offset}`);
    this.name = 'StrictJsonError';
    this.code = code;
    this.offset = offset;
  }
}

/**
 * Exact decimal identity, not binary64 representability. Thus 0.1 is supported,
 * and 1.00e-1 is equivalent, but 0.10000000000000001 cannot silently become 0.1.
 * Never expand an exponent or construct a large BigInt: work is bounded by the
 * token length. The input has already passed the JSON number grammar.
 */
function decimalIdentity(token: string): string | null {
  const parts = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)!;
  const fraction = parts[3] ?? '';
  const digits = (parts[2] + fraction).replace(/^0+/, '');
  if (!digits) return '0';
  let end = digits.length;
  while (digits[end - 1] === '0') end--;
  const significant = digits.slice(0, end);
  const exponent = Number(parts[4] ?? '0');
  // A nonzero token within the input-size bound cannot cancel an exponent
  // outside the safe-integer range into a finite, nonzero binary64 number.
  if (!Number.isSafeInteger(exponent)) return null;
  const scale = exponent - fraction.length + digits.length - significant.length;
  if (!Number.isSafeInteger(scale)) return null;
  return `${parts[1]}${significant}e${scale}`;
}

function requireRoundtrippableNumber(token: string, offset: number): void {
  const number = Number(token);
  const canonical = Number.isFinite(number) && !Object.is(number, -0) ? JSON.stringify(number) : null;
  if (canonical === null || decimalIdentity(token) !== decimalIdentity(canonical)) {
    throw new StrictJsonError('NUMBER_NOT_ROUNDTRIPPABLE', offset,
      'Number must retain its exact decimal value through binary64 JSON serialization; non-finite values and negative zero are unsupported');
  }
  // Exact decimal round-trip is insufficient for integers. For example 2**53
  // serializes unchanged, but its adjacent integer does not remain distinct.
  // The same rule covers exponent/fraction spellings and negative integers.
  if (Number.isInteger(number) && !Number.isSafeInteger(number)) {
    throw new StrictJsonError('UNSAFE_INTEGER', offset,
      'Integer values must be within the inclusive safe range -9007199254740991 to 9007199254740991');
  }
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
export function parseStrictJson(raw: string): unknown {
  if (typeof raw !== 'string') throw new StrictJsonError('INVALID_JSON', 0, 'Expected raw JSON text');
  if (raw.length > MAX_JSON_BYTES || Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) {
    throw new StrictJsonError('JSON_TOO_LARGE', 0, `Maximum input size is ${MAX_JSON_BYTES} UTF-8 bytes`);
  }
  let offset = 0;
  const fail = (detail: string): never => { throw new StrictJsonError('INVALID_JSON', offset, detail); };
  const whitespace = (): void => {
    while (raw[offset] === ' ' || raw[offset] === '\t' || raw[offset] === '\n' || raw[offset] === '\r') offset++;
  };
  const string = (): string => {
    if (raw[offset] !== '"') return fail('Expected a quoted string');
    const start = offset++;
    while (offset < raw.length) {
      const character = raw[offset++];
      if (character === '\\') { offset++; continue; }
      if (character === '"') {
        try { return JSON.parse(raw.slice(start, offset)) as string; }
        catch { return fail('Invalid JSON string'); }
      }
    }
    return fail('Unterminated JSON string');
  };
  const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const value = (depth: number): void => {
    whitespace();
    const first = raw[offset];
    if (first === '{' || first === '[') {
      if (depth >= MAX_JSON_DEPTH) throw new StrictJsonError('JSON_TOO_DEEP', offset, `Maximum nesting depth is ${MAX_JSON_DEPTH}`);
      offset++;
      whitespace();
      const object = first === '{';
      const end = object ? '}' : ']';
      const keys = new Set<string>();
      if (raw[offset] === end) { offset++; return; }
      for (;;) {
        if (object) {
          whitespace();
          const keyOffset = offset;
          const key = string();
          if (keys.has(key)) throw new StrictJsonError('DUPLICATE_JSON_KEY', keyOffset, 'Duplicate decoded object key');
          keys.add(key);
          whitespace();
          if (raw[offset++] !== ':') fail('Expected colon after object key');
        }
        value(depth + 1);
        whitespace();
        if (raw[offset] === end) { offset++; return; }
        if (raw[offset++] !== ',') fail('Expected comma or closing delimiter');
      }
    }
    if (first === '"') { string(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (raw.startsWith(literal, offset)) { offset += literal.length; return; }
    }
    number.lastIndex = offset;
    const match = number.exec(raw);
    if (!match) fail('Expected a JSON value');
    // A matched prefix such as -0 in -01 is malformed syntax, not a complete
    // unsupported number. Check its boundary before interpreting its value.
    const next = raw[number.lastIndex];
    if (next !== undefined && next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== ',' && next !== ']' && next !== '}') {
      fail('Invalid character after JSON number');
    }
    requireRoundtrippableNumber(match![0], offset);
    offset = number.lastIndex;
  };
  value(0);
  whitespace();
  if (offset !== raw.length) fail('Trailing content');
  // JSON.parse defines own properties (including __proto__) without setters.
  try { return JSON.parse(raw) as unknown; }
  catch { return fail('Invalid JSON'); }
}
