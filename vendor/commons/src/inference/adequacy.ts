// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.
import { canonicalJSON, DiscoverySession, hashJSON, validateDiscoveryIdentifier as identifier } from './session.ts';
import { currentReplayRuntime, ReplayRuntimeError } from './runtime.ts';
import type { DiscoveryConfig, Experiment, ReplayRuntime } from './types.ts';

export const ADEQUACY_SCHEMA_VERSION = 2 as const;
export const ADEQUACY_IMPLEMENTATION = '@cosmic/commons-adequacy/0.2.2' as const;
export const ADEQUACY_NORMALIZATION_POLICY = 'normalize-row-preserve-smaller-tail-binary64-v1' as const;
export const ADEQUACY_SUPPORT_POLICY = 'strictly-positive-declared-prior-frozen-at-construction-v1' as const;
export type AdequacyRuntime = Omit<ReplayRuntime, 'implementation'> & {
  implementation: typeof ADEQUACY_IMPLEMENTATION;
};
export interface FamilyAdequacyOptions { alpha: number; epochId: string }
export type AdequacyStatus = 'NOT_REJECTED' | 'REJECTED_DECLARED_FAMILY' | 'ZERO_SUPPORT_CONTRADICTION';
/** Exact Bernoulli interpretation: P(tailOutcome)=tailProbability and the other
 * probability is its mathematical complement. The displayed complement may round
 * to one; log1p(-tailProbability) preserves its log contribution. */
export interface EffectiveBernoulliLaw {
  tailOutcome: string;
  tailProbability: number;
  complementOutcome: string;
}

interface AdequacyIdentity {
  schemaVersion: typeof ADEQUACY_SCHEMA_VERSION;
  runtime: AdequacyRuntime;
  epochId: string;
  definitionHash: string;
  optionsHash: string;
  chainAnchorHash: string;
  alpha: number;
  supportPolicy: typeof ADEQUACY_SUPPORT_POLICY;
  /** The frozen null family, selected once from the original declaration. */
  nullHypothesisIds: string[];
  /** Zero prior excludes a law from both inference and this adequacy guarantee. */
  excludedZeroPriorHypothesisIds: string[];
  normalizationPolicy: typeof ADEQUACY_NORMALIZATION_POLICY;
  effectiveLawHash: string;
}
export interface PreparedAdequacyObservation extends AdequacyIdentity {
  id: string;
  experimentId: string;
  sequence: number;
  outcomes: [string, string];
  nullProbabilities: Record<string, Record<string, number>>;
  /** Effective log probabilities; null means an exact zero, never underflow. */
  nullLogProbabilities: Record<string, Record<string, number | null>>;
  alternativeProbabilities: Record<string, number>;
  previousHash: string;
  hash: string;
}
interface AdequacyStatistics {
  status: AdequacyStatus;
  /** null represents positive infinity only when eValueState says zero support. */
  logEValue: number | null;
  eValueState: 'finite' | 'infinite-zero-support';
  /** Includes E_0 = 1. This historical maximum is not itself an e-process. */
  maxLogEValue: number | null;
  firstCrossingSequence: number | null;
  /** null is negative infinity: that candidate assigns zero probability to the path. */
  nullLogLikelihoods: Record<string, number | null>;
  impossibleHypothesisIds: string[];
  alternativeLogLikelihood: number;
}
export interface AdequacyReceipt extends AdequacyIdentity, AdequacyStatistics {
  id: string;
  experimentId: string;
  outcome: string;
  sequence: number;
  prepared: PreparedAdequacyObservation;
  previousHash: string;
  hash: string;
}
export interface FamilyAdequacySnapshot extends AdequacyIdentity, AdequacyStatistics {
  modelId: string;
  nullSemantics: 'frozen-positive-prior-conditional-bernoulli-laws';
  notRejectedSemantics: 'insufficient-evidence-against-declared-laws-not-approval';
  budgetSemantics: 'external-discovery-session-only';
  alternative: 'per-experiment-beta-half-prequential';
  observationCount: number;
  effectiveNullLaws: Record<string, Record<string, EffectiveBernoulliLaw>>;
  counts: Record<string, Record<string, number>>;
  pending: PreparedAdequacyObservation | null;
  receipts: AdequacyReceipt[];
}

