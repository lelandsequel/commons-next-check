// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatResult, nextCheck } from '../next-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const example = JSON.parse(readFileSync(join(root, 'examples/three-causes.json'), 'utf8'));

describe('commons-next-check face', () => {
  it('the example recommends one of the declared checks', () => {
    const { recommendation } = nextCheck(example);
    assert.equal(recommendation.status, 'experiment');
    assert.ok(
      example.checks.some((c) => c.id === recommendation.experimentId),
      `recommended ${recommendation.experimentId}, which is not a declared check`,
    );
  });

  it('a budget smaller than every check cost refuses with budget-exhausted', () => {
    const cheapest = Math.min(...example.checks.map((c) => c.cost));
    const { recommendation, posterior } = nextCheck({ ...example, budget: cheapest - 1 });
    assert.deepEqual(recommendation, { status: 'stop', reason: 'budget-exhausted' });
    assert.deepEqual(Object.keys(posterior).sort(), ['fixture', 'material-lot', 'tooling']);
  });

  it('an observation no cause can explain refuses with model-mismatch and names no cause', () => {
    const input = {
      ...example,
      checks: [
        {
          id: 'only-check',
          cost: 5,
          outcomes: ['ping', 'pong'],
          likelihoods: {
            tooling: { ping: 0, pong: 1 },
            'material-lot': { ping: 0, pong: 1 },
            fixture: { ping: 0, pong: 1 },
          },
        },
      ],
    };
    const result = nextCheck(input, [
      { id: 'obs-1', checkId: 'only-check', outcome: 'ping' },
    ]);
    const { recommendation, receipts } = result;
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].status, 'model-mismatch');
    assert.deepEqual(recommendation, { status: 'stop', reason: 'model-mismatch' });
    assert.ok(!('experimentId' in recommendation), 'refusal must not name a check');
    const text = JSON.stringify(recommendation);
    for (const cause of ['tooling', 'material-lot', 'fixture']) {
      assert.ok(!text.includes(cause), `refusal must not name cause ${cause}`);
    }
    // The screen must not name one either: nothing before the receipt lines
    // may read as a belief.
    const screen = formatResult(result);
    const beforeReceipt = screen.split(/^receipt /m)[0];
    assert.ok(!beforeReceipt.includes('posterior over causes'), 'mismatch screen must not print a posterior block');
    for (const cause of ['tooling', 'material-lot', 'fixture']) {
      assert.ok(!beforeReceipt.includes(cause), `mismatch screen must not name cause ${cause}`);
    }
  });
});
