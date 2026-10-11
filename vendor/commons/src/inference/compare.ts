// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.
import { currentReplayRuntime } from './runtime.ts';
import { DiscoverySession } from './session.ts';
import type { DiscoveryConfig, EvidenceReceipt, ReplayRuntime } from './types.ts';

/** Both v1 and v2 numerical records can be inspected; hashes are intentionally not trusted here. */
export type ComparableReceipt = Pick<EvidenceReceipt,
  'id' | 'experimentId' | 'outcome' | 'sequence' | 'status' | 'cost' | 'posterior' |
  'entropyNats' | 'priorPredictiveProbability' | 'priorPredictiveLogProbability'> & {runtime?: ReplayRuntime};

export interface NumericalComparisonOptions { absoluteTolerance: number; relativeTolerance: number }

/** Recompute given observations and compare numerical fields with caller-declared
 * tolerances. This is explicitly NOT verification of hashes, runtime, source or truth. */
export function compareReceiptNumerics(
  config: DiscoveryConfig, receipts: ComparableReceipt[], options: NumericalComparisonOptions,
) {
  if (!Array.isArray(receipts)) throw new Error('Receipts must be an array');
  const {absoluteTolerance, relativeTolerance} = options;
  for (const value of [absoluteTolerance, relativeTolerance]) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Comparison tolerances must be finite and nonnegative');
  }
  const session = new DiscoverySession(config);
  let comparedNumbers = 0, exactlyEqualNumbers = 0;
  const differences: Array<{path: string; recorded: number; recomputed: number; absoluteDifference: number; withinTolerance: boolean}> = [];
  const structuralDifferences: string[] = [];
  function compareNumber(path: string, recorded: number, recomputed: number) {
    if (!Number.isFinite(recorded) || !Number.isFinite(recomputed)) {
      structuralDifferences.push(`${path}: missing or nonfinite number`); return;
    }
    comparedNumbers++;
    if (recorded === recomputed) { exactlyEqualNumbers++; return; }
    const absoluteDifference = Math.abs(recorded - recomputed);
    differences.push({path, recorded, recomputed, absoluteDifference,
      withinTolerance: absoluteDifference <= absoluteTolerance + relativeTolerance * Math.max(Math.abs(recorded), Math.abs(recomputed))});
  }
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    const actual = session.observe({id: receipt.id, experimentId: receipt.experimentId, outcome: receipt.outcome});
    const prefix = `receipts[${i}]`;
    for (const key of ['sequence', 'status'] as const) {
      if (receipt[key] !== actual[key]) structuralDifferences.push(`${prefix}.${key}: differs`);
    }
    for (const key of ['cost', 'entropyNats', 'priorPredictiveProbability'] as const) compareNumber(`${prefix}.${key}`, receipt[key], actual[key]);
    if (receipt.priorPredictiveLogProbability === null || actual.priorPredictiveLogProbability === null) {
      if (receipt.priorPredictiveLogProbability !== actual.priorPredictiveLogProbability) structuralDifferences.push(`${prefix}.priorPredictiveLogProbability: support differs`);
    } else compareNumber(`${prefix}.priorPredictiveLogProbability`, receipt.priorPredictiveLogProbability, actual.priorPredictiveLogProbability);
    if (!receipt.posterior || typeof receipt.posterior !== 'object' ||
        Object.keys(receipt.posterior).length !== Object.keys(actual.posterior).length ||
        Object.keys(actual.posterior).some(key => !Object.hasOwn(receipt.posterior, key))) {
      structuralDifferences.push(`${prefix}.posterior: candidate keys differ`);
    } else {
      for (const key of Object.keys(actual.posterior)) compareNumber(`${prefix}.posterior.${key}`, receipt.posterior[key], actual.posterior[key]);
    }
  }
  return {
    mode: 'numerical-comparison' as const, exactReplayVerified: false as const,
    claim: 'Numerical agreement for these observations and declared tolerances only. Hashes, runtime identity, and the source artifact are not verified.',
    currentRuntime: currentReplayRuntime(),
    recordedRuntime: receipts[0]?.runtime ?? null,
    tolerances: {absoluteTolerance, relativeTolerance}, comparedNumbers, exactlyEqualNumbers,
    withinTolerance: structuralDifferences.length === 0 && differences.every(difference => difference.withinTolerance),
    differences, structuralDifferences,
  };
}
