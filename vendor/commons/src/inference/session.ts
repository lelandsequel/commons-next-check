// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.
import { createHash } from 'node:crypto';
import { assertReplayRuntime, currentReplayRuntime, RECEIPT_SCHEMA_VERSION, ReplayRuntimeError } from './runtime.ts';
import type {
  DecisionAction, DiscoveryConfig, DiscoverySnapshot, EvidenceReceipt,
  Experiment, ExperimentUtility, Observation, Recommendation, ReplayRuntime,
} from './types.ts';

/** Deterministic finite JSON encoding for receipts. No timestamps or global counters. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Receipt numbers must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) throw new Error('Receipts require dense arrays');
    }
    return '[' + value.map(canonicalJSON).join(',') + ']';
  }
  if (typeof value === 'object' && value !== null) {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error('Receipts require plain objects');
    }
    const record = value as Record<string, unknown>;
    // Like JSON.stringify, absent optional object properties have no wire value.
    return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(record[key])).join(',') + '}';
  }
  throw new Error('Unsupported receipt value');
}

export function hashJSON(value: unknown): string {
  return createHash('sha256').update(canonicalJSON(value)).digest('hex');
}

export const DISCOVERY_MAX_IDENTIFIER_LENGTH = 256;
export function validateDiscoveryIdentifier(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a nonempty string`);
  if(value.length>DISCOVERY_MAX_IDENTIFIER_LENGTH) throw new RangeError(`DISCOVERY_IDENTIFIER_LIMIT: ${name} exceeds ${DISCOVERY_MAX_IDENTIFIER_LENGTH} UTF-16 code units`);
}
const identifier:typeof validateDiscoveryIdentifier=validateDiscoveryIdentifier;
function probability(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a probability in [0,1]`);
  }
}
function assertKeys(record: Record<string, unknown>, keys: string[], name: string): void {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))) {
    throw new Error(`${name} must contain exactly the declared keys`);
  }
}

export function entropy(probabilities: number[]): number {
  const result = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
  return result === 0 ? 0 : result;
}

// Costs are exact decimal quantities in their JavaScript number's shortest decimal
// representation. Integer accounting avoids .3 - .1 - .1 incorrectly rejecting .1.
function decimalParts(value: number): { coefficient: bigint; scale: number } {
  const [mantissa, exponent = '0'] = value.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  return {coefficient: BigInt(whole + fraction), scale: fraction.length - Number(exponent)};
}

function decimalNumber(units: bigint, scale: number): number {
  return Number(`${units.toString()}e${-scale}`);
}

/**
 * Exact Bayes over a declared discrete model family. This does not discover arbitrary
 * structural graphs or prove the family contains the truth. Experiment utility is a
 * greedy one-step mutual-information/cost criterion, not globally optimal planning.
 */
export class DiscoverySession {
  private readonly definition: DiscoveryConfig;
  private readonly definitionHash: string;
  private readonly runtime = currentReplayRuntime();
  private readonly chainAnchorHash: string;
  private readonly experiments: Map<string, Experiment>;
  private logWeights: number[];
  private readonly ids: string[];
  private readonly costScale: number;
  private readonly budgetUnits: bigint;
  private readonly costUnits: Map<string, bigint>;
  private spentUnits = 0n;
  private mismatch = false;
  private readonly receipts: EvidenceReceipt[] = [];
  private readonly evidenceIds = new Set<string>();

