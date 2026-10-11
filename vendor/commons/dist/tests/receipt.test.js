// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceipt, verifyReceipt, verifyReceiptText, captureEnvironment } from "../src/receipt.js";
import { sha256 } from "../src/canonical.js";
import { runRequest, verifyRun, verifyRunText } from "../src/run.js";
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, linkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packagePath } from "../src/package-root.js";
function invokeCli(args) {
    const result = spawnSync(process.execPath, [packagePath('bin', 'cosmic.mjs'), ...args], { encoding: 'utf8' });
    assert.ifError(result.error);
    return result;
}
const input = () => ({
    policy: { id: 'test', version: '1', rules: [{ id: 'threshold', factId: 'score', op: 'gte', value: 80 }] },
    evidence: { sources: [{ id: 's' }], facts: [{ id: 'score', sourceId: 's', value: 85 }] },
    asOf: '2026-09-29T00:00:00Z', environment: captureEnvironment(),
});
test('receipt bytes repeat, and creation snapshots mutable caller inputs', () => {
    const value = input();
    const first = createReceipt(value);
    const second = createReceipt(value);
    assert.deepEqual(first, second);
    value.evidence.facts[0].value = 1;
    assert.equal(first.payload.input.evidence.facts[0].value, 85);
});
test('verification recomputes a report and labels absent external anchor', () => {
    const receipt = createReceipt(input());
    const report = verifyReceipt(receipt);
    assert.equal(report.valid, true);
    assert.equal(report.integrityValid, true);
    assert.equal(report.replayValid, true);
    assert.equal(report.anchoring, 'UNANCHORED');
    assert.equal(report.authenticity, 'NOT_ESTABLISHED');
    assert.ok(report.issues.includes('UNANCHORED_SELF_CONSISTENCY_ONLY'));
});
test('byte tampering fails integrity and recomputed dishonest reports fail replay', () => {
    const receipt = createReceipt(input());
    const originalDigest = receipt.digest;
    receipt.payload.report.verdict = 'DENY';
    const tampered = verifyReceipt(receipt);
    assert.equal(tampered.integrityValid, false);
    assert.equal(tampered.replayValid, false);
    assert.equal(tampered.valid, false);
    assert.equal(verifyReceipt(receipt, { trustedDigest: originalDigest }).anchoring, 'MISMATCH');
    receipt.digest = sha256(receipt.payload);
    const resealed = verifyReceipt(receipt);
    assert.equal(resealed.integrityValid, true);
    assert.equal(resealed.replayValid, false);
    assert.equal(resealed.valid, false);
});
test('rewriting input and output together requires a trusted anchor to detect substitution', () => {
    const original = createReceipt(input());
    const externalDigest = original.digest;
    const alteredInput = input();
    alteredInput.evidence.facts[0].value = 1;
    const altered = createReceipt(alteredInput);
    assert.equal(verifyReceipt(altered).valid, true);
    const anchored = verifyReceipt(altered, { trustedDigest: externalDigest });
    assert.equal(anchored.valid, false);
    assert.equal(anchored.anchoring, 'MISMATCH');
    const correct = verifyReceipt(original, { trustedDigest: externalDigest });
    assert.equal(correct.valid, true);
    assert.equal(correct.anchoring, 'ANCHORED');
});
test('environment and asOf are bound, with an additional expected environment constraint', () => {
    const receipt = createReceipt(input());
    const expected = { ...receipt.payload.input.environment, runtime: 'node/999.0.0' };
    const check = verifyReceipt(receipt, { expectedEnvironment: expected });
    assert.equal(check.valid, false);
    assert.equal(check.environmentMatches, false);
    receipt.payload.input.asOf = '2026-09-30T00:00:00Z';
    assert.equal(verifyReceipt(receipt).integrityValid, false);
});
test('unsupported caller-declared environments never count as exact policy replay', () => {
    for (const field of ['runtime', 'implementation', 'platform', 'arch']) {
        const declared = input();
        declared.environment[field] = 'unsupported';
        const receipt = createReceipt(declared);
        for (const options of [{}, { expectedEnvironment: declared.environment }]) {
            const checked = verifyReceipt(receipt, options);
            assert.equal(checked.integrity, 'VALID');
            assert.equal(checked.environmentMatches, false, field);
            assert.equal(checked.replay, 'UNSUPPORTED', field);
            assert.equal(checked.replayValid, false, field);
            assert.equal(checked.valid, false, field);
            assert.equal(checked.replayedReport, undefined);
            assert.ok(checked.issues.includes('UNSUPPORTED_ENVIRONMENT'));
        }
    }
    assert.equal(verifyReceipt(createReceipt(input())).environmentMatches, true);
});
test('early verification refusal reports integrity NOT_CHECKED and remembers supplied anchors', () => {
    const anchor = 'a'.repeat(64);
    for (const raw of ['{"digest":1,"digest":2}', '{', '{}']) {
        const policy = verifyReceiptText(raw, { trustedDigest: anchor });
        assert.equal(policy.valid, false);
        assert.equal(policy.integrity, 'NOT_CHECKED');
        assert.equal(policy.replay, 'NOT_RUN');
        assert.equal(policy.anchoring, 'MISMATCH');
        const run = verifyRunText(raw, anchor);
        assert.equal(run.valid, false);
        assert.equal(run.integrity, 'NOT_CHECKED');
        assert.equal(run.replay, 'NOT_RUN');
        assert.equal(run.anchoring, 'MISMATCH');
    }
    assert.equal(verifyReceipt(createReceipt(input()), { trustedDigest: 'bad' }).integrity, 'NOT_CHECKED');
    const { environment: _environment, ...declaration } = input();
    const run = runRequest({ kind: 'policy', ...declaration });
    assert.equal(verifyRun(run, 'bad').integrity, 'NOT_CHECKED');
    run.digest = '0'.repeat(64);
    assert.equal(verifyRun(run).integrity, 'INVALID');
    const policy = createReceipt(input());
    policy.digest = '0'.repeat(64);
    assert.equal(verifyReceipt(policy).integrity, 'INVALID');
});
test('CLI distinguishes malformed anchors from well-formed mismatches', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cosmic-anchor-'));
    try {
        const path = join(dir, 'receipt.json');
        let result = invokeCli(['demo', 'release-authorization', '--out', path]);
        assert.equal(result.status, 0, result.stderr);
        for (const anchor of ['bad', 'A'.repeat(64), '0'.repeat(63)]) {
            result = invokeCli(['verify', path, '--expect', anchor]);
            assert.equal(result.status, 2, result.stderr);
            assert.equal(result.stdout, '');
            assert.match(result.stderr, /--expect/);
        }
        result = invokeCli(['verify', path, '--expect', '0'.repeat(64)]);
        assert.equal(result.status, 1, result.stderr);
        const verification = JSON.parse(result.stdout);
        assert.equal(verification.integrity, 'VALID');
        assert.equal(verification.anchoring, 'MISMATCH');
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
test('CLI --out refuses existing paths before evaluation and never follows output symlinks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cosmic-output-'));
    try {
        const inputPath = join(dir, 'input.json');
        const original = '{"invalid":"input must not be evaluated"}\n';
        writeFileSync(inputPath, original);
        const existingPath = join(dir, 'existing.json');
        writeFileSync(existingPath, 'keep existing bytes');
        const symlinkPath = join(dir, 'symlink.json');
        symlinkSync(inputPath, symlinkPath);
        const hardlinkPath = join(dir, 'hardlink.json');
        linkSync(inputPath, hardlinkPath);
        const missingTarget = join(dir, 'missing-target.json');
        const danglingPath = join(dir, 'dangling.json');
        symlinkSync(missingTarget, danglingPath);
        for (const path of [inputPath, existingPath, symlinkPath, hardlinkPath, danglingPath, dir]) {
            const result = invokeCli(['run', inputPath, '--out', path]);
            assert.equal(result.status, 2, result.stderr);
            assert.match(result.stderr, /Output already exists/, path);
            assert.equal(result.stdout, '');
            assert.equal(readFileSync(inputPath, 'utf8'), original);
            assert.equal(readFileSync(existingPath, 'utf8'), 'keep existing bytes');
        }
        assert.equal(existsSync(missingTarget), false);
        const outputPath = join(dir, 'new', 'receipt.json');
        const result = invokeCli(['demo', 'release-authorization', '--out', outputPath]);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).result.verdict, 'ALLOW');
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
test('malformed envelopes and digest syntax cannot pass', () => {
    for (const receipt of [null, {}, { payload: {}, digest: 'x' }, { ...createReceipt(input()), signature: 'made-up' }]) {
        assert.equal(verifyReceipt(receipt).valid, false);
    }
    assert.equal(verifyReceipt(createReceipt(input()), { trustedDigest: 'bad' }).valid, false);
});
