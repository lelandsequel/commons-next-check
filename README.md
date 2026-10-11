# commons-next-check

A free local face on the public COMMONS engine (0.2.2, Apache-2.0).
Causes and checks in; the next check, or a plain refusal, out.
This prints the public engine's recommendation, not a new result.

The engine in `vendor/commons` is the published tree
`github.com/jourdanlabs/cosmic-commons` at `ef76b3a`, unchanged.
Node 20 or newer. Exact replay of a receipt needs the same Node, V8, and machine kind recorded in that receipt.

## Run

`node next-check.mjs examples/three-causes.json`

With an observation:

`node next-check.mjs examples/three-causes.json --observe examples/observation.json --receipt-out receipts/obs-1.json`

Tests: `node --test tests/next-check.test.mjs`

Cause means engine hypothesis; check means engine experiment.
Likelihoods are declared by you in the input file. The face learns nothing.

## The four refusals

- `budget-exhausted`: no money left for another check.
- `posterior-threshold`: one cause is past the stop line you declared.
- `no-informative-experiment`: nothing left is worth what it costs.
- `model-mismatch`: the list of causes is not enough. Never a root cause.

## Notes

- The receipt is the engine `EvidenceReceipt` from `observe()`, rechecked with `replaySession`.
- Receipt hashes are content hashes, not signatures.
- A receipt file is written only when the path does not already exist.
- `examples/` is declared fiction: made-up names and likelihoods, not plant measurements.
- License: Apache-2.0.