  constructor(config: DiscoveryConfig) {
    identifier(config.modelId, 'modelId');
    if (config.observationAssumption !== 'conditionally-independent-given-hypothesis-and-experiment') {
      throw new Error('Declare the conditional independence assumption explicitly');
    }
    if (!Number.isFinite(config.budget) || config.budget < 0) throw new Error('budget must be finite and nonnegative');
    if (!Array.isArray(config.hypotheses) || config.hypotheses.length < 2) throw new Error('At least two hypotheses are required');
    this.ids = config.hypotheses.map(h => {identifier(h.id, 'hypothesis id'); probability(h.prior, 'prior'); return h.id;});
    if (new Set(this.ids).size !== this.ids.length) throw new Error('Hypothesis ids must be unique');
    const total = config.hypotheses.reduce((sum, h) => sum + h.prior, 0);
    if (Math.abs(total - 1) > 1e-12) throw new Error('Prior probabilities must sum to one');
    if (!Array.isArray(config.experiments) || config.experiments.length === 0) throw new Error('At least one experiment is required');
    const experimentIds = new Set<string>();
    for (const experiment of config.experiments) {
      identifier(experiment.id, 'experiment id');
      if (experimentIds.has(experiment.id)) throw new Error('Experiment ids must be unique');
      experimentIds.add(experiment.id);
      if (!Number.isFinite(experiment.cost) || experiment.cost <= 0) throw new Error('Experiment cost must be finite and positive');
      if (!Number.isFinite(Math.log(this.ids.length) / experiment.cost)) throw new Error('Experiment cost is too small to represent finite information per cost');
      if (!Array.isArray(experiment.outcomes) || experiment.outcomes.length < 2) throw new Error('Declare at least two outcomes');
      experiment.outcomes.forEach(outcome => identifier(outcome, 'outcome'));
      if (new Set(experiment.outcomes).size !== experiment.outcomes.length) throw new Error('Outcomes must be unique');
      assertKeys(experiment.likelihoods, this.ids, 'Likelihood table');
      for (const id of this.ids) {
        const row = experiment.likelihoods[id];
        assertKeys(row, experiment.outcomes, 'Likelihood row');
        const sum = experiment.outcomes.reduce((s, outcome) => {probability(row[outcome], 'likelihood'); return s + row[outcome];}, 0);
        if (Math.abs(sum - 1) > 1e-12) throw new Error('Each likelihood row must sum to one');
      }
    }
    if (config.stopProbability !== undefined) {
      probability(config.stopProbability, 'stopProbability');
      if (config.stopProbability <= 0.5) throw new Error('stopProbability must be greater than 0.5');
    }
    if (config.minInformationGainNats !== undefined && (!Number.isFinite(config.minInformationGainNats) || config.minInformationGainNats < 0)) {
      throw new Error('minInformationGainNats must be finite and nonnegative');
    }
    // Copy the caller's inputs; later mutation cannot rewrite evidence or likelihoods.
    this.definition = structuredClone(config);
    this.definitionHash = hashJSON(this.definition);
    this.chainAnchorHash = hashJSON({schemaVersion: RECEIPT_SCHEMA_VERSION, definitionHash: this.definitionHash, runtime: this.runtime});
    this.experiments = new Map(this.definition.experiments.map(experiment => [experiment.id, experiment]));
    const budgetParts = decimalParts(config.budget);
    const costs = this.definition.experiments.map(experiment => ({id: experiment.id, ...decimalParts(experiment.cost)}));
    this.costScale = Math.max(budgetParts.scale, ...costs.map(cost => cost.scale));
    this.budgetUnits = budgetParts.coefficient * 10n ** BigInt(this.costScale - budgetParts.scale);
    this.costUnits = new Map(costs.map(cost => [cost.id, cost.coefficient * 10n ** BigInt(this.costScale - cost.scale)]));
    this.logWeights = this.definition.hypotheses.map(h => h.prior === 0 ? -Infinity : Math.log(h.prior / total));
  }

  private probabilities(): number[] {
    const peak = Math.max(...this.logWeights);
    const weights = this.logWeights.map(weight => Math.exp(weight - peak));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return weights.map(weight => weight / total);
  }

  posterior(): Record<string, number> {
    const probabilities = this.probabilities();
    return Object.fromEntries(this.ids.map((id, index) => [id, probabilities[index]]));
  }

  remainingBudget(): number { return decimalNumber(this.budgetUnits - this.spentUnits, this.costScale); }

  canAfford(experimentId: string): boolean {
    const cost = this.costUnits.get(experimentId);
    if (cost === undefined) throw new Error('Unknown experiment');
    return cost <= this.budgetUnits - this.spentUnits;
  }

