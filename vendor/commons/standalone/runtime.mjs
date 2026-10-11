// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { endianness } from 'node:os';
import { sourceFiles, implementation } from 'standalone:inputs';
import { sha256 } from '../dist/src/canonical.js';

function bundleDigest() {
  // Deliberately read the actual executing file on every call: relocation is
  // harmless, but even a comment-only on-disk mutation changes this identity.
  return createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
}
export function executionRuntime() {
  return {implementation: `${implementation}/standalone`, node: process.versions.node,
    v8: process.versions.v8, platform: process.platform, architecture: process.arch,
    endianness: endianness(), sourceDigest: sha256(sourceFiles), codeDigest: bundleDigest()};
}
export function policyImplementation() {
  return `${implementation}/policy-v1/standalone/${bundleDigest()}`;
}
