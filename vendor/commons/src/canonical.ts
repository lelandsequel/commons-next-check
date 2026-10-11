// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export const CANONICAL_MAX_NODES = 100_000;
export const CANONICAL_MAX_BYTES = 2_000_000;

/** Strict canonical JSON v1: UTF-16 key order, JSON number format, no coercions. */
export function canonicalize(value: unknown): string {
  const active = new Set<object>();
  let nodes = 0;
  let bytes = 0;
  const take = (text: string): string => {
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > CANONICAL_MAX_BYTES) throw new RangeError(`JSON_BYTE_LIMIT: canonical JSON exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes`);
    return text;
  };
  const quote = (text: string): string => {
    if (text.length > CANONICAL_MAX_BYTES) throw new RangeError('JSON_BYTE_LIMIT: string exceeds the JSON byte budget');
    return take(JSON.stringify(text));
  };
  const visit = (item: unknown, path: string, depth: number): string => {
    if (++nodes > CANONICAL_MAX_NODES || depth > 100) throw new TypeError(`JSON_LIMIT at ${path}`);
    if (item === null) return take('null');
    if (typeof item === 'string') {
      if (!item.isWellFormed()) throw new TypeError(`INVALID_UNICODE at ${path}`);
      return quote(item);
    }
    if (typeof item === 'boolean') return take(item ? 'true' : 'false');
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || Object.is(item, -0)) throw new TypeError(`INVALID_NUMBER at ${path}`);
      if (Number.isInteger(item) && !Number.isSafeInteger(item)) throw new TypeError(`UNSAFE_INTEGER at ${path}`);
      return take(JSON.stringify(item));
    }
    if (typeof item !== 'object') throw new TypeError(`NOT_JSON at ${path}`);
    if (active.has(item)) throw new TypeError(`JSON_CYCLE at ${path}`);
    const proto = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) {
      throw new TypeError(`NOT_PLAIN_OBJECT at ${path}`);
    }
    if (Array.isArray(item) && proto !== Array.prototype) throw new TypeError(`NOT_PLAIN_ARRAY at ${path}`);
    active.add(item);
    try {
      const keys = Reflect.ownKeys(item);
      if (keys.some((key) => typeof key !== 'string')) throw new TypeError(`SYMBOL_KEY at ${path}`);
      if (Array.isArray(item)) {
        if (keys.length !== item.length + 1) throw new TypeError(`SPARSE_OR_EXTENDED_ARRAY at ${path}`);
        take('[]');
        const parts: string[] = [];
        for (let index = 0; index < item.length; index++) {
          if (index) take(',');
          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
            throw new TypeError(`NON_DATA_PROPERTY at ${path}[${index}]`);
          }
          parts.push(visit(descriptor.value, `${path}[${index}]`, depth + 1));
        }
        return `[${parts.join(',')}]`;
      }
      take('{}');
      const parts: string[] = [];
      for (const key of (keys as string[]).sort()) {
        if (parts.length) take(',');
        if (!key.isWellFormed()) throw new TypeError(`INVALID_UNICODE_KEY at ${path}`);
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError(`NON_DATA_PROPERTY at ${path}.${key}`);
        const encodedKey = quote(key); take(':');
        parts.push(`${encodedKey}:${visit(descriptor.value, `${path}.${key}`, depth + 1)}`);
      }
      return `{${parts.join(',')}}`;
    } finally {
      active.delete(item);
    }
  };
  return visit(value, '$', 0);
}

/** Receipt exports use two-space JSON plus a newline. Refuse an artifact that
 * our own raw-text boundary could not ingest, including formatting overhead. */
export function assertReceiptTextLimit(value: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(value, null, 2) + '\n', 'utf8');
  if (bytes > CANONICAL_MAX_BYTES) throw new RangeError(`RECEIPT_BYTE_LIMIT: formatted receipt exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes`);
}

/** SHA-256 of the canonical JSON bytes; this is not a signature. */
export function sha256(value: unknown): string {
  return sha256Bytes(canonicalize(value));
}

export function sha256Bytes(text: string): string {
  if (typeof text !== 'string' || !text.isWellFormed()) throw new TypeError('Expected well-formed UTF-8 text');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function jsonClone<T>(value: T): T {
  return JSON.parse(canonicalize(value)) as T;
}

/** Requires an explicit UTC instant and rejects invalid calendar dates. */
export function timestamp(value: unknown, label = 'timestamp'): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new TypeError(`${label} must be an ISO UTC instant with seconds and optional three-digit milliseconds`);
  }
  const time = Date.parse(value);
  const expanded = value.length === 20 ? value.replace('Z', '.000Z') : value;
  if (!Number.isFinite(time) || new Date(time).toISOString() !== expanded) throw new TypeError(`${label} is not a valid calendar instant`);
  return time;
}
