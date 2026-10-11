// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { readFileSync, readdirSync } from 'node:fs';
import { parseStrictJson } from "./strict-json.js";
import { packagePath } from "./package-root.js";
const directory = packagePath('examples');
const descriptions = {
    'sensor-investigation': { name: 'Sensor investigation', description: 'Update two declared explanations, inspect model adequacy, and choose the next measurement.' },
    'discovery-deferred': { name: 'Rejected model family', description: 'A zero-prior decoy cannot rescue rejected active models: DEFER with no action suggestion.' },
    'release-authorization': { name: 'Release authorization', description: 'Evaluate artifact evidence against explicit tests, review, and security requirements.' },
    'release-deferred': { name: 'Missing evidence', description: 'See why missing review evidence produces DEFER instead of approval.' },
    'release-denied': { name: 'Failed requirement', description: 'See a complete record fail an explicit security requirement.' },
};
export function listExamples() { return readdirSync(directory).filter(n => n.endsWith('.json')).sort().map(name => { const id = name.slice(0, -5); return { id, ...descriptions[id], input: parseStrictJson(readFileSync(packagePath('examples', name), 'utf8')) }; }); }
export function getExample(id = 'sensor-investigation') { const found = listExamples().find(e => e.id === id); if (!found)
    throw new Error(`Unknown example: ${id}`); return found.input; }
