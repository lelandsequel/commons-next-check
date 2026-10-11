// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Optional browser QA; run from the package root. Browser tooling is external.
// COMMONS_PLAYWRIGHT_MODULE, COMMONS_CHROMIUM_MODULE and
// COMMONS_BROWSER_EXECUTABLE may select preinstalled tools.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createWorkbenchServer } from '../dist/src/server.js';
import { getExample } from '../dist/src/examples.js';
import { executionRuntime } from '../dist/src/run.js';

const { chromium: playwright } = await import(process.env.COMMONS_PLAYWRIGHT_MODULE || 'playwright');
const options = { headless: true };
if (process.env.COMMONS_CHROMIUM_MODULE) options.args = (await import(process.env.COMMONS_CHROMIUM_MODULE)).default.args;
if (process.env.COMMONS_BROWSER_EXECUTABLE) options.executablePath = process.env.COMMONS_BROWSER_EXECUTABLE;
const output = 'verification/browser-discovery';
mkdirSync(output, { recursive: true });
const runtime = executionRuntime();
const server = createWorkbenchServer();
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
const results = [], pageErrors = [], consoleErrors = [];
let browser;
try {
  browser = await playwright.launch(options);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    // Expected 400 format refusals are browser network diagnostics, not JS errors.
    if (message.type() === 'error' && !message.text().includes('status of 400')) consoleErrors.push(message.text());
  });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#input-editor').value.length > 0);
  async function screenshot(name) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  }
  async function run(input, name) {
    const raw = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
    await page.locator('#input-editor').fill(raw);
    const pending = page.waitForResponse(response => response.url() === base + '/api/run');
    await page.locator('#run-button').click();
    const response = await pending;
    assert.equal(response.request().postData(), raw);
    assert.equal(response.status(), 200);
    const receipt = await response.json();
    await page.waitForFunction(digest => document.querySelector('#receipt-digest').textContent === digest, receipt.digest);
    writeFileSync(`${output}/${name}.receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  }
  await page.locator('[data-example="discovery-deferred"]').click();
  assert.equal(JSON.parse(await page.locator('#input-editor').inputValue()).definition.modelId, 'excluded-decoy-demonstration-v1');
  const decoy = await run(getExample('discovery-deferred'), 'B1-excluded-decoy');
  assert.equal(decoy.result.decisionStatus, 'DEFER');
  assert.equal(decoy.result.adequacy.status, 'REJECTED_DECLARED_FAMILY');
  assert.equal(decoy.result.action, null);
  assert.match(await page.locator('#decision-notice').innerText(), /DEFER — no action recommendation/);
  results.push({ case: 'shipped-excluded-decoy-example', digest: decoy.digest, visibleStatus: await page.locator('#result-kind').innerText(), actionShown: false });
  for (const filename of ['with-zero-prior.json', 'without-zero-prior.json']) {
    const regressionInput = readFileSync(`tests/fixtures/regression/adequacy/${filename}`, 'utf8');
    const regressionReceipt = await run(regressionInput, `Regression-adequacy-${filename.slice(0, -5)}`);
    assert.equal(regressionReceipt.result.decisionStatus, 'DEFER');
    assert.equal(regressionReceipt.result.adequacy.status, 'REJECTED_DECLARED_FAMILY');
    assert.equal(regressionReceipt.result.action, null);
    assert.equal(await page.locator('#result-kind').innerText(), 'DISCOVERY · DEFER');
    assert.match(await page.locator('#result-kind').getAttribute('class'), /warning/);
    assert.doesNotMatch(await page.locator('#result-kind').getAttribute('class'), /ready|valid/);
    assert.doesNotMatch(await page.locator('#result-details').innerText(), /Expected-loss decision/);
    results.push({ case: `Regression-adequacy-${filename}`, digest: regressionReceipt.digest, visibleStatus: await page.locator('#result-kind').innerText(), actionShown: false, originalRawInputPreserved: true });
  }
  const rejected = getExample('sensor-investigation');
  rejected.definition.budget = 20;
  rejected.definition.experiments = [{ id: 'probe', cost: 1, outcomes: ['1', '0'], likelihoods: {
    positive: { '1': 0.5, '0': 0.5 }, negative: { '1': 0.5, '0': 0.5 },
  } }];
  rejected.observations = Array.from({ length: 12 }, (_, i) => ({ id: `o${i}`, experimentId: 'probe', outcome: '1' }));
  let receipt = await run(rejected, 'B2-rejected-family');
  assert.equal(receipt.result.decisionStatus, 'DEFER');
  assert.equal(receipt.result.adequacy.status, 'REJECTED_DECLARED_FAMILY');
  assert.equal(receipt.result.action, null);
  assert.equal(await page.locator('#result-kind').innerText(), 'DISCOVERY · DEFER');
  assert.match(await page.locator('#result-kind').getAttribute('class'), /warning/);
  assert.equal(await page.locator('#decision-notice').isVisible(), true);
  assert.match(await page.locator('#decision-notice').innerText(), /DEFER — no action recommendation/);
  assert.match(await page.locator('#decision-notice').innerText(), /rejected the active model family/);
  assert.doesNotMatch(await page.locator('#result-details').innerText(), /Expected-loss decision/);
  assert.match(await page.locator('#result-explanation').innerText(), /100% cannot override DEFER/);
  const notice = await page.locator('#decision-notice').boundingBox();
  const cards = await page.locator('#summary-cards').boundingBox();
  assert.ok(notice.y + notice.height <= cards.y, 'Refusal must precede numeric summary');
  results.push({ case: 'rejected-family', digest: receipt.digest, visibleStatus: await page.locator('#result-kind').innerText(), noticeBeforeSummary: true, actionShown: false });
  await screenshot('B2-rejected-family-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#decision-notice').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#decision-notice').isVisible(), true);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile page must not overflow horizontally');
  await screenshot('B2-rejected-family-mobile');
  await page.setViewportSize({ width: 1440, height: 1100 });

  const certain = structuredClone(rejected);
  certain.definition.hypotheses = [{ id: 'positive', prior: 1 }, { id: 'negative', prior: 0 }];
  receipt = await run(certain, 'B2-certain-but-rejected');
  assert.equal(receipt.result.snapshot.posterior.positive, 1);
  assert.equal(receipt.result.decisionStatus, 'DEFER');
  assert.match(await page.locator('#result-details').innerText(), /100\.00%/);
  assert.equal(await page.locator('#decision-notice').isVisible(), true);
  assert.doesNotMatch(await page.locator('#result-details').innerText(), /Expected-loss decision/);
  results.push({ case: 'posterior-one-but-rejected', digest: receipt.digest, conditionalPosterior: 1, visibleStatus: await page.locator('#result-kind').innerText(), actionShown: false });
  await screenshot('B2-certain-but-rejected');

  const mismatch = getExample('sensor-investigation');
  delete mismatch.adequacy;
  mismatch.definition.experiments = [{ id: 'probe', cost: 1, outcomes: ['1', '0'], likelihoods: {
    positive: { '1': 1, '0': 0 }, negative: { '1': 1, '0': 0 },
  } }];
  mismatch.observations = [{ id: 'impossible', experimentId: 'probe', outcome: '0' }];
  receipt = await run(mismatch, 'B2-zero-support');
  assert.equal(receipt.result.snapshot.modelMismatch, true);
  assert.equal(receipt.result.decisionStatus, 'DEFER');
  assert.equal(await page.locator('#result-kind').innerText(), 'DISCOVERY · DEFER');
  assert.match(await page.locator('#decision-notice').innerText(), /zero support/);
  assert.match(await page.locator('#result-explanation').innerText(), /last supported state/);
  assert.match(await page.locator('#result-details').innerText(), /Last supported posterior weights/);
  assert.doesNotMatch(await page.locator('#result-details').innerText(), /Expected-loss decision/);
  results.push({ case: 'zero-support', digest: receipt.digest, visibleStatus: await page.locator('#result-kind').innerText(), actionShown: false });
  await screenshot('B2-zero-support');

  const unmonitored = getExample('sensor-investigation');
  delete unmonitored.adequacy;
  receipt = await run(unmonitored, 'adequacy-not-evaluated');
  assert.equal(receipt.result.adequacy.status, 'NOT_EVALUATED');
  assert.equal(receipt.result.decisionStatus, 'DEFER');
  assert.equal(receipt.result.action, null);
  assert.equal(await page.locator('#result-kind').innerText(), 'DISCOVERY · DEFER');
  assert.match(await page.locator('#result-kind').getAttribute('class'), /warning/);
  assert.match(await page.locator('#decision-notice').innerText(), /NOT_EVALUATED/);
  assert.match(await page.locator('#decision-notice').innerText(), /not requested/);
  assert.doesNotMatch(await page.locator('#result-details').innerText(), /Expected-loss decision/);
  results.push({ case: 'adequacy-not-evaluated', digest: receipt.digest, adequacyStatus: 'NOT_EVALUATED', visibleStatus: await page.locator('#result-kind').innerText(), actionShown: false });
  await screenshot('adequacy-not-evaluated');

  const unsupported = getExample('sensor-investigation');
  unsupported.definition.experiments = [{ id: 'ternary', cost: 1, outcomes: ['a', 'b', 'c'], likelihoods: {
    positive: { a: 0.3, b: 0.3, c: 0.4 }, negative: { a: 0.3, b: 0.3, c: 0.4 },
  } }];
  unsupported.observations = [{ id: 'ternary-observation', experimentId: 'ternary', outcome: 'a' }];
  receipt = await run(unsupported, 'adequacy-unsupported');
  assert.equal(receipt.result.adequacy.status, 'UNSUPPORTED');
  assert.equal(receipt.result.decisionStatus, 'DEFER');
  assert.equal(receipt.result.action, null);
  assert.equal(await page.locator('#result-kind').innerText(), 'DISCOVERY · DEFER');
  assert.match(await page.locator('#result-kind').getAttribute('class'), /warning/);
  assert.match(await page.locator('#decision-notice').innerText(), /UNSUPPORTED/);
  assert.match(await page.locator('#decision-notice').innerText(), /exactly two/);
  assert.doesNotMatch(await page.locator('#result-details').innerText(), /Expected-loss decision/);
  results.push({ case: 'adequacy-unsupported', digest: receipt.digest, adequacyStatus: 'UNSUPPORTED', visibleStatus: await page.locator('#result-kind').innerText(), actionShown: false });
  await screenshot('adequacy-unsupported');

  const nearOne = getExample('sensor-investigation');
  nearOne.definition.hypotheses = [{ id: 'positive', prior: 0.99999999998 }, { id: 'negative', prior: 0.00000000002 }];
  nearOne.observations = [];
  receipt = await run(nearOne, 'posterior-near-one');
  const exactWeight = receipt.result.snapshot.posterior.positive;
  assert.equal(exactWeight, 0.99999999998);
  const posteriorLabel = page.locator(`.belief-line strong[title="Conditional posterior weight: ${exactWeight}"]`);
  const display = await posteriorLabel.innerText();
  const displayedNumber = Number(display.replace('≈ ', '').replace('%', ''));
  assert.ok(displayedNumber < 100 && displayedNumber > 99.99, 'A posterior below one must display a percentage below 100');
  assert.match(await posteriorLabel.getAttribute('aria-label'), /Conditional posterior weight: 0\.99999999998/);
  assert.doesNotMatch(await page.locator('.belief-line').allTextContents().then(lines => lines.join('\n')), /(?:^|\s)100(?:\.0+)?%/);
  results.push({ case: 'posterior-near-one', digest: receipt.digest, conditionalPosterior: exactWeight, visiblePercentage: display, exactWeightAccessible: true });
  await screenshot('posterior-near-one');

  receipt = await run(getExample('sensor-investigation'), 'available');
  assert.equal(receipt.result.decisionStatus, 'AVAILABLE');
  assert.equal(await page.locator('#decision-notice').isVisible(), false);
  assert.match(await page.locator('#summary-cards').innerText(), /AVAILABLE/);
  assert.match(await page.locator('#result-details').innerText(), /Expected-loss decision/);
  results.push({ case: 'available', digest: receipt.digest, actionShown: true, priorRefusalCleared: true });

  const invalidPolicy = getExample('release-authorization');
  invalidPolicy.policy.rules[0].op = 'eval';
  for (const [input, verdict, style] of [
    [getExample('release-deferred'), 'DEFER', 'warning'],
    [getExample('release-denied'), 'DENY', 'invalid'],
    [invalidPolicy, 'ERROR', 'invalid'],
  ]) {
    receipt = await run(input, `policy-${verdict.toLowerCase()}`);
    assert.equal(receipt.result.verdict, verdict);
    assert.equal(await page.locator('#result-kind').innerText(), `POLICY · ${verdict}`);
    assert.equal(await page.locator('#result-kind').getAttribute('class'), `pill ${style}`);
    results.push({ case: `policy-${verdict.toLowerCase()}`, digest: receipt.digest, visibleStatus: await page.locator('#result-kind').innerText(), pillClass: `pill ${style}` });
  }

  for (const [name, raw, status, error] of [
    ['duplicate', '{"value":1,"value":2}', 400, /DUPLICATE_JSON_KEY/],
    ['rounded-integer', '{"value":9007199254740993}', 400, /NUMBER_NOT_ROUNDTRIPPABLE/],
    ['exact-unsafe-integer', '{"value":9007199254740992}', 400, /UNSAFE_INTEGER/],
    ['rounded-threshold', '{"value":0.10000000000000001}', 400, /NUMBER_NOT_ROUNDTRIPPABLE/],
    ['valid', '{"value":0.1}', 200, null],
  ]) {
    await page.locator('#input-editor').fill(raw);
    const pending = page.waitForResponse(response => response.url() === base + '/api/format');
    await page.locator('#format-button').click();
    const response = await pending;
    assert.equal(response.request().postData(), raw, 'Formatting must send unchanged raw text');
    assert.equal(response.status(), status);
    await page.waitForFunction(() => !document.querySelector('#format-button').disabled);
    if (error) {
      assert.equal(await page.locator('#input-editor').inputValue(), raw, 'Refused formatting must preserve original input');
      assert.match(await page.locator('#run-error').innerText(), error);
    } else assert.equal(await page.locator('#input-editor').inputValue(), '{\n  "value": 0.1\n}');
    results.push({ case: `format-${name}`, rawPreservedInRequest: true, status, refusedInputUnchanged: Boolean(error) });
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(executionRuntime(), runtime, 'Source or compiled executable changed while testing; rerun after edits settle');
  const report = { execution: 'shipped-dist-javascript', runtime, browserVersion: browser.version(), results, pageErrors, consoleErrors };
  writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