export function currentAdequacyRuntime(): AdequacyRuntime {
  return { ...currentReplayRuntime(), implementation: ADEQUACY_IMPLEMENTATION };
}
function assertAdequacyRuntime(recorded: AdequacyRuntime | undefined): void {
  const current = currentAdequacyRuntime();
  const keys = Object.keys(current) as Array<keyof AdequacyRuntime>;
  if (!recorded || keys.some(key => typeof recorded[key] !== 'string' || !recorded[key])) {
    throw new ReplayRuntimeError('MISSING_REPLAY_RUNTIME', 'Adequacy replay requires a complete recorded runtime');
  }
  if (keys.some(key => recorded[key] !== current[key])) {
    throw new ReplayRuntimeError('REPLAY_RUNTIME_MISMATCH', 'Adequacy replay runtime or implementation mismatch');
  }
}
/** Validate requested monitoring options even when the experiment family is
 * outside the Bernoulli monitor's supported scope. */
export function validateFamilyAdequacyOptions(options: FamilyAdequacyOptions): void {
  if (!options || !Number.isFinite(options.alpha) || options.alpha <= 0 || options.alpha >= 1) {
    throw new Error('alpha must be finite and strictly between zero and one');
  }
  identifier(options.epochId, 'epochId');
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Adequacy numeric range exceeded; no observation was committed');
  return value;
}

/**
 * Monitors only the declared, frozen, fully specified conditional Bernoulli laws
 * whose original priors are strictly positive. Zero prior excludes a hypothesis
 * from inference and from this null family; it cannot shield the active family
 * from rejection. Positive prior magnitudes do not weight the null likelihoods.
 * The support is fixed at construction, never refitted to a posterior or outcome.
 * Approximate input rows (legacy tolerance 1e-12) are explicitly transformed into
 * effective normalized laws: normalize the smaller tail, use its exact complement.
 * Raw definition and effective-law digests are both retained. The null guarantee
 * concerns the effective laws; their probabilities can differ from raw inputs at
 * rounding scale. Tiny positive tails are never silently clipped to zero.
 * E_t = Q_t / max_h L_h,t, with Q learned strictly from previous observations.
 * Under any admitted positive-prior true conditional law, threshold crossing has probability at
 * most alpha (in exact arithmetic). Native binary64 calculations are not a formal
 * numerical proof. NOT_REJECTED does not validate a law or authorize an action.
 *
 * Experiment choice may adapt to past observations. Candidate discovery, refitting,
 * batch observations, parameter-family rejection, and automatic resets are absent.
 * The originating DiscoverySession owns budget enforcement; this monitor spends
 * no budget and does not change the old session or its v2 evidence format.
 */
export class FamilyAdequacyMonitor {
  private readonly definition: DiscoveryConfig;
  private readonly options: FamilyAdequacyOptions;
  private readonly identity: AdequacyIdentity;
  private readonly ids: string[];
  private readonly experiments: Map<string, Experiment>;
  private readonly countState: Map<string, [number, number]>;
  private readonly effectiveNullLaws: Record<string, Record<string, EffectiveBernoulliLaw>>;
  private readonly evidenceIds = new Set<string>();
  private readonly receipts: AdequacyReceipt[] = [];
  private pending: PreparedAdequacyObservation | null = null;
  private logs: number[];
  private alternativeLog = 0;
  private logE = 0;
  private maxLogE = 0;
  private firstCrossing: number | null = null;

  constructor(definition: DiscoveryConfig, options: FamilyAdequacyOptions) {
    validateFamilyAdequacyOptions(options);
    // Reuse public validation and a defensive copy, never its posterior weights.
    this.definition = new DiscoverySession(definition).exportDefinition();
    this.ids = this.definition.hypotheses.filter(h => h.prior > 0).map(h => h.id);
    const excludedZeroPriorHypothesisIds = this.definition.hypotheses.filter(h => h.prior === 0).map(h => h.id);
    const effectiveEntries: Array<[string, Record<string, EffectiveBernoulliLaw>]> = [];
    for (const experiment of this.definition.experiments) {
      if (experiment.outcomes.length !== 2) throw new Error('Adequacy v2 requires exactly two outcome labels per experiment');
      const rows = this.ids.map((id): [string, EffectiveBernoulliLaw] => {
        const row = experiment.likelihoods[id];
        const [left, right] = experiment.outcomes;
        const total = row[left] + row[right]; // Legacy validation already bounds |total-1| <= 1e-12.
        const tailOutcome = row[left] <= row[right] ? left : right;
        const complementOutcome = tailOutcome === left ? right : left;
        const tailProbability = row[tailOutcome] / total;
        if (!Number.isFinite(tailProbability) || tailProbability < 0 || tailProbability > 0.5 ||
            (row[tailOutcome] > 0 && tailProbability === 0)) {
          throw new Error('Normalized Bernoulli tail is not representable');
        }
        return [id, { tailOutcome, tailProbability, complementOutcome }];
      });
      effectiveEntries.push([experiment.id, Object.fromEntries(rows)]);
    }
    this.effectiveNullLaws = Object.fromEntries(effectiveEntries);
    this.options = { alpha: options.alpha, epochId: options.epochId };
    this.logs = this.ids.map(() => 0);
    this.experiments = new Map(this.definition.experiments.map(e => [e.id, e]));
    this.countState = new Map(this.definition.experiments.map(e => [e.id, [0, 0]]));
    const normalizationPolicy = ADEQUACY_NORMALIZATION_POLICY;
    const anchor = { schemaVersion: ADEQUACY_SCHEMA_VERSION, runtime: currentAdequacyRuntime(),
      definitionHash: hashJSON(this.definition), optionsHash: hashJSON(this.options), ...this.options,
      supportPolicy: ADEQUACY_SUPPORT_POLICY, nullHypothesisIds: [...this.ids], excludedZeroPriorHypothesisIds,
      normalizationPolicy, effectiveLawHash: hashJSON({ normalizationPolicy, laws: this.effectiveNullLaws }) };
    this.identity = { ...anchor, chainAnchorHash: hashJSON(anchor) };
  }

