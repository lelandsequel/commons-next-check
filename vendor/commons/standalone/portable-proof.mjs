// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { bundlePath } from './package-root.mjs';
import { sourceFiles, assetHashes, assets, implementation, expectedExports } from 'standalone:inputs';
import { executionRuntime, sha256 } from '../dist/src/index.js';

test('standalone ESM exports load directly with no package resolution or side effects', () => {
  const expression = `import * as sdk from ${JSON.stringify(pathToFileURL(bundlePath).href)}; console.log(JSON.stringify(Object.keys(sdk).sort()));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', expression], {encoding:'utf8'});
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), expectedExports);
});
test('standalone doctor binds actual file bytes, source inputs and recorded runtime', () => {
  const result = spawnSync(process.execPath, [bundlePath, 'doctor'], {encoding:'utf8'});
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  const doctor = JSON.parse(result.stdout);
  assert.equal(doctor.executionTarget, 'Node >=20');
  assert.equal(doctor.typescriptRequired, false); assert.equal(doctor.npmInstallRequired, false);
  assert.deepEqual(doctor.runtime, executionRuntime());
  assert.equal(doctor.runtime.implementation, `${implementation}/standalone`);
  assert.equal(doctor.runtime.sourceDigest, sha256(sourceFiles));
  assert.equal(doctor.runtime.codeDigest, createHash('sha256').update(readFileSync(bundlePath)).digest('hex'));
});
test('embedded examples, workbench and original regression bytes match their build input hashes', () => {
  assert.deepEqual(Object.keys(assetHashes), Object.keys(assets));
  for (const [path, digest] of Object.entries(assetHashes)) {
    assert.equal(createHash('sha256').update(Buffer.from(assets[path], 'base64')).digest('hex'), digest, path);
  }
});
