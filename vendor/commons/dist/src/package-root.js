// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { dirname, basename, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Keep assets in one place for both the source tree and the shipped dist/src tree.
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(moduleDirectory, basename(dirname(moduleDirectory)) === 'dist' ? '../..' : '..');
export const packagePath = (...parts) => join(packageRoot, ...parts);
