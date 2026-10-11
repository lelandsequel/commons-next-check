// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const state = { examples: [], selectedExample: null, receipt: null, running: false, verifying: false, importedReceiptText: null, toastTimer: null };
  const MAX_IMPORT_BYTES = 1_900_000;
  const text = (tag, content, className) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = String(content ?? '');
    return element;
  };
  const json = (value) => JSON.stringify(value, null, 2);
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const humanize = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (s) => s.toUpperCase());
  const shortValue = (value) => {
    // Preserve every displayed binary64 digit, including policy threshold differences.
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === null) return 'None';
    if (isObject(value) || Array.isArray(value)) return JSON.stringify(value);
    return String(value ?? '—');
  };

  function showError(id, message) { $(id).textContent = message || ''; $(id).hidden = !message; }
  function toast(message) {
    clearTimeout(state.toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    state.toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  function connection(online) {
    $('connection').className = `connection ${online ? 'connected' : 'disconnected'}`;
    $('connection-label').textContent = online ? 'Local service ready' : 'Service unavailable';
  }
  async function api(path, body, raw = false, extraHeaders = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', ...extraHeaders }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body), signal: controller.signal });
      const data = await response.json().catch(() => null);
      connection(true);
      if (!response.ok) {
        const problem = data?.error?.message || data?.error || data?.message || `Request failed (${response.status}).`;
        throw new Error(typeof problem === 'string' ? problem : json(problem));
      }
      if (data === null) throw new Error('The local service returned an empty or invalid JSON response.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The request timed out. Check the local service and try again.');
      if (error instanceof TypeError) { connection(false); throw new Error('Cannot reach the local service. Make sure COSMIC Commons is running, then try again.'); }
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function setMode(mode, focus = false) {
    for (const candidate of ['run', 'verify']) {
      const active = candidate === mode;
      const tab = $(`${candidate}-tab`);
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      $(`${candidate}-panel`).hidden = !active;
    }
    if (focus) $(`${mode}-tab`).focus();
  }
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
    button.addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const mode = event.key === 'Home' ? 'run' : event.key === 'End' ? 'verify' : button.dataset.mode === 'run' ? 'verify' : 'run';
        setMode(mode, true);
      }
    });
  });

  function updateEditorMeta() {
    const value = $('input-editor').value;
    const lines = value ? value.split('\n').length : 0;
    $('editor-meta').textContent = `${lines} ${lines === 1 ? 'line' : 'lines'} · ${new TextEncoder().encode(value).length.toLocaleString('en-US')} bytes`;
  }
  function markResultStale(message = 'Input changed. Run it to create a new receipt.') {
    if (!state.receipt) return;
    $('result-kind').textContent = 'PREVIOUS RESULT';
    $('result-kind').className = 'pill warning';
    $('input-help').textContent = message;
  }
  function chooseExample(example) {
    state.selectedExample = example.id;
    $('input-editor').value = json(example.input);
    $('input-filename').textContent = `${example.id}.json`;
    document.querySelectorAll('.example-card').forEach((button) => {
      const selected = button.dataset.example === example.id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    updateEditorMeta();
    showError('run-error', '');
    markResultStale();
  }
  async function loadExamples() {
    try {
      const data = await api('/api/examples');
      if (!Array.isArray(data.examples) || !data.examples.length) throw new Error('The service did not return any examples. You can still paste an input below.');
      state.examples = data.examples;
      $('examples').replaceChildren();
      data.examples.forEach((example, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'example-card'; button.dataset.example = example.id; button.setAttribute('aria-pressed', 'false');
        button.append(text('span', String(index + 1).padStart(2, '0'), 'example-number'));
        const content = document.createElement('span');
        content.append(text('span', example.name, 'example-title'), text('span', example.description, 'example-description'));
        button.append(content, text('span', '↗', 'example-arrow'));
        button.addEventListener('click', () => chooseExample(example));
        $('examples').append(button);
      });
      chooseExample(data.examples[0]);
    } catch (error) {
      $('examples').replaceChildren();
      showError('examples-error', error.message);
    }
  }
  $('input-editor').addEventListener('input', () => {
    updateEditorMeta();
    $('input-help').textContent = state.receipt ? 'Input changed. Run it to create a new receipt.' : 'Every assumption is part of the input.';
    markResultStale();
  });
  $('format-button').addEventListener('click', async () => {
    const submittedText = $('input-editor').value;
    $('format-button').disabled = true;
    try {
      // Raw ingress must reach the shared parser before any JSON round trip.
      const response = await api('/api/format', submittedText, true);
      if (typeof response.formatted !== 'string') throw new Error('The service did not return formatted JSON.');
      if ($('input-editor').value !== submittedText) { toast('Input changed during formatting. Your edits were kept.'); return; }
      $('input-editor').value = response.formatted; updateEditorMeta(); showError('run-error', ''); markResultStale();
    } catch (error) { showError('run-error', `Input was not formatted: ${error.message}`); markResultStale('Formatting failed. The input and previous receipt were kept.'); }
    finally { $('format-button').disabled = false; }
  });
  $('input-editor').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(); } });

  function card(label, value, note) {
    const element = text('div', '', 'summary-card');
    element.append(text('span', label, 'summary-card-label'));
    const display = shortValue(value);
    element.append(text('div', display, `summary-card-value${display.length > 13 ? ' long' : ''}`));
    if (note) element.append(text('div', note, 'summary-card-note'));
    return element;
  }
  function section(title) {
    const element = text('section', '', 'detail-section');
    element.append(text('h3', title));
    return element;
  }
  function table(title, rows, preferredKeys) {
    if (!Array.isArray(rows) || !rows.length) return null;
    const normalized = rows.map((row) => isObject(row) ? row : { value: row });
    const allKeys = [...new Set(normalized.flatMap(Object.keys))];
    const keys = preferredKeys?.filter((key) => allKeys.includes(key)) || allKeys.slice(0, 5);
    if (!keys.length) return null;
    const element = section(title);
    const wrapper = text('div', '', 'data-table-wrap');
    const tableElement = text('table', '', 'data-table');
    const head = document.createElement('thead'); const headerRow = document.createElement('tr');
    keys.forEach((key) => { const cell = text('th', humanize(key)); cell.scope = 'col'; headerRow.append(cell); });
    head.append(headerRow); tableElement.append(head);
    const body = document.createElement('tbody');
    normalized.slice(0, 40).forEach((row) => { const tr = document.createElement('tr'); keys.forEach((key) => tr.append(text('td', shortValue(row[key])))); body.append(tr); });
    tableElement.append(body); wrapper.append(tableElement); element.append(wrapper);
    if (normalized.length > 40) element.append(text('p', `Showing 40 of ${normalized.length} rows. All rows are in the full result below.`, 'result-explanation'));
    return element;
  }
  function records(value, nameKey = 'name') {
    if (Array.isArray(value)) return value;
    if (isObject(value)) return Object.entries(value).map(([key, val]) => isObject(val) ? { [nameKey]: key, ...val } : { [nameKey]: key, value: val });
    return [];
  }
  function appendTable(title, rows, keys) { const element = table(title, rows, keys); if (element) $('result-details').append(element); }

  function renderReceipt(receipt) {
    const result = receipt.result ?? {};
    const kind = receipt.kind || receipt.input?.kind || 'result';
    const cards = $('summary-cards'); cards.replaceChildren();
    $('result-details').replaceChildren();
    $('decision-notice').replaceChildren(); $('decision-notice').hidden = true;
    $('result-kind').textContent = humanize(kind).toUpperCase(); $('result-kind').className = 'pill ready';
    $('empty-result').hidden = true; $('result-content').hidden = false;
    if (kind === 'policy') {
      const verdict = result.verdict ?? result.decision ?? result.outcome ?? 'Computed';
      const decision = isObject(verdict) ? verdict.verdict ?? verdict.outcome ?? 'Computed' : verdict;
      $('result-kind').textContent = `POLICY · ${String(decision).toUpperCase()}`;
      $('result-kind').className = `pill ${decision === 'ALLOW' ? 'ready' : decision === 'DEFER' ? 'warning' : ['DENY', 'ERROR'].includes(decision) ? 'invalid' : 'warning'}`;
      const trace = records(result.trace ?? result.evaluations ?? result.rules);
      const evidenceFacts = records(result.evidence?.facts);
      cards.append(card('Decision', decision), card('Rules evaluated', trace.length), card('Evidence facts', evidenceFacts.length));
      $('result-explanation').textContent = 'The decision follows the declared policy and supplied evidence. Inspect the rule trace to see which conditions determined the outcome.';
      appendTable('Decision trace', trace, ['ruleId', 'result', 'actual', 'expected', 'code']);
      appendTable('Evidence availability', evidenceFacts, ['id', 'status', 'reasons']);
      appendTable('Evidence lineage', records(result.evidence?.lineage));
      appendTable('Evidence issues', records(result.evidence?.issues));
      appendTable('Policy errors', records(result.errors));
      if (result.reasons) appendTable('Reasons', records(result.reasons));
      if (result.missingEvidence) appendTable('Missing evidence', records(result.missingEvidence));
    } else if (kind === 'discovery') {
      const snapshot = result.snapshot ?? result;
      const beliefs = records(snapshot.posterior ?? result.beliefs ?? result.posterior ?? result.posteriors ?? result.hypotheses, 'hypothesis');
      const recommendations = result.recommendation ? [result.recommendation] : records(result.recommendations ?? result.experiments ?? result.nextExperiments);
      const adequacy = result.adequacy;
      const adequacyDisplay = isObject(adequacy) ? adequacy.status ?? adequacy.verdict ?? adequacy.adequate : adequacy;
      const deferred = result.decisionStatus !== 'AVAILABLE' || snapshot.modelMismatch === true || adequacyDisplay !== 'NOT_REJECTED';
      const decisionStatus = ['DENY', 'ERROR'].includes(result.decisionStatus) ? result.decisionStatus : deferred ? 'DEFER' : 'AVAILABLE';
      const adequacyLabel = { NOT_REJECTED: 'Not rejected', REJECTED_DECLARED_FAMILY: 'Rejected family', ZERO_SUPPORT_CONTRADICTION: 'Zero support', NOT_EVALUATED: 'Not evaluated', UNSUPPORTED: 'Unsupported' }[adequacyDisplay] ?? adequacyDisplay ?? 'Not evaluated';
      cards.append(card('Decision status', decisionStatus, deferred ? 'Action withheld' : 'Conditional on the model'), card('Budget left', snapshot.remainingBudget ?? '—', 'Declared cost units'), card('Adequacy', adequacyLabel, adequacyDisplay === 'NOT_REJECTED' ? 'Not a model approval' : undefined));
      $('result-kind').textContent = `DISCOVERY · ${decisionStatus}`;
      $('result-kind').className = `pill ${deferred ? ['DENY', 'ERROR'].includes(decisionStatus) ? 'invalid' : 'warning' : 'ready'}`;
      if (deferred) {
        const reason = snapshot.modelMismatch || adequacyDisplay === 'ZERO_SUPPORT_CONTRADICTION'
          ? 'An observation has zero support under the active model family.'
          : adequacyDisplay === 'REJECTED_DECLARED_FAMILY'
            ? 'The adequacy monitor rejected the active model family.'
            : adequacyDisplay === 'UNSUPPORTED'
              ? `Adequacy is UNSUPPORTED. ${adequacy.reason || 'The declared experiment is outside this monitor’s supported scope.'}`
              : adequacyDisplay === 'NOT_EVALUATED' || adequacyDisplay == null
                ? `Adequacy is NOT_EVALUATED. ${adequacy?.reason || 'No family adequacy assessment was made.'}`
                : 'This run does not support a decision.';
        $('decision-notice').append(text('strong', `${decisionStatus} — no action recommendation`), text('p', `${reason} Review the declared hypotheses and likelihoods before using this model to decide.`));
        $('decision-notice').hidden = false;
      }
      $('result-explanation').textContent = snapshot.modelMismatch
        ? 'The posterior could not be updated after the contradiction. Values below retain the last supported state; they are not probabilities for the contradicted observation.'
        : deferred
          ? 'Posterior weights describe only the declared model family. Even a weight of 100% cannot override DEFER or establish that a hypothesis is true.'
          : 'Posterior weights are conditional on your declared hypotheses, priors, and likelihoods. NOT_REJECTED means insufficient evidence against the active model family; it does not approve the model or authorize an action.';
      const probabilityKey = beliefs.length ? ['posterior', 'probability', 'posteriorProbability', 'value'].find((key) => beliefs.every((belief) => typeof belief?.[key] === 'number' && belief[key] >= 0 && belief[key] <= 1)) : null;
      if (probabilityKey) {
        const chart = section(snapshot.modelMismatch ? 'Last supported posterior weights' : 'Posterior weights within the declared family');
        if (deferred) chart.classList.add('deferred-beliefs');
        beliefs.slice(0, 20).forEach((belief, index) => {
          const row = text('div', '', 'belief-row'); const line = text('div', '', 'belief-line');
          const percentage = belief[probabilityKey] * 100;
          // A display approximation must never turn a nonzero weight into zero,
          // or a weight below one into an apparent certainty of 100 percent.
          const rounded = percentage.toFixed(2);
          const percentageText = (percentage > 0 && Number(rounded) === 0) || (belief[probabilityKey] < 1 && Number(rounded) === 100)
            ? String(percentage) : rounded;
          const weight = text('strong', `${Number(percentageText) === percentage ? '' : '≈ '}${percentageText}%`);
          weight.title = `Conditional posterior weight: ${String(belief[probabilityKey])}`;
          weight.setAttribute('aria-label', `${weight.textContent}; ${weight.title}`);
          line.append(text('span', belief.hypothesis ?? belief.name ?? belief.id ?? `Hypothesis ${index + 1}`), weight);
          const track = text('div', '', 'belief-track'); const fill = text('div', '', 'belief-fill'); fill.style.width = `${belief[probabilityKey] * 100}%`; track.append(fill); row.append(line, track); chart.append(row);
        });
        $('result-details').append(chart);
      } else appendTable('Posterior weights within the declared family', beliefs);
      appendTable('Next experiment', recommendations, ['status', 'experimentId', 'cost', 'expectedInformationGainNats', 'reason']);
      if (!deferred && result.action) appendTable('Expected-loss decision', Array.isArray(result.action.alternatives) ? result.action.alternatives.map((action) => ({ action: action.actionId, expectedLoss: action.expectedLoss, selected: action.actionId === result.action.actionId })) : [result.action]);
      if (isObject(adequacy)) appendTable('Model adequacy', ['status', 'reason', 'unsupportedExperimentIds', 'alpha', 'observationCount', 'logEValue', 'firstCrossingSequence'].filter((key) => Object.hasOwn(adequacy, key)).map((key) => ({ check: humanize(key), value: adequacy[key] })));
      if (result.assumptions) appendTable('Declared assumptions', records(result.assumptions));
    } else {
      const scalars = isObject(result) ? Object.entries(result).filter(([, value]) => !isObject(value) && !Array.isArray(value)).slice(0, 3) : [];
      if (scalars.length) scalars.forEach(([label, value]) => cards.append(card(humanize(label), value)));
      else cards.append(card('Computation', 'Complete'), card('Receipt', 'Created'));
      $('result-explanation').textContent = 'Inspect the result and its inputs in the receipt below. Download the receipt to preserve this computation or verify it independently.';
    }
    $('receipt-digest').textContent = receipt.digest ?? 'No digest returned';
    $('copy-digest').disabled = !receipt.digest;
    $('result-json').textContent = json(result);
    $('receipt-json').textContent = json(receipt);
    $('load-current').disabled = false;
  }
  async function run() {
    if (state.running) return;
    showError('run-error', '');
    const submittedText = $('input-editor').value;
    state.running = true;
    $('run-button').disabled = true; $('run-button-label').textContent = 'Computing…';
    $('result-panel').setAttribute('aria-busy', 'true'); $('result-kind').textContent = 'RUNNING'; $('result-kind').className = 'pill running';
    try {
      const receipt = await api('/api/run', submittedText, true);
      if (!isObject(receipt) || !('result' in receipt) || typeof receipt.digest !== 'string') throw new Error('The service returned an incomplete receipt. No new result was saved.');
      state.receipt = receipt;
      renderReceipt(receipt);
      $('input-help').textContent = 'Receipt created. Ready to inspect and replay.';
      if ($('input-editor').value !== submittedText) markResultStale('Input changed during the run. This receipt records the earlier input.');
    } catch (error) {
      showError('run-error', error.message);
      $('result-kind').textContent = state.receipt ? 'PREVIOUS RESULT' : 'NOT RUN'; $('result-kind').className = 'pill warning';
      $('input-help').textContent = state.receipt ? 'Run failed. The previous receipt remains displayed.' : 'Resolve the error and run again.';
    } finally {
      state.running = false; $('run-button').disabled = false; $('run-button-label').textContent = 'Run reasoning'; $('result-panel').setAttribute('aria-busy', 'false');
    }
  }
  $('run-button').addEventListener('click', run);
  $('download-receipt').addEventListener('click', () => {
    if (!state.receipt) return;
    const blob = new Blob([`${json(state.receipt)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    const kind = String(state.receipt.kind || 'result').replace(/[^a-z0-9-]/gi, '-');
    anchor.href = url; anchor.download = `cosmic-${kind}-${String(state.receipt.digest).slice(0, 12)}.receipt.json`; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('copy-digest').addEventListener('click', async () => {
    if (!state.receipt?.digest) return;
    try { await navigator.clipboard.writeText(state.receipt.digest); toast('Receipt digest copied.'); }
    catch { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents($('receipt-digest')); selection.removeAllRanges(); selection.addRange(range); toast('Digest selected. Use your keyboard to copy.'); }
  });

  function resetVerification() {
    $('verification-status').textContent = 'NOT VERIFIED'; $('verification-status').className = 'pill';
    $('verification-content').hidden = true; $('empty-verification').hidden = false;
    showError('verify-error', '');
  }
  function loadCurrent() {
    if (!state.receipt) return;
    state.importedReceiptText = null;
    $('receipt-editor').value = json(state.receipt); $('receipt-filename').textContent = 'Latest local receipt'; $('import-status').textContent = 'Latest result loaded.'; $('trusted-digest').value = ''; resetVerification();
  }
  $('load-current').addEventListener('click', loadCurrent);
  $('verify-current').addEventListener('click', () => { loadCurrent(); setMode('verify'); $('verify-button').focus(); });
  $('receipt-editor').addEventListener('input', () => { state.importedReceiptText = null; $('import-status').textContent = 'Receipt edited. Verify to check these bytes.'; resetVerification(); });
  $('trusted-digest').addEventListener('input', resetVerification);
  async function importReceipt(file) {
    if (!file) return;
    resetVerification();
    if (file.size > MAX_IMPORT_BYTES) { showError('verify-error', 'This receipt exceeds the workbench import limit. All JSON entrypoints enforce a 2 MB limit.'); return; }
    try {
      const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      // Keep uploaded text separately: textarea.value normalizes CRLF to LF.
      state.importedReceiptText = content;
      $('receipt-editor').value = content; $('receipt-filename').textContent = file.name; $('import-status').textContent = `${file.name} loaded.`; resetVerification();
    } catch (error) { showError('verify-error', `Could not import receipt JSON: ${error.message}`); $('import-status').textContent = 'Import refused. The previous receipt text was kept; verify it again before relying on it.'; }
  }
  $('receipt-file').addEventListener('change', (event) => { importReceipt(event.target.files[0]); event.target.value = ''; });
  ['dragenter', 'dragover'].forEach((type) => $('import-zone').addEventListener(type, (event) => { event.preventDefault(); $('import-zone').classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach((type) => $('import-zone').addEventListener(type, (event) => { event.preventDefault(); $('import-zone').classList.remove('drag-over'); }));
  $('import-zone').addEventListener('drop', (event) => importReceipt(event.dataTransfer.files[0]));

  function renderVerification(response) {
    $('empty-verification').hidden = true; $('verification-content').hidden = false;
    const valid = response.valid === true;
    const unanchored = response.anchoring === 'UNANCHORED';
    $('verification-status').textContent = valid ? unanchored ? 'UNANCHORED' : 'CHECKS PASSED' : 'CHECKS FAILED'; $('verification-status').className = `pill ${valid ? unanchored ? 'warning' : 'valid' : 'invalid'}`;
    const definitions = [
      { key: 'integrity', title: 'Receipt integrity', good: 'VALID', descriptions: { VALID: 'The recorded digest matches the receipt content.', INVALID: 'The recorded digest does not match the receipt content.', NOT_CHECKED: 'Verification stopped before receipt integrity could be checked.' } },
      { key: 'replay', title: 'Computation replay', good: 'MATCH', descriptions: { MATCH: 'The local implementation reproduced the recorded computation.', MISMATCH: 'The replayed computation differs from the recorded result.', UNSUPPORTED: 'This runtime cannot replay the receipt as provided.', NOT_RUN: 'Replay was not performed.' } },
      { key: 'anchoring', title: 'Trusted digest', good: 'MATCH', descriptions: { MATCH: 'The receipt matches the trusted digest you supplied.', MISMATCH: 'A match to the supplied trusted digest was not established.', NOT_CHECKED: 'Verification stopped before the trusted digest could be checked.', UNANCHORED: 'No trusted digest was supplied. This checks receipt consistency only.' } },
    ];
    $('verification-checks').replaceChildren();
    definitions.forEach((definition) => {
      const status = response[definition.key] ?? 'NOT_REPORTED';
      const good = status === definition.good; const bad = ['INVALID', 'MISMATCH'].includes(status);
      const row = text('div', '', 'check-row'); const icon = text('span', good ? '✓' : bad ? '×' : '–', `check-icon ${good ? 'good' : bad ? 'bad' : 'neutral'}`); icon.setAttribute('aria-hidden', 'true');
      const body = text('div', '', 'check-body'); const header = text('div', '', 'check-header');
      header.append(text('h3', definition.title), text('code', status)); body.append(header, text('p', definition.descriptions[status] || 'The service did not report a recognized status for this check.'));
      row.append(icon, body); $('verification-checks').append(row);
    });
    $('verification-reason').textContent = `${valid && unanchored ? 'Unanchored — receipt consistency only. ' : ''}${response.reason || (valid ? 'The reported verification checks passed.' : 'Review the check results before relying on this receipt.')}`;
    $('verification-json').textContent = json(response);
  }
  async function verify() {
    if (state.verifying) return;
    resetVerification();
    const submittedReceiptText = state.importedReceiptText ?? $('receipt-editor').value;
    const submittedDigestText = $('trusted-digest').value;
    const expectedDigest = submittedDigestText.trim();
    if (expectedDigest && !/^[a-fA-F0-9]{64}$/.test(expectedDigest)) { showError('verify-error', 'A trusted digest must contain exactly 64 hexadecimal characters.'); $('trusted-digest').focus(); return; }
    state.verifying = true; $('verify-button').disabled = true; $('verify-button-label').textContent = 'Verifying…'; $('verification-panel').setAttribute('aria-busy', 'true');
    $('verification-status').textContent = 'CHECKING'; $('verification-status').className = 'pill running';
    try {
      const result = await api('/api/verify', submittedReceiptText, true, expectedDigest ? { 'X-Cosmic-Expected-Digest': expectedDigest.toLowerCase() } : {});
      if ((state.importedReceiptText ?? $('receipt-editor').value) !== submittedReceiptText || $('trusted-digest').value !== submittedDigestText) {
        resetVerification();
        $('import-status').textContent = 'Receipt or trusted digest changed during verification. Verify again.';
      } else {
        renderVerification(result);
        $('import-status').textContent = 'Verification complete.';
      }
    }
    catch (error) { showError('verify-error', error.message); resetVerification(); showError('verify-error', error.message); $('import-status').textContent = 'Verification could not complete.'; }
    finally { state.verifying = false; $('verify-button').disabled = false; $('verify-button-label').textContent = 'Verify & replay'; $('verification-panel').setAttribute('aria-busy', 'false'); }
  }
  $('verify-button').addEventListener('click', verify);
  loadExamples();
})();
