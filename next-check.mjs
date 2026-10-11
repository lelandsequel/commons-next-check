// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Face over the public COMMONS engine: cause/check words in, next check or
// refusal out. The math lives in the vendored tree; nothing is copied here.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DiscoverySession,
  replaySession,
} from './vendor/commons/dist/src/inference/session.js';

// Vendored public engine: jourdanlabs/cosmic-commons @ ef76b3a (COMMONS 0.2.2).
// This import path is the whole engine dependency. No other imports. Do not edit vendor/.

export const MODEL_ID = 'commons-next-check/1';
export const OBSERVATION_ASSUMPTION =
  'conditionally-independent-given-hypothesis-and-experiment';

// recommend() stop reasons, said in plain words.
export const REFUSAL_WORDS = {
  'budget-exhausted': 'no money left for another check',
  'posterior-threshold': 'one cause is past the stop line you declared',
  'no-informative-experiment': 'nothing left is worth what it costs',
  'model-mismatch': 'the list of causes is not enough',
};

function fail(message) {
  throw new Error(`commons-next-check: ${message}`);
}

function checkSumIsOne(value, name) {
  if (Math.abs(value - 1) > 1e-12) fail(`${name} must sum to 1`);
}

// The person's file, in face words. The observation-assumption string the
// engine requires is copied through here, not hidden.
export function validateFaceInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('input must be a JSON object with causes, checks, budget, observationAssumption');
  }
  const { causes, checks, budget, stopProbability, observationAssumption } = raw;
  if (observationAssumption !== OBSERVATION_ASSUMPTION) {
    fail(`observationAssumption must be exactly ${JSON.stringify(OBSERVATION_ASSUMPTION)}`);
  }
  if (!Array.isArray(causes) || causes.length < 2) fail('declare at least two causes');
  const causeIds = new Set();
  let priorSum = 0;
  for (const cause of causes) {
    if (!cause || typeof cause.id !== 'string' || !cause.id.trim()) fail('every cause needs a nonempty string id');
    if (causeIds.has(cause.id)) fail('cause ids must be unique');
    causeIds.add(cause.id);
    if (typeof cause.prior !== 'number' || !(cause.prior >= 0) || !(cause.prior <= 1)) {
      fail(`prior for cause ${JSON.stringify(cause.id)} must be a probability in [0,1]`);
    }
    priorSum += cause.prior;
  }
  checkSumIsOne(priorSum, 'cause priors');
  if (!Array.isArray(checks) || checks.length < 1) fail('declare at least one check');
  const checkIds = new Set();
  for (const check of checks) {
    if (!check || typeof check.id !== 'string' || !check.id.trim()) fail('every check needs a nonempty string id');
    if (checkIds.has(check.id)) fail('check ids must be unique');
    checkIds.add(check.id);
    if (typeof check.cost !== 'number' || !Number.isFinite(check.cost) || check.cost <= 0) {
      fail(`cost for check ${JSON.stringify(check.id)} must be finite and positive`);
    }
    if (!Array.isArray(check.outcomes) || check.outcomes.length !== 2) {
      fail(`check ${JSON.stringify(check.id)} must declare exactly two outcomes`);
    }
    if (new Set(check.outcomes).size !== 2) fail(`outcomes of check ${JSON.stringify(check.id)} must be unique`);
    const rows = check.likelihoods;
    if (!rows || typeof rows !== 'object' || Object.keys(rows).length !== causes.length ||
        ![...causeIds].every((id) => Object.hasOwn(rows, id))) {
      fail(`check ${JSON.stringify(check.id)} needs one likelihood row per cause`);
    }
    for (const id of causeIds) {
      const row = rows[id];
      if (!row || typeof row !== 'object' || Object.keys(row).length !== 2 ||
          !check.outcomes.every((o) => Object.hasOwn(row, o))) {
        fail(`likelihood row for cause ${JSON.stringify(id)} in check ${JSON.stringify(check.id)} must cover exactly the two outcomes`);
      }
      let rowSum = 0;
      for (const outcome of check.outcomes) {
        const p = row[outcome];
        if (typeof p !== 'number' || p < 0 || p > 1) fail('likelihoods must be probabilities in [0,1]');
        rowSum += p;
      }
      checkSumIsOne(rowSum, `likelihood row for cause ${JSON.stringify(id)} in check ${JSON.stringify(check.id)}`);
    }
  }
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) {
    fail('budget must be finite and nonnegative');
  }
  if (stopProbability !== undefined &&
      (typeof stopProbability !== 'number' || !(stopProbability > 0.5))) {
    fail('stopProbability, when present, must be greater than 0.5');
  }
  // Likelihoods are declared by the person. The face learns and invents nothing.
  return { causes, checks, budget, stopProbability, observationAssumption };
}

