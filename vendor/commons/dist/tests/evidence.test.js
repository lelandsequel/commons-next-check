// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, sha256, timestamp } from "../src/canonical.js";
import { EVIDENCE_LIMITS, inspectEvidence } from "../src/evidence.js";
const asOf = '2026-09-29T00:00:00Z';
const bundle = () => ({ sources: [{ id: 'source', content: { reading: 42 }, digest: sha256({ reading: 42 }) }], facts: [{ id: 'reading', sourceId: 'source', value: 42 }] });
test('canonical hashes ignore object key insertion order and preserve array order', () => {
    assert.equal(canonicalize({ z: 1, a: [true, null, 'x'] }), '{"a":[true,null,"x"],"z":1}');
    assert.equal(sha256({ z: 1, a: 2 }), sha256({ a: 2, z: 1 }));
    assert.notEqual(sha256([1, 2]), sha256([2, 1]));
    assert.notEqual(sha256('1'), sha256(1));
});
test('strict canonicalizer rejects lossy, executable or non-JSON inputs', () => {
    const cycle = [];
    cycle.push(cycle);
    let called = false;
    const getter = Object.defineProperty({}, 'secret', { enumerable: true, get() { called = true; return 2; } });
    for (const value of [undefined, NaN, Infinity, -0, 1n, new Date(), new Map(), [1, undefined], Array(2), cycle, getter, '\ud800']) {
        assert.throws(() => canonicalize(value));
    }
    assert.equal(called, false);
    const symbol = { [Symbol('s')]: 1 };
    assert.throws(() => canonicalize(symbol));
    const nonEnumerable = Object.defineProperty({}, 'hidden', { value: 1 });
    assert.throws(() => canonicalize(nonEnumerable));
});
test('calendar validation is explicit and rejects invalid UTC dates', () => {
    assert.equal(timestamp(asOf), Date.parse(asOf));
    assert.throws(() => timestamp('2026-02-30T00:00:00Z'));
    assert.throws(() => timestamp('2026-09-29'));
    assert.throws(() => timestamp('2026-09-29T00:00:00-05:00'));
});
test('source digest verification checks the supplied content bytes through canonical JSON', () => {
    const good = inspectEvidence(bundle(), asOf);
    assert.equal(good.valid, true);
    assert.equal(good.sources[0].contentStatus, 'DIGEST_VERIFIED');
    const tampered = bundle();
    tampered.sources[0].content = { reading: 43 };
    const bad = inspectEvidence(tampered, asOf);
    assert.equal(bad.valid, false);
    assert.equal(bad.facts[0].status, 'INVALID');
    assert.ok(bad.issues.some((issue) => issue.code === 'SOURCE_DIGEST_MISMATCH'));
});
test('reference-only provenance is reported honestly without claiming content verification', () => {
    const value = bundle();
    delete value.sources[0].content;
    assert.equal(inspectEvidence(value, asOf).sources[0].contentStatus, 'REFERENCE_ONLY');
});
test('duplicate references, absent dependencies and cycles have different failure codes', () => {
    const duplicate = bundle();
    duplicate.facts.push({ ...duplicate.facts[0] });
    assert.equal(inspectEvidence(duplicate, asOf).issues[0].code, 'DUPLICATE_FACT_ID');
    const missing = bundle();
    missing.facts[0].dependsOn = ['absent'];
    const missingReport = inspectEvidence(missing, asOf);
    assert.equal(missingReport.valid, true);
    assert.equal(missingReport.facts[0].status, 'MISSING');
    assert.equal(missingReport.issues[0].code, 'MISSING_DEPENDENCY');
    const cyclic = bundle();
    cyclic.facts[0].dependsOn = ['derived'];
    cyclic.facts.push({ id: 'derived', sourceId: 'source', value: 1, dependsOn: ['reading'] });
    const cycleReport = inspectEvidence(cyclic, asOf);
    assert.equal(cycleReport.valid, false);
    assert.ok(cycleReport.facts.every((fact) => fact.status === 'INVALID'));
    assert.equal(cycleReport.issues[0].code, 'DEPENDENCY_CYCLE');
});
test('availability propagates through lineage and expires exactly at the declared boundary', () => {
    const value = bundle();
    value.facts[0].expiresAt = asOf;
    value.facts.push({ id: 'derived', sourceId: 'source', value: 84, dependsOn: ['reading'] });
    const result = inspectEvidence(value, asOf);
    assert.equal(result.valid, true);
    assert.ok(result.facts.every((fact) => fact.status === 'EXPIRED'));
    assert.ok(result.facts.find((fact) => fact.id === 'derived').reasons.includes('DEPENDENCY_UNAVAILABLE:reading'));
});
test('conflicting live claim records are distinct from malformed duplicate IDs', () => {
    const value = bundle();
    value.facts[0].claimId = 'temperature';
    value.facts.push({ id: 'other-reading', sourceId: 'source', value: 39, claimId: 'temperature' });
    const result = inspectEvidence(value, asOf);
    assert.equal(result.valid, true);
    assert.ok(result.facts.every((fact) => fact.status === 'CONFLICT'));
    assert.equal(result.issues[0].code, 'CONFLICTING_CLAIM');
    value.facts[1].expiresAt = asOf;
    assert.equal(inspectEvidence(value, asOf).facts.find((fact) => fact.id === 'reading').status, 'AVAILABLE');
});
test('future records and dangling sources cannot become available facts', () => {
    const value = bundle();
    value.facts[0].observedAt = '2026-09-30T00:00:00Z';
    assert.equal(inspectEvidence(value, asOf).facts[0].status, 'FUTURE');
    delete value.facts[0].observedAt;
    value.facts[0].sourceId = 'missing';
    assert.equal(inspectEvidence(value, asOf).facts[0].status, 'MISSING');
});
test('dense cycles produce one component diagnostic and bounded per-edge reasons', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `fact-${i}`);
    const value = { sources: [{ id: 'source' }], facts: ids.map((id) => ({ id, sourceId: 'source', value: true, dependsOn: ids })) };
    assert.equal(ids.length ** 2, EVIDENCE_LIMITS.dependencies);
    const result = inspectEvidence(value, asOf);
    assert.equal(result.valid, false);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].code, 'DEPENDENCY_CYCLE');
    assert.equal(result.issues[0].factIds.length, ids.length);
    assert.ok(result.facts.every((fact) => fact.status === 'INVALID' && fact.reasons.length === ids.length + 1));
});
test('graph limits refuse before building graph diagnostics, including missing edges', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `fact-${i}`);
    const value = { sources: [{ id: 'source' }], facts: ids.map((id) => ({ id, sourceId: 'source', value: true, dependsOn: ids })) };
    const result = inspectEvidence(value, asOf);
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues.map((issue) => issue.code), ['EVIDENCE_LIMIT']);
    assert.deepEqual(result.facts, []);
    assert.deepEqual(result.lineage, []);
    assert.deepEqual(result.sources, []);
    value.facts = [{ id: 'only', sourceId: 'source', value: true, dependsOn: Array.from({ length: EVIDENCE_LIMITS.dependencies + 1 }, (_, i) => `missing-${i}`) }];
    assert.equal(inspectEvidence(value, asOf).issues[0].code, 'EVIDENCE_LIMIT');
    value.facts = Array.from({ length: EVIDENCE_LIMITS.facts + 1 }, (_, i) => ({ id: `fact-${i}`, sourceId: 'source', value: true }));
    assert.equal(inspectEvidence(value, asOf).issues[0].code, 'EVIDENCE_LIMIT');
});
test('a thousand-fact reverse-ordered chain propagates the strongest unavailable status', () => {
    const value = { sources: [{ id: 'source' }], facts: Array.from({ length: 1000 }, (_, i) => ({
            id: `fact-${i}`, sourceId: 'source', value: true,
            ...(i < 999 ? { dependsOn: [`fact-${i + 1}`] } : { expiresAt: asOf }),
        })) };
    const result = inspectEvidence(value, asOf);
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 1);
    assert.ok(result.facts.every((fact) => fact.status === 'EXPIRED'));
    assert.deepEqual(result.facts.find((fact) => fact.id === 'fact-0').reasons, ['DEPENDENCY_UNAVAILABLE:fact-1']);
});
test('cycle components exclude downstream facts, which become invalid through lineage', () => {
    const value = { sources: [{ id: 'source' }], facts: [
            { id: 'a', sourceId: 'source', value: true, dependsOn: ['b'] },
            { id: 'b', sourceId: 'source', value: true, dependsOn: ['a'] },
            { id: 'self', sourceId: 'source', value: true, dependsOn: ['self'] },
            { id: 'downstream', sourceId: 'source', value: true, dependsOn: ['a', 'self'] },
            { id: 'independent', sourceId: 'source', value: true },
        ] };
    const result = inspectEvidence(value, asOf);
    assert.deepEqual(result.issues.filter((issue) => issue.code === 'DEPENDENCY_CYCLE').map((issue) => issue.factIds).sort(), [['a', 'b'], ['self']]);
    const downstream = result.facts.find((fact) => fact.id === 'downstream');
    assert.equal(downstream.status, 'INVALID');
    assert.deepEqual(downstream.reasons, ['DEPENDENCY_UNAVAILABLE:a', 'DEPENDENCY_UNAVAILABLE:self']);
    assert.equal(result.facts.find((fact) => fact.id === 'independent').status, 'AVAILABLE');
});
test('bounded graph traversal agrees with an independent reachability oracle', () => {
    let seed = 20261002;
    const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let trial = 0; trial < 64; trial++) {
        const size = 12;
        const edges = Array.from({ length: size }, () => Array.from({ length: size }, () => next() % 13 === 0));
        const reaches = edges.map((row) => [...row]);
        for (let k = 0; k < size; k++)
            for (let i = 0; i < size; i++)
                for (let j = 0; j < size; j++) {
                    reaches[i][j] ||= reaches[i][k] && reaches[k][j];
                }
        const value = { sources: [{ id: 'source' }], facts: edges.map((row, i) => ({
                id: String(i), sourceId: 'source', value: true,
                dependsOn: row.flatMap((present, j) => present ? [String(j)] : []),
                ...(i === 0 ? { expiresAt: asOf } : {}),
            })) };
        const result = inspectEvidence(value, asOf);
        for (let i = 0; i < size; i++) {
            const invalid = reaches[i].some((reachable, j) => reachable && reaches[j][j]);
            const expected = invalid ? 'INVALID' : i === 0 || reaches[i][0] ? 'EXPIRED' : 'AVAILABLE';
            assert.equal(result.facts.find((fact) => fact.id === String(i)).status, expected, `trial ${trial}, fact ${i}`);
        }
        const cycleMembers = result.issues.filter((issue) => issue.code === 'DEPENDENCY_CYCLE').flatMap((issue) => issue.factIds);
        assert.equal(cycleMembers.length, new Set(cycleMembers).size);
        assert.deepEqual(cycleMembers.sort(), reaches.flatMap((row, i) => row[i] ? [String(i)] : []).sort());
    }
});
test('claim conflicts use individual availability before dependency propagation', () => {
    const value = { sources: [{ id: 'source' }], facts: [
            { id: 'expired', sourceId: 'source', value: 0, expiresAt: asOf },
            { id: 'current', sourceId: 'source', value: 1, claimId: 'claim' },
            { id: 'derived', sourceId: 'source', value: 2, claimId: 'claim', dependsOn: ['expired'] },
            { id: 'old-claim', sourceId: 'source', value: 3, claimId: 'claim', expiresAt: asOf },
        ] };
    const result = inspectEvidence(value, asOf);
    assert.deepEqual(result.issues.find((issue) => issue.code === 'CONFLICTING_CLAIM').factIds, ['current', 'derived']);
    assert.equal(result.facts.find((fact) => fact.id === 'old-claim').status, 'EXPIRED');
});
