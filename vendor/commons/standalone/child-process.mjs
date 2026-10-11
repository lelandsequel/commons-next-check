// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { spawnSync as actualSpawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bundlePath, packageRoot, packagePath } from './package-root.mjs';
import { packageSpecifiers } from 'standalone:inputs';
export * from 'node:child_process';

// The shared tests invoke the package CLI. In the single-file deployment that
// CLI is this file itself; temporary receipt/input files remain ordinary files.
export function spawnSync(command, args, options) {
  if (command === process.execPath && Array.isArray(args) && options?.cwd === packageRoot && args.includes('-e')) {
    args = [...args];
    const expressionIndex = args.indexOf('-e') + 1;
    if (typeof args[expressionIndex] !== 'string') throw new Error('Missing embedded SDK test expression');
    for (const specifier of packageSpecifiers) for (const quote of ['"', "'"]) {
      args[expressionIndex] = args[expressionIndex].split(quote + specifier + quote).join(JSON.stringify(pathToFileURL(bundlePath).href));
    }
    options = {...options, cwd:dirname(bundlePath)};
  }
  if (command === process.execPath && Array.isArray(args) &&
      (args[0] === packagePath('bin', 'cosmic.mjs') || (args[0] === 'bin/cosmic.mjs' && options?.cwd === packageRoot))) {
    args = [bundlePath, ...args.slice(1)];
    if (options?.cwd === packageRoot) options = {...options, cwd: dirname(bundlePath)};
  }
  return actualSpawnSync(command, args, options);
}
