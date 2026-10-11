// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const bundlePath = fileURLToPath(import.meta.url);
// This reserved namespace is never materialized on disk. User paths outside it
// retain the ordinary filesystem behavior of the shared CLI.
export const packageRoot = join(dirname(bundlePath), '.cosmic-embedded-assets');
export const packagePath = (...parts) => join(packageRoot, ...parts);
