// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { canonicalize, sha256, timestamp } from './canonical.ts';
import type { JsonValue } from './canonical.ts';

export interface EvidenceSource { id: string; uri?: string; content?: JsonValue; digest?: string }
export interface EvidenceFact {
  id: string;
  sourceId: string;
  value: JsonValue;
  /** Independent records about the same claim conflict if their values or units disagree. */
  claimId?: string;
  unit?: string;
  observedAt?: string;
  expiresAt?: string;
  dependsOn?: string[];
}
export interface EvidenceBundle { sources: EvidenceSource[]; facts: EvidenceFact[] }
export type FactStatus = 'AVAILABLE' | 'MISSING' | 'EXPIRED' | 'FUTURE' | 'CONFLICT' | 'INVALID';
export interface EvidenceIssue { code: string; severity: 'ERROR' | 'UNAVAILABLE'; factIds: string[]; message: string }
export interface FactState { id: string; status: FactStatus; reasons: string[] }
export interface EvidenceReport {
  asOf: string;
  valid: boolean;
  issues: EvidenceIssue[];
  facts: FactState[];
  lineage: { factId: string; sourceId: string; dependsOn: string[] }[];
  sources: { id: string; contentStatus: 'DIGEST_VERIFIED' | 'DIGEST_MISMATCH' | 'CONTENT_ONLY' | 'REFERENCE_ONLY'; computedDigest?: string }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** Bounds graph work and diagnostic output independently of the JSON byte limit. */
export const EVIDENCE_LIMITS = Object.freeze({ sources: 1000, facts: 1000, dependencies: 10_000 });

class EvidenceLimitError extends TypeError {}
export function requiredId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > 256) throw new TypeError(`${label} must be a nonempty string of at most 256 characters without surrounding whitespace`);
}
export function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unknown ${label} field: ${key}`);
}

function validateBundle(value: unknown): asserts value is EvidenceBundle {
  canonicalize(value);
  if (!isRecord(value)) throw new TypeError('Evidence must be an object');
  exactKeys(value, ['sources', 'facts'], 'evidence');
  if (!Array.isArray(value.sources) || !Array.isArray(value.facts)) throw new TypeError('Evidence requires sources and facts arrays');
  if (value.sources.length > EVIDENCE_LIMITS.sources || value.facts.length > EVIDENCE_LIMITS.facts) {
    throw new EvidenceLimitError('Evidence supports at most 1000 sources and 1000 facts');
  }
  // Inspect all lengths before allocating graph indexes, issue arrays or dependency sets.
  let dependencies = 0;
  for (const fact of value.facts) if (isRecord(fact) && Array.isArray(fact.dependsOn)) {
    dependencies += fact.dependsOn.length;
    if (dependencies > EVIDENCE_LIMITS.dependencies) {
      throw new EvidenceLimitError('Evidence supports at most 10000 total dependency references');
    }
  }
  for (const source of value.sources) {
    if (!isRecord(source)) throw new TypeError('Each source must be an object');
    exactKeys(source, ['id', 'uri', 'content', 'digest'], 'source');
    requiredId(source.id, 'source.id');
    if ('uri' in source && (typeof source.uri !== 'string' || !source.uri.trim())) throw new TypeError('source.uri must be a nonempty string');
    if ('digest' in source && (typeof source.digest !== 'string' || !/^[0-9a-f]{64}$/.test(source.digest))) throw new TypeError('source.digest must be a lowercase SHA-256 hex string');
  }
  for (const fact of value.facts) {
    if (!isRecord(fact)) throw new TypeError('Each fact must be an object');
    exactKeys(fact, ['id', 'sourceId', 'value', 'claimId', 'unit', 'observedAt', 'expiresAt', 'dependsOn'], 'fact');
    requiredId(fact.id, 'fact.id');
    requiredId(fact.sourceId, 'fact.sourceId');
    if (!Object.hasOwn(fact, 'value')) throw new TypeError('fact.value is required');
    if ('claimId' in fact) requiredId(fact.claimId, 'fact.claimId');
    if ('unit' in fact) requiredId(fact.unit, 'fact.unit');
    if ('observedAt' in fact) timestamp(fact.observedAt, 'fact.observedAt');
    if ('expiresAt' in fact) timestamp(fact.expiresAt, 'fact.expiresAt');
    if ('observedAt' in fact && 'expiresAt' in fact && timestamp(fact.expiresAt) <= timestamp(fact.observedAt)) {
      throw new TypeError('fact.expiresAt must follow fact.observedAt');
    }
    if ('dependsOn' in fact) {
      if (!Array.isArray(fact.dependsOn)) throw new TypeError('fact.dependsOn must be an array');
      for (const id of fact.dependsOn) requiredId(id, 'fact.dependsOn entry');
      if (new Set(fact.dependsOn).size !== fact.dependsOn.length) throw new TypeError('fact.dependsOn contains duplicate references');
    }
  }
}

/** Checks declared structure, references, time-based availability and contradictions, not source truth. */
export function inspectEvidence(bundle: EvidenceBundle, asOf: string): EvidenceReport {
  const now = timestamp(asOf, 'asOf');
  const report: EvidenceReport = { asOf, valid: false, issues: [], facts: [], lineage: [], sources: [] };
  try { validateBundle(bundle); }
  catch (error) {
    report.issues.push({ code: error instanceof EvidenceLimitError ? 'EVIDENCE_LIMIT' : 'MALFORMED_EVIDENCE', severity: 'ERROR', factIds: [], message: error instanceof Error ? error.message : 'Malformed evidence' });
    return report;
  }
  const sources = new Map<string, EvidenceSource>();
  const facts = new Map<string, EvidenceFact>();
  const states = new Map<string, FactState>();
  const reasonSets = new Map<string, Set<string>>();
  const sourceFacts = new Map<string, string[]>();
  const invalidSources = new Set<string>();
  const rank: Record<FactStatus, number> = { AVAILABLE: 0, FUTURE: 1, EXPIRED: 2, MISSING: 3, CONFLICT: 4, INVALID: 5 };
  const mark = (id: string, status: FactStatus, reason: string): boolean => {
    const state = states.get(id);
    if (!state) return false;
    const changed = rank[status] > rank[state.status];
    if (changed) state.status = status;
    reasonSets.get(id)!.add(reason);
    return changed;
  };
  const issue = (code: string, severity: EvidenceIssue['severity'], factIds: string[], message: string) => report.issues.push({ code, severity, factIds: [...factIds].sort(), message });
  for (const source of bundle.sources) {
    if (sources.has(source.id)) { invalidSources.add(source.id); issue('DUPLICATE_SOURCE_ID', 'ERROR', [], `Duplicate source id: ${source.id}`); }
    else sources.set(source.id, source);
  }
  for (const fact of bundle.facts) {
    if (facts.has(fact.id)) { mark(fact.id, 'INVALID', 'DUPLICATE_FACT_ID'); issue('DUPLICATE_FACT_ID', 'ERROR', [fact.id], `Duplicate fact id: ${fact.id}`); }
    else {
      facts.set(fact.id, fact); states.set(fact.id, { id: fact.id, status: 'AVAILABLE', reasons: [] });
      reasonSets.set(fact.id, new Set());
      const ids = sourceFacts.get(fact.sourceId) ?? []; ids.push(fact.id); sourceFacts.set(fact.sourceId, ids);
    }
  }
  for (const source of sources.values()) {
    if (Object.hasOwn(source, 'content')) {
      const computedDigest = sha256(source.content);
      const contentStatus = source.digest === undefined ? 'CONTENT_ONLY' : source.digest === computedDigest ? 'DIGEST_VERIFIED' : 'DIGEST_MISMATCH';
      report.sources.push({ id: source.id, contentStatus, computedDigest });
      if (contentStatus === 'DIGEST_MISMATCH') {
        invalidSources.add(source.id);
        issue('SOURCE_DIGEST_MISMATCH', 'ERROR', sourceFacts.get(source.id) ?? [], `Content digest mismatch: ${source.id}`);
      }
    } else report.sources.push({ id: source.id, contentStatus: 'REFERENCE_ONLY' });
  }
  for (const fact of facts.values()) {
    report.lineage.push({ factId: fact.id, sourceId: fact.sourceId, dependsOn: [...(fact.dependsOn ?? [])].sort() });
    if (!sources.has(fact.sourceId)) { mark(fact.id, 'MISSING', 'MISSING_SOURCE'); issue('MISSING_SOURCE', 'UNAVAILABLE', [fact.id], `Missing source: ${fact.sourceId}`); }
    if (invalidSources.has(fact.sourceId)) mark(fact.id, 'INVALID', 'INVALID_SOURCE');
    if (fact.observedAt !== undefined && timestamp(fact.observedAt) > now) { mark(fact.id, 'FUTURE', 'FUTURE_OBSERVATION'); issue('FUTURE_OBSERVATION', 'UNAVAILABLE', [fact.id], 'Observation occurs after asOf'); }
    if (fact.expiresAt !== undefined && timestamp(fact.expiresAt) <= now) { mark(fact.id, 'EXPIRED', 'EXPIRED_EVIDENCE'); issue('EXPIRED_EVIDENCE', 'UNAVAILABLE', [fact.id], 'Evidence expires at or before asOf'); }
    for (const dependency of fact.dependsOn ?? []) if (!facts.has(dependency)) { mark(fact.id, 'MISSING', `MISSING_DEPENDENCY:${dependency}`); issue('MISSING_DEPENDENCY', 'UNAVAILABLE', [fact.id], `Missing dependency: ${dependency}`); }
  }
  // Iterative Kosaraju passes identify strongly connected components in O(V + E).
  // Emit one bounded diagnostic per cyclic component, never one per overlapping path.
  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const id of facts.keys()) { dependencies.set(id, []); dependents.set(id, []); }
  for (const fact of facts.values()) for (const dependency of fact.dependsOn ?? []) if (facts.has(dependency)) {
    dependencies.get(fact.id)!.push(dependency);
    dependents.get(dependency)!.push(fact.id);
  }
  const visited = new Set<string>();
  const finished: string[] = [];
  for (const id of facts.keys()) {
    if (visited.has(id)) continue;
    visited.add(id);
    const stack = [{ id, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edges = dependencies.get(frame.id)!;
      if (frame.next === edges.length) { finished.push(frame.id); stack.pop(); continue; }
      const child = edges[frame.next++];
      if (!visited.has(child)) { visited.add(child); stack.push({ id: child, next: 0 }); }
    }
  }
  visited.clear();
  for (let index = finished.length - 1; index >= 0; index--) {
    const id = finished[index];
    if (visited.has(id)) continue;
    visited.add(id);
    const members: string[] = [];
    const stack = [id];
    while (stack.length) {
      const member = stack.pop()!; members.push(member);
      for (const parent of dependents.get(member)!) if (!visited.has(parent)) { visited.add(parent); stack.push(parent); }
    }
    if (members.length > 1 || dependencies.get(id)!.includes(id)) {
      issue('DEPENDENCY_CYCLE', 'ERROR', members, 'Evidence dependencies contain a cycle');
      for (const member of members) mark(member, 'INVALID', 'DEPENDENCY_CYCLE');
    }
  }
  const claims = new Map<string, EvidenceFact[]>();
  for (const fact of facts.values()) if (fact.claimId && states.get(fact.id)!.status === 'AVAILABLE') {
    const group = claims.get(fact.claimId) ?? []; group.push(fact); claims.set(fact.claimId, group);
  }
  for (const [claimId, group] of claims) {
    const values = new Set(group.map((fact) => canonicalize({ value: fact.value, unit: fact.unit ?? null })));
    if (values.size > 1) {
      const ids = group.map((fact) => fact.id);
      issue('CONFLICTING_CLAIM', 'UNAVAILABLE', ids, `Conflicting declared values or units for claim: ${claimId}`);
      for (const id of ids) mark(id, 'CONFLICT', 'CONFLICTING_CLAIM');
    }
  }
  // Each fact's status increases at most five times. Revisit only affected edges;
  // a diagnostic reason is recorded once per edge, even in a dense cyclic graph.
  const pending = [...states.values()].filter((state) => state.status !== 'AVAILABLE').map((state) => state.id);
  const queued = new Set(pending);
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const dependency = pending[cursor]; queued.delete(dependency);
    const status = states.get(dependency)!.status;
    for (const dependent of dependents.get(dependency)!) {
      if (mark(dependent, status, `DEPENDENCY_UNAVAILABLE:${dependency}`) && !queued.has(dependent)) {
        pending.push(dependent); queued.add(dependent);
      }
    }
  }
  report.valid = !report.issues.some((item) => item.severity === 'ERROR');
  report.facts = [...states.values()].map((state) => ({ ...state, reasons: [...reasonSets.get(state.id)!].sort() })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  report.lineage.sort((a, b) => a.factId < b.factId ? -1 : a.factId > b.factId ? 1 : 0);
  report.sources.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return report;
}
