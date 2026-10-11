// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Optional QA tool; runtime Commons has zero npm dependencies.
// Run from Commons root with COMMONS_PLAYWRIGHT_MODULE, COMMONS_CHROMIUM_MODULE,
// and COMMONS_BROWSER_EXECUTABLE set when browser tooling is installed elsewhere.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorkbenchServer } from '../dist/src/server.js';
import { getExample } from '../dist/src/examples.js';
import { runRequest, executionRuntime } from '../dist/src/run.js';
const { chromium: playwright } = await import(process.env.COMMONS_PLAYWRIGHT_MODULE || 'playwright');
const options = { headless: true };
if (process.env.COMMONS_CHROMIUM_MODULE) options.args = (await import(process.env.COMMONS_CHROMIUM_MODULE)).default.args;
if (process.env.COMMONS_BROWSER_EXECUTABLE) options.executablePath = process.env.COMMONS_BROWSER_EXECUTABLE;
const runtime = executionRuntime();
const output = 'verification/browser-receipt';
mkdirSync(output, { recursive: true });
const receipt = runRequest(getExample('release-deferred'));
assert.equal(receipt.result.verdict, 'DEFER');
const raw = JSON.stringify(receipt, null, 2) + '\n';
const attack = raw.replace('"verdict": "DEFER"', '"verdict": "ALLOW",\n    "verdict": "DEFER"');
assert.notEqual(attack, raw);
const escapedCRLF = attack.replace('"verdict": "ALLOW"', '"ver\\u0064ict": "ALLOW"').replaceAll('\n', '\r\n');
writeFileSync(`${output}/deferred.receipt.json`, raw);
writeFileSync(`${output}/A1-duplicate-verdict.json`, attack);
writeFileSync(`${output}/A1-escaped-CRLF.json`, escapedCRLF);
writeFileSync(`${output}/A1-legacy-envelope.json`, `{"receipt":${attack},"expectedDigest":${JSON.stringify(receipt.digest)}}\n`);
const server = createWorkbenchServer();
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
const results = [], pageErrors = [], consoleErrors = [];
let browser;
try {
  browser = await playwright.launch(options);
  const page = await browser.newPage({ viewport: {width:1440,height:1000} });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(base);
  await page.locator('#verify-tab').click();
  for (const [file, expected, anchoring, suppliedDigest] of [
    ['deferred.receipt.json', true, 'MATCH', receipt.digest],
    ['A1-duplicate-verdict.json', false, 'MISMATCH', receipt.digest],
    ['A1-escaped-CRLF.json', false, 'MISMATCH', receipt.digest],
    ['A1-legacy-envelope.json', false, 'NOT_CHECKED', ''],
  ]) {
    const path = resolve(output, file);
    const bytes = readFileSync(path);
    await page.locator('#receipt-file').setInputFiles(path);
    await page.waitForFunction(name => document.querySelector('#receipt-filename').textContent === name, file);
    await page.locator('#trusted-digest').fill(suppliedDigest);
    const responsePromise = page.waitForResponse(response => response.url() === base + '/api/verify' && response.request().method() === 'POST');
    await page.locator('#verify-button').click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    assert.ok(response.request().postDataBuffer().equals(bytes), `${file}: browser changed uploaded text`);
    const answer = await response.json();
    assert.equal(answer.valid, expected);
    assert.equal(answer.anchoring, anchoring);
    if (expected) {
      assert.equal(answer.integrity, 'VALID');
      assert.equal(answer.replay, 'MATCH');
    } else {
      assert.equal(answer.integrity, 'NOT_CHECKED');
      assert.equal(answer.replay, 'NOT_RUN');
      assert.match(answer.reason, /^DUPLICATE_JSON_KEY:/);
    }
    await page.waitForFunction(expectedStatus => document.querySelector('#verification-status').textContent === expectedStatus,
      expected ? 'CHECKS PASSED' : 'CHECKS FAILED');
    if (!expected) {
      const integrityRow = page.locator('.check-row').filter({ hasText: 'Receipt integrity' });
      assert.match(await integrityRow.innerText(), /NOT_CHECKED/);
      assert.match(await integrityRow.innerText(), /Verification stopped before receipt integrity could be checked\./);
      assert.equal(await integrityRow.locator('.check-icon').getAttribute('class'), 'check-icon neutral');
      assert.match(await page.locator('#verification-reason').innerText(), /DUPLICATE_JSON_KEY/);
      assert.match(await page.locator('#verification-checks').innerText(), anchoring === 'NOT_CHECKED'
        ? /Verification stopped before the trusted digest could be checked\./
        : /A match to the supplied trusted digest was not established\./);
    }
    results.push({file,requestBodyEqualsFile:true,response:answer,visibleStatus:await page.locator('#verification-status').innerText()});
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({path:`${output}/B5-duplicate-refusal.png`,fullPage:true});
  const malformedDigest = structuredClone(receipt);
  malformedDigest.digest = 'f'.repeat(64);
  const changedRaw = JSON.stringify(malformedDigest, null, 2) + '\n';
  await page.locator('#receipt-editor').fill(changedRaw);
  await page.locator('#trusted-digest').fill(receipt.digest);
  const mismatchPromise = page.waitForResponse(response => response.url() === base + '/api/verify');
  await page.locator('#verify-button').click();
  const mismatch = await (await mismatchPromise).json();
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.integrity, 'INVALID');
  await page.waitForFunction(() => document.querySelector('#verification-json').textContent.includes('"integrity": "INVALID"'));
  const integrityRow = page.locator('.check-row').filter({ hasText: 'Receipt integrity' });
  assert.equal(await integrityRow.locator('.check-icon').getAttribute('class'), 'check-icon bad');
  assert.match(await integrityRow.innerText(), /The recorded digest does not match the receipt content\./);
  results.push({ case: 'actual-digest-mismatch', response: mismatch, integrityIcon: 'bad' });

  const editorBeforeInvalidImport = await page.locator('#receipt-editor').inputValue();
  await page.locator('#receipt-file').setInputFiles({ name: 'invalid-utf8.json', mimeType: 'application/json', buffer: Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]) });
  await page.waitForFunction(() => document.querySelector('#verify-error').textContent.includes('Could not import receipt JSON'));
  assert.equal(await page.locator('#receipt-editor').inputValue(), editorBeforeInvalidImport, 'Invalid UTF-8 must not replace the current receipt with decoded replacement text');
  assert.equal(await page.locator('#verification-status').innerText(), 'NOT VERIFIED', 'A refused import must clear any previous verification result');
  results.push({ case: 'invalid-utf8-upload', browserRefused: true, previousInputPreserved: true, visibleError: await page.locator('#verify-error').innerText() });
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(executionRuntime(), runtime, 'Source or compiled executable changed while testing');
  const report = {execution:'shipped-dist-javascript',runtime,browserVersion:browser.version(),trustedDigest:receipt.digest,results,pageErrors,consoleErrors};
  writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
