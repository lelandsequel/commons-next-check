// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Combined B1/B2/B5/B6 browser gate against the shipped JavaScript build.
// Run from package root with external Playwright/Chromium environment variables
// documented in browser-discovery-check.mjs and browser-repair-check.mjs.
import assert from 'node:assert/strict';
import { executionRuntime } from '../dist/src/run.js';
const runtime = executionRuntime();
await import('./browser-discovery-check.mjs');
await import('./browser-repair-check.mjs');
assert.deepEqual(executionRuntime(), runtime, 'Source or compiled build changed across the combined browser gate');
console.log('Combined Commons browser gate passed against shipped dist JavaScript.');
