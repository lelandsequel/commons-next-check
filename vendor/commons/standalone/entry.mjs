// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { main } from '../dist/src/cli.js';
import { executionRuntime } from '../dist/src/runtime.js';
import { implementation } from 'standalone:inputs';
export * from '../dist/src/index.js';

// Importing the SDK never starts the CLI or registers the embedded tests.
let invoked = false;
try { invoked = Boolean(process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))); }
catch { /* An importing host may put an ordinary, non-file argument in argv[1]. */ }
if (invoked) {
  if (Number(process.versions.node.split('.')[0]) < 20) {
    process.stderr.write(`COSMIC Commons requires Node 20 or newer; found ${process.versions.node}.\n`);
    process.exitCode = 2;
  } else if (process.argv.length === 2 || (process.argv.length === 3 && ['help','--help','-h'].includes(process.argv[2]))) {
    process.stdout.write(`COSMIC Commons ${implementation.split('/').at(-1)} — standalone reasoning, decisions and replay\n\n`+
      'Use: node cosmic-commons.mjs <command>\n\n'+
      '  serve [--port 4317]                    Open the embedded local workbench\n'+
      '  examples                               List embedded examples\n'+
      '  demo [name] [--out receipt.json]         Run an embedded example\n'+
      '  run input.json [--out receipt.json]     Run an external JSON input\n'+
      '  verify receipt.json [--expect SHA256]   Check integrity, replay and anchor\n'+
      '  doctor                                 Inspect this file and runtime\n'+
      '  prove                                  Run embedded correctness checks\n\n'+
      'Node >=20; no installation, adjacent assets or extraction required.\n'+
      'Verification without --expect checks consistency, not trusted origin.\n');
  } else if (process.argv.length === 3 && process.argv[2] === 'doctor') {
    process.stdout.write(JSON.stringify({runtime:executionRuntime(),executionTarget:'Node >=20',
      typescriptRequired:false,npmInstallRequired:false,deployment:'standalone',
      validationEvidence:'Run this file with prove for embedded checks; the source archive contains the full verification record and BUNDLE-INPUTS.json.',
      replayContract:'Exact recorded Node/V8, platform, architecture, endianness, embedded source and whole executing-file hashes'},null,2)+'\n');
  } else if (process.argv.length === 3 && process.argv[2] === 'prove') {
    if (process.execArgv.includes('--test-reporter=tap')) await import('standalone:proof');
    else {
      const proof = spawnSync(process.execPath, ['--test-reporter=tap', fileURLToPath(import.meta.url), 'prove'], {stdio:'inherit'});
      if (proof.error) { process.stderr.write(`COSMIC: ${proof.error.message}\n`); process.exitCode = 2; }
      else process.exitCode = proof.status ?? 1;
    }
  } else {
    await main(process.argv.slice(2));
  }
}
