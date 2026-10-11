// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.
import { endianness } from 'node:os';
import type { ReplayRuntime } from './types.ts';

/** Validated reference runtime for recorded evidence; not an execution-version pin. */
export const VALIDATED_NODE_VERSION = '24.19.0';
export const RECEIPT_SCHEMA_VERSION = 2 as const;

/** Runtime context, not proof of identical hardware, binary build or source bytes.
 * Exact replay also requires the same implementation artifact and matching receipts. */
export function currentReplayRuntime(): ReplayRuntime {
  return {
    implementation: '@cosmic/commons-discovery/0.2.1',
    node: process.versions.node,
    v8: process.versions.v8,
    platform: process.platform,
    architecture: process.arch,
    endianness: endianness(),
    numericalModel: 'binary64-native-math',
  };
}

export class ReplayRuntimeError extends Error {
  readonly code: 'MISSING_REPLAY_RUNTIME' | 'REPLAY_RUNTIME_MISMATCH';
  constructor(code: ReplayRuntimeError['code'], message: string) {
    super(message);
    this.name = 'ReplayRuntimeError';
    this.code = code;
  }
}

/** Reject absent/changed runtime context before any receipt is replayed. */
export function assertReplayRuntime(recorded: ReplayRuntime | undefined): void {
  const actual = currentReplayRuntime();
  const keys = Object.keys(actual) as Array<keyof ReplayRuntime>;
  if (!recorded || keys.some(key => typeof recorded[key] !== 'string' || !recorded[key])) {
    throw new ReplayRuntimeError('MISSING_REPLAY_RUNTIME',
      'Receipt has no complete runtime contract. Legacy receipts require explicit numerical comparison; they cannot receive v2 exact verification.');
  }
  const differences = keys.filter(key => recorded[key] !== actual[key]);
  if (differences.length) {
    throw new ReplayRuntimeError('REPLAY_RUNTIME_MISMATCH',
      'Exact replay runtime mismatch: ' + differences.map(key => `${key}: recorded=${recorded[key]}, current=${actual[key]}`).join('; ') +
      '. Use the recorded runtime and source artifact, or request numerical comparison without byte verification.');
  }
}
