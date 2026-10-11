#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
if (Number(process.versions.node.split('.')[0]) < 20) {
  process.stderr.write(`COSMIC Commons requires Node 20 or newer; found ${process.versions.node}.\n`);
  process.exit(2);
}
const { main } = await import('../dist/src/cli.js');
await main(process.argv.slice(2));