  private statistics(): AdequacyStatistics {
    const impossible = this.logs.every(value => value === -Infinity);
    return {
      status: impossible ? 'ZERO_SUPPORT_CONTRADICTION' : this.firstCrossing === null ? 'NOT_REJECTED' : 'REJECTED_DECLARED_FAMILY',
      logEValue: impossible ? null : this.logE,
      eValueState: impossible ? 'infinite-zero-support' : 'finite',
      maxLogEValue: this.maxLogE === Infinity ? null : this.maxLogE,
      firstCrossingSequence: this.firstCrossing,
      nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, this.logs[i] === -Infinity ? null : this.logs[i]])),
      impossibleHypothesisIds: this.ids.filter((_, i) => this.logs[i] === -Infinity),
      alternativeLogLikelihood: this.alternativeLog,
    };
  }

  prepare(observationId: string, experimentId: string): PreparedAdequacyObservation {
    identifier(observationId, 'observation id');
    identifier(experimentId, 'experiment id');
    if (this.pending) throw new Error('A prepared observation is pending; commit it before preparing another');
    if (this.logs.every(value => value === -Infinity)) throw new Error('Monitor stopped after zero support contradiction');
    if (this.evidenceIds.has(observationId)) throw new Error('Duplicate observation id: evidence cannot be counted twice');
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error('Unknown experiment');
    const counts = this.countState.get(experimentId)!;
    const total = counts[0] + counts[1];
    // Keep half-counts and the next count exactly representable, and q interior.
    if (total >= 2 ** 50 || !Number.isSafeInteger(this.receipts.length + 1)) throw new Error('Adequacy observation count limit reached');
    const q0 = (counts[0] + 0.5) / (total + 1);
    const q1 = (counts[1] + 0.5) / (total + 1);
    if (!(q0 > 0 && q0 < 1 && q1 > 0 && q1 < 1)) throw new Error('Alternative probabilities are not representable');
    const laws = this.effectiveNullLaws[experimentId];
    const nullProbabilities = Object.fromEntries(this.ids.map(id => {
      const law = laws[id];
      return [id, Object.fromEntries([[law.tailOutcome, law.tailProbability], [law.complementOutcome, 1 - law.tailProbability]])];
    }));
    const nullLogProbabilities = Object.fromEntries(this.ids.map(id => {
      const law = laws[id];
      return [id, Object.fromEntries([[law.tailOutcome, law.tailProbability === 0 ? null : Math.log(law.tailProbability)],
        [law.complementOutcome, law.tailProbability === 0 ? 0 : Math.log1p(-law.tailProbability)]])];
    }));
    const body = { ...structuredClone(this.identity), id: observationId, experimentId,
      sequence: this.receipts.length + 1, outcomes: [...experiment.outcomes] as [string, string],
      nullProbabilities, nullLogProbabilities,
      alternativeProbabilities: Object.fromEntries([[experiment.outcomes[0], q0], [experiment.outcomes[1], q1]]),
      previousHash: this.receipts.at(-1)?.hash ?? this.identity.chainAnchorHash };
    const prepared: PreparedAdequacyObservation = { ...body, hash: hashJSON(body) };
    this.pending = prepared;
    return freezeDeep(structuredClone(prepared));
  }

  observe(token: PreparedAdequacyObservation, outcome: string): AdequacyReceipt {
    if (!this.pending) throw new Error('No prepared observation is pending');
    if (canonicalJSON(token) !== canonicalJSON(this.pending)) throw new Error('Prepared token verification failed');
    const prepared = this.pending;
    const index = prepared.outcomes.indexOf(outcome);
    if (index < 0) throw new Error('Outcome is outside the declared binary observation alphabet');
    const nextLogs = this.logs.map((value, i) => {
      const logProbability = prepared.nullLogProbabilities[this.ids[i]][outcome];
      return value === -Infinity || logProbability === null ? -Infinity : finite(value + logProbability);
    });
    const alternativeLog = finite(this.alternativeLog + Math.log(prepared.alternativeProbabilities[outcome]));
    const peak = nextLogs.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
    const logE = peak === -Infinity ? Infinity : finite(alternativeLog - peak);
    const firstCrossing = this.firstCrossing ?? (logE >= -Math.log(this.options.alpha) ? prepared.sequence : null);
    const maxLogE = Math.max(this.maxLogE, logE);
    const statistics: AdequacyStatistics = {
      status: peak === -Infinity ? 'ZERO_SUPPORT_CONTRADICTION' : firstCrossing === null ? 'NOT_REJECTED' : 'REJECTED_DECLARED_FAMILY',
      logEValue: logE === Infinity ? null : logE,
      eValueState: peak === -Infinity ? 'infinite-zero-support' : 'finite',
      maxLogEValue: maxLogE === Infinity ? null : maxLogE,
      firstCrossingSequence: firstCrossing,
      nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, nextLogs[i] === -Infinity ? null : nextLogs[i]])),
      impossibleHypothesisIds: this.ids.filter((_, i) => nextLogs[i] === -Infinity),
      alternativeLogLikelihood: alternativeLog,
    };
    const body = { ...structuredClone(this.identity), ...statistics, id: prepared.id,
      experimentId: prepared.experimentId, outcome, sequence: prepared.sequence,
      prepared: structuredClone(prepared), previousHash: prepared.previousHash };
    const receipt: AdequacyReceipt = { ...body, hash: hashJSON(body) };
    // All validation, numeric work, cloning and hashing precede state mutation.
    const result = structuredClone(receipt);
    this.logs = nextLogs;
    this.alternativeLog = alternativeLog;
    this.logE = logE;
    this.maxLogE = maxLogE;
    this.firstCrossing = firstCrossing;
    this.countState.get(prepared.experimentId)![index]++;
    this.evidenceIds.add(prepared.id);
    this.receipts.push(receipt);
    this.pending = null;
    return result;
  }

  snapshot(): FamilyAdequacySnapshot {
    return { ...structuredClone(this.identity), ...this.statistics(), modelId: this.definition.modelId,
      nullSemantics: 'frozen-positive-prior-conditional-bernoulli-laws',
      notRejectedSemantics: 'insufficient-evidence-against-declared-laws-not-approval',
      budgetSemantics: 'external-discovery-session-only', alternative: 'per-experiment-beta-half-prequential',
      observationCount: this.receipts.length,
      effectiveNullLaws: structuredClone(this.effectiveNullLaws),
      counts: Object.fromEntries([...this.experiments].map(([id, experiment]) => [id,
        Object.fromEntries(experiment.outcomes.map((label, i) => [label, this.countState.get(id)![i]]))])),
      pending: this.pending === null ? null : structuredClone(this.pending), receipts: structuredClone(this.receipts) };
  }
  exportDefinition(): DiscoveryConfig { return structuredClone(this.definition); }
  exportOptions(): FamilyAdequacyOptions { return { ...this.options }; }
}

