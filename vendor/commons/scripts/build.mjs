#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { mkdtempSync, readdirSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// No generated timestamps, absolute paths, network calls, or dependency hooks.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.slice(2).length === 1 && process.argv[2] === '--check';
if (process.argv.length > 2 && !check) throw new Error('Usage: node scripts/build.mjs [--check]');
const compilerRoot = join(root, 'node_modules', 'typescript');
if (JSON.parse(readFileSync(join(compilerRoot, 'package.json'), 'utf8')).version !== '5.9.3') {
  throw new Error('Build requires pinned TypeScript 5.9.3; run npm ci --ignore-scripts');
}
const temporary = mkdtempSync(join(root, '.build-'));
function files(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]).sort();
}
try {
  const compile = spawnSync(process.execPath, [join(compilerRoot, 'bin', 'tsc'), '-p', join(root, 'tsconfig.json'), '--outDir', temporary], {cwd: root, stdio: 'inherit'});
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else if (check) {
    const dist = join(root, 'dist');
    const expected = files(temporary).map(file => relative(temporary, file));
    const actual = files(dist).map(file => relative(dist, file));
    if (JSON.stringify(expected) !== JSON.stringify(actual) || expected.some(file => !readFileSync(join(temporary, file)).equals(readFileSync(join(dist, file))))) {
      throw new Error('Shipped dist differs from a fresh compilation; run npm run build');
    }
    process.stdout.write(`REPRODUCIBLE: all ${expected.length} compiled files match byte-for-byte.\n`);
  } else {
    rmSync(join(root, 'dist'), {recursive: true, force: true});
    renameSync(temporary, join(root, 'dist'));
    process.stdout.write(`Built ${files(join(root, 'dist')).length} deterministic JavaScript/type files.\n`);
  }
} finally {
  rmSync(temporary, {recursive: true, force: true});
}
