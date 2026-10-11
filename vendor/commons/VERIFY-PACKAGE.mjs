// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Integrity check only: a manifest is not a signature or an independent anchor.
import { readFileSync, lstatSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./', import.meta.url));
const manifest = 'CHECKSUMS.sha256';
const expected = new Map();
for (const line of readFileSync(join(root, manifest), 'utf8').trimEnd().split('\n')) {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  if (!match || match[2].startsWith('/') || match[2].split('/').some(s => !s || s === '.' || s === '..') || match[2].includes('\\') || expected.has(match[2])) throw new Error('Invalid manifest entry');
  expected.set(match[2], match[1]);
}
const actual = [];
function walk(directory, prefix = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const name = prefix + entry.name, path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Unexpected symbolic link: ' + name);
    if (entry.isDirectory()) {
      // Local investigations create data/runs after installation; never part of source delivery.
      if (name === 'data') continue;
      walk(path, name + '/');
    } else if (entry.isFile() && name !== manifest) actual.push(name);
  }
}
walk(root);
if (actual.length !== expected.size) throw new Error('Manifest/file count mismatch');
for (const path of actual) {
  if (!lstatSync(join(root, path)).isFile()) throw new Error('Not a regular file: ' + path);
  const digest = createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
  if (digest !== expected.get(path)) throw new Error('Checksum mismatch: ' + path);
}
console.log(JSON.stringify({ valid: true, files: actual.length, manifest, authenticity: 'NOT_ESTABLISHED' }));