  experimentUtilities(): ExperimentUtility[] {
    const weights = this.probabilities();
    return Array.from(this.experiments.values(), experiment => {
      const predictiveOutcomes = Object.fromEntries(experiment.outcomes.map(outcome => [outcome,
        this.ids.reduce((sum, id, index) => sum + weights[index] * experiment.likelihoods[id][outcome], 0),
      ]));
      let gain = 0;
      for (let i = 0; i < this.ids.length; i++) {
        if (weights[i] === 0) continue;
        for (const outcome of experiment.outcomes) {
          const likelihood = experiment.likelihoods[this.ids[i]][outcome];
          if (likelihood > 0 && predictiveOutcomes[outcome] > 0) {
            gain += weights[i] * likelihood * (Math.log(likelihood) - Math.log(predictiveOutcomes[outcome]));
          }
        }
      }
      gain = Math.max(0, gain); // Roundoff at an exactly uninformative experiment.
      return {experimentId: experiment.id, cost: experiment.cost, expectedInformationGainNats: gain,
        informationGainPerCost: gain / experiment.cost, predictiveOutcomes};
    });
  }

  recommend(): Recommendation {
    if (this.mismatch) return {status: 'stop', reason: 'model-mismatch'};
    if (this.definition.stopProbability !== undefined && Math.max(...this.probabilities()) >= this.definition.stopProbability) {
      return {status: 'stop', reason: 'posterior-threshold'};
    }
    const affordable = this.experimentUtilities().filter(experiment => this.canAfford(experiment.experimentId));
    if (affordable.length === 0) return {status: 'stop', reason: 'budget-exhausted'};
    const eligible = affordable.filter(experiment => experiment.expectedInformationGainNats > (this.definition.minInformationGainNats ?? 1e-12));
    if (eligible.length === 0) return {status: 'stop', reason: 'no-informative-experiment'};
    eligible.sort((a, b) => b.informationGainPerCost - a.informationGainPerCost ||
      b.expectedInformationGainNats - a.expectedInformationGainNats ||
      (a.experimentId < b.experimentId ? -1 : a.experimentId > b.experimentId ? 1 : 0));
    return {status: 'experiment', ...eligible[0]};
  }

  observe(observation: Observation): EvidenceReceipt {
    identifier(observation.id, 'observation id');
    if (this.mismatch) throw new Error('Session stopped after model mismatch');
    if (this.evidenceIds.has(observation.id)) throw new Error('Duplicate observation id: evidence cannot be counted twice');
    const experiment = this.experiments.get(observation.experimentId);
    if (!experiment) throw new Error('Unknown experiment');
    if (!experiment.outcomes.includes(observation.outcome)) throw new Error('Outcome is outside the declared observation alphabet');
    if (!this.canAfford(experiment.id)) throw new Error('Experiment exceeds remaining budget');
    const nextWeights = this.logWeights.map((weight, i) => {
      const likelihood = experiment.likelihoods[this.ids[i]][observation.outcome];
      return likelihood > 0 ? weight + Math.log(likelihood) : -Infinity;
    });
    const weights = this.probabilities();
    const predictive = this.ids.reduce((sum, id, i) => sum + weights[i] * experiment.likelihoods[id][observation.outcome], 0);
    // Use log support, not an underflowed displayed probability, for impossibility.
    this.mismatch = nextWeights.every(weight => weight === -Infinity);
    let predictiveLogProbability: number | null = null;
    if (!this.mismatch) {
      const peak = Math.max(...nextWeights);
      const logTotal = peak + Math.log(nextWeights.reduce((sum, value) => sum + Math.exp(value - peak), 0));
      predictiveLogProbability = logTotal;
      this.logWeights = nextWeights.map(value => value - logTotal);
    }
    this.spentUnits += this.costUnits.get(experiment.id)!;
    this.evidenceIds.add(observation.id);
    const body = {
      schemaVersion: RECEIPT_SCHEMA_VERSION, runtime: {...this.runtime},
      id: observation.id, experimentId: observation.experimentId, outcome: observation.outcome,
      sequence: this.receipts.length + 1, status: this.mismatch ? 'model-mismatch' as const : 'updated' as const,
      cost: experiment.cost, priorPredictiveProbability: predictive, posterior: this.posterior(),
      priorPredictiveLogProbability: predictiveLogProbability,
      entropyNats: entropy(this.probabilities()), previousHash: this.receipts.at(-1)?.hash ?? this.chainAnchorHash,
    };
    const receipt = {...body, hash: hashJSON(body)};
    this.receipts.push(receipt);
    return structuredClone(receipt);
  }

