#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Reconstructed graph stress cases. Original dense-cycle bytes were not supplied.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const source = args.includes('--source');
const baselineIndex = args.indexOf('--baseline');
const baseline = baselineIndex < 0 ? null : args[baselineIndex + 1];
const root = fileURLToPath(new URL('../', import.meta.url));
const candidate = pathToFileURL(resolve(root, source ? 'src/evidence.ts' : 'dist/src/evidence.js')).href;
const worker = String.raw`
  import { performance } from 'node:perf_hooks';
  const { inspectEvidence } = await import(process.argv[1]);
  const count = Number(process.argv[2]);
  const ids = Array.from({ length: count }, (_, i) => 'fact-' + String(i).padStart(4, '0'));
  const input = { sources: [{ id: 'source' }], facts: ids.map(id => ({ id, sourceId: 'source', value: true, dependsOn: ids })) };
  const inputBytes = Buffer.byteLength(JSON.stringify(input));
  const started = performance.now();
  const report = inspectEvidence(input, '2026-10-02T00:00:00Z');
  const elapsedMs = performance.now() - started;
  const reportBytes = Buffer.byteLength(JSON.stringify(report));
  console.log(JSON.stringify({ nodes: count, edges: count * count, inputBytes, elapsedMs,
    maxRssKiB: process.resourceUsage().maxRSS, valid: report.valid,
    issueCount: report.issues.length, issueCodes: [...new Set(report.issues.map(issue => issue.code))],
    cycleMemberReferences: report.issues.reduce((total, issue) => total + (issue.code === 'DEPENDENCY_CYCLE' ? issue.factIds.length : 0), 0),
    factCount: report.facts.length, lineageCount: report.lineage.length,
    reasonCount: report.facts.reduce((total, fact) => total + fact.reasons.length, 0),
    reportBytes }));
`;

function measure(module, count) {
  // The baseline is confined to a smaller graph and a separately capped child process.
  const child = spawnSync(process.execPath, ['--max-old-space-size=192', '--input-type=module', '-e', worker, module, String(count)], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024,
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.signal, null, 'Resource-check child must complete within its memory/time budget');
  assert.equal(child.status, 0, child.stderr.slice(-2000));
  return JSON.parse(child.stdout);
}

const acceptedBoundary = measure(candidate, 100);
assert.equal(acceptedBoundary.valid, false);
assert.equal(acceptedBoundary.issueCount, 1);
assert.deepEqual(acceptedBoundary.issueCodes, ['DEPENDENCY_CYCLE']);
assert.equal(acceptedBoundary.cycleMemberReferences, 100);
assert.equal(acceptedBoundary.reasonCount, 10_100);
const oversized = measure(candidate, 245);
assert.ok(oversized.inputBytes < 2_000_000);
assert.deepEqual(oversized.issueCodes, ['EVIDENCE_LIMIT']);
assert.equal(oversized.issueCount, 1);
assert.equal(oversized.factCount, 0);
assert.equal(oversized.lineageCount, 0);
assert.equal(oversized.reasonCount, 0);
const oldBoundary = baseline ? measure(pathToFileURL(resolve(baseline)).href, 100) : null;
if (oldBoundary) assert.ok(oldBoundary.cycleMemberReferences > acceptedBoundary.cycleMemberReferences);
console.log(JSON.stringify({
  schema: 'cosmic.commons.evidence-resource-check.v1',
  origin: 'RECONSTRUCTED_DENSE_CYCLES',
  originalDenseCycleAvailable: false,
  node: process.versions.node,
  candidateModule: { file: source ? 'src/evidence.ts' : 'dist/src/evidence.js', sha256: createHash('sha256').update(readFileSync(new URL(candidate))).digest('hex') },
  scope: 'Measured inspection wall time and maximum resident memory (including report serialization) describe this run, not a portable latency guarantee. Graph work is bounded by 1000 facts and 10000 declared dependency references; cyclic-component diagnostics are linear in fact count.',
  acceptedBoundary, oversized, baselineAcceptedBoundary: oldBoundary, passed: true,
}, null, 2));