// Cause -> hypothesis, check -> experiment. That mapping is the whole product.
export function toDiscoveryConfig(face) {
  return {
    modelId: MODEL_ID,
    hypotheses: face.causes.map((c) => ({ id: c.id, prior: c.prior })),
    experiments: face.checks.map((c) => ({
      id: c.id,
      cost: c.cost,
      outcomes: [...c.outcomes],
      likelihoods: Object.fromEntries(
        Object.entries(c.likelihoods).map(([k, v]) => [k, { ...v }]),
      ),
    })),
    budget: face.budget,
    ...(face.stopProbability === undefined ? {} : { stopProbability: face.stopProbability }),
    observationAssumption: face.observationAssumption,
  };
}

// Face-worded observation -> engine observation.
function toEngineObservation(face, observation) {
  if (!observation || typeof observation !== 'object') fail('observation must be an object');
  if (typeof observation.id !== 'string' || !observation.id) fail('observation needs a string id');
  const checkId = observation.checkId;
  if (typeof checkId !== 'string' || !face.checks.some((c) => c.id === checkId)) {
    fail(`observation checkId ${JSON.stringify(checkId)} is not a declared check`);
  }
  return { id: observation.id, experimentId: checkId, outcome: observation.outcome };
}

// Causes and checks in; next check or refusal out, plus an engine receipt
// per observation. Every receipt is rechecked with replaySession.
export function nextCheck(faceInput, observations = []) {
  const face = validateFaceInput(faceInput);
  const config = toDiscoveryConfig(face);
  const session = new DiscoverySession(config);
  const list = Array.isArray(observations) ? observations : [observations];
  const receipts = [];
  for (const item of list) {
    const receipt = session.observe(toEngineObservation(face, item));
    receipts.push(receipt);
  }
  if (receipts.length > 0) replaySession(config, receipts);
  return { recommendation: session.recommend(), posterior: session.posterior(), receipts, config };
}

export function formatResult({ recommendation, posterior, receipts }) {
  const lines = [];
  if (recommendation.status === 'experiment') {
    lines.push(`next check: ${recommendation.experimentId}`);
    lines.push(`cost: ${recommendation.cost}`);
    lines.push(`information per cost: ${recommendation.informationGainPerCost}`);
  } else {
    lines.push(`refusal: ${recommendation.reason}`);
    lines.push(REFUSAL_WORDS[recommendation.reason] ?? '');
  }
  // After model-mismatch there is no belief to report: the stale weights are
  // not printed, and the receipt below is evidence, not a current belief.
  const mismatch = recommendation.status === 'stop' && recommendation.reason === 'model-mismatch';
  if (!mismatch) {
    lines.push('posterior over causes:');
    for (const [id, p] of Object.entries(posterior)) lines.push(`  ${id}: ${p}`);
  }
  for (const receipt of receipts) {
    lines.push(`receipt ${receipt.id}: ${JSON.stringify(receipt)}`);
  }
  return lines.join('\n');
}

// Receipts are written only when the path does not already exist.
export function writeReceiptIfAbsent(path, data) {
  try {
    writeFileSync(path, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
    return 'wrote';
  } catch (error) {
    if (error?.code === 'EEXIST') return 'exists';
    throw error;
  }
}

function parseArgs(argv) {
  const out = { input: null, observe: null, receiptOut: null };
  const rest = [...argv];
  while (rest.length > 0) {
    const token = rest.shift();
    if (token === '--observe') out.observe = rest.shift() ?? null;
    else if (token === '--receipt-out') out.receiptOut = rest.shift() ?? null;
    else if (token.startsWith('--')) fail(`unknown flag ${token}`);
    else if (out.input === null) out.input = token;
    else fail(`unexpected argument ${token}`);
  }
  if (!out.input) fail('usage: node next-check.mjs <input.json> [--observe <observation.json>] [--receipt-out <path>]');
  return out;
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const faceInput = JSON.parse(readFileSync(args.input, 'utf8'));
    let observations = [];
    if (args.observe) {
      const parsed = JSON.parse(readFileSync(args.observe, 'utf8'));
      observations = Array.isArray(parsed) ? parsed : [parsed];
    }
    const result = nextCheck(faceInput, observations);
    console.log(formatResult(result));
    if (args.receiptOut && result.receipts.length > 0) {
      const payload = result.receipts.length === 1 ? result.receipts[0] : result.receipts;
      const status = writeReceiptIfAbsent(args.receiptOut, payload);
      console.log(status === 'wrote'
        ? `receipt written: ${args.receiptOut}`
        : `receipt path already exists, not overwritten: ${args.receiptOut}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