  /** Rank caller-defined actions by posterior expected loss; include abstention as an action if needed. */
  chooseAction(actions: DecisionAction[]): {actionId: string; expectedLoss: number; alternatives: Array<{actionId: string; expectedLoss: number}>} {
    if (this.mismatch) throw new Error('Cannot recommend an action after model mismatch');
    if (!actions.length) throw new Error('At least one action is required');
    const ids = new Set<string>();
    const posterior = this.posterior();
    const alternatives = actions.map(action => {
      identifier(action.id, 'action id');
      if (ids.has(action.id)) throw new Error('Action ids must be unique');
      ids.add(action.id);
      assertKeys(action.losses, this.ids, 'Action losses');
      if (Object.values(action.losses).some(loss => !Number.isFinite(loss))) throw new Error('Action losses must be finite');
      const expectedLoss = this.ids.reduce((sum, id) => sum + posterior[id] * action.losses[id], 0);
      if (!Number.isFinite(expectedLoss)) throw new Error('Expected loss exceeded the finite numerical range');
      return {actionId: action.id, expectedLoss};
    }).sort((a, b) => a.expectedLoss - b.expectedLoss || (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0));
    return {...alternatives[0], alternatives};
  }

  snapshot(): DiscoverySnapshot {
    return {schemaVersion: RECEIPT_SCHEMA_VERSION, runtime: {...this.runtime}, chainAnchorHash: this.chainAnchorHash,
      modelId: this.definition.modelId, definitionHash: this.definitionHash,
      observationAssumption: this.definition.observationAssumption,
      probabilitySemantics: 'posterior-within-declared-candidate-family', posterior: this.posterior(),
      entropyNats: entropy(this.probabilities()), spent: decimalNumber(this.spentUnits, this.costScale), remainingBudget: this.remainingBudget(),
      modelMismatch: this.mismatch, receipts: structuredClone(this.receipts)};
  }

  /** Export the exact declaration needed to reproduce this numerical receipt chain. */
  exportDefinition(): DiscoveryConfig { return structuredClone(this.definition); }
}

/** Exact v2 replay only. Runtime compatibility is necessary, not sufficient:
 * every body and hash is still recomputed; no float rounding/tolerance is applied. */
export function replaySession(config: DiscoveryConfig, receipts: EvidenceReceipt[], recordedRuntime?: ReplayRuntime): DiscoverySession {
  if (!Array.isArray(receipts)) throw new Error('Receipts must be an array');
  // Empty sessions have no first receipt from which to recover their runtime.
  if (recordedRuntime !== undefined || receipts.length === 0) assertReplayRuntime(recordedRuntime);
  for (const receipt of receipts) {
    if (receipt?.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
      throw new ReplayRuntimeError('MISSING_REPLAY_RUNTIME',
        'Exact replay requires v2 receipts with a recorded runtime. Legacy receipts may only be compared numerically.');
    }
    assertReplayRuntime(receipt.runtime);
  }
  const session = new DiscoverySession(config);
  for (const receipt of receipts) {
    const actual = session.observe({id: receipt.id, experimentId: receipt.experimentId, outcome: receipt.outcome});
    if (canonicalJSON(actual) !== canonicalJSON(receipt)) throw new Error(`Receipt verification failed at sequence ${receipt.sequence}`);
  }
  return session;
}