/** Recompute every prediction and body; hash consistency alone is insufficient.
 * A recorded runtime is mandatory for an empty committed prefix. A pending prepare
 * is not an observation receipt and is not restored by this helper. */
export function replayFamilyAdequacy(definition: DiscoveryConfig, options: FamilyAdequacyOptions,
  receipts: AdequacyReceipt[], recordedRuntime?: AdequacyRuntime): FamilyAdequacyMonitor {
  if (!Array.isArray(receipts)) throw new Error('Receipts must be an array');
  if (recordedRuntime !== undefined || receipts.length === 0) assertAdequacyRuntime(recordedRuntime);
  for (const receipt of receipts) {
    if (receipt?.schemaVersion !== ADEQUACY_SCHEMA_VERSION) throw new Error('Adequacy receipt schema mismatch');
    assertAdequacyRuntime(receipt.runtime);
  }
  const monitor = new FamilyAdequacyMonitor(definition, options);
  for (const receipt of receipts) {
    const prepared = monitor.prepare(receipt.id, receipt.experimentId);
    const actual = monitor.observe(prepared, receipt.outcome);
    if (canonicalJSON(actual) !== canonicalJSON(receipt)) throw new Error(`Adequacy receipt verification failed at sequence ${receipt.sequence}`);
  }
  return monitor;
}
