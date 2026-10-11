# COSMIC Commons 0.2.2

A local SDK, command-line tool and browser workbench for explicit reasoning and
verifiable decisions. The package includes TypeScript source, compiled JavaScript
and a standalone JavaScript file. It uses Apache-2.0; see `LICENSE` and `NOTICE`.

This is a release candidate. Publication requires independent validation of the
exact archive hash. The owner selects the destination and publishes the cleared
artifact. `VERIFICATION.md` records the checks actually performed on this build.


## Start with Node only

The shipped JavaScript runs on Node 20 or newer, with no installation step,
runtime npm dependencies, account, API key, model call or hosted service.
Node 24.19.0 is the reference runtime selected by `.nvmrc`.

Copy only `cosmic-commons.mjs` to a directory and run:

```sh
node cosmic-commons.mjs doctor
node cosmic-commons.mjs prove
node cosmic-commons.mjs serve
```

The standalone file contains its examples, workbench assets and embedded proof
checks. It runs without the rest of this package and does not extract those
resources to disk. Open **http://127.0.0.1:4317**, choose an example and press Run.
Inspect the result, download its receipt, and upload it to verify. The server
binds to your own computer.

The full package provides the same commands through `node bin/cosmic.mjs`.
Keep that package together: its CLI uses `dist/`, source fingerprints, examples
and web assets. Its `prove` command runs the complete shipped correctness suite;
the standalone `prove` command runs the embedded correctness suite with
standalone replacements for package-layout checks, documented separately in
`VERIFICATION.md`. On macOS, `Start-Commons.command` starts the full package's
workbench after Node is installed.

## Included capabilities

- Finite-family Bayesian updates, greedy experiment selection by expected
  information per cost, and caller-defined expected-loss action suggestions.
- A prepare-before-observe adequacy monitor for declared binary observation laws.
  Its frozen null family excludes zero-prior hypotheses, matching the inference
  contract. Rejection, zero-support contradiction, an omitted monitor or an
  unsupported observation model produces DEFER and suppresses integrated action
  suggestions.
- Evidence values, source-content digests, dependency lineage, time-based
  availability, conflict detection, and declarative ALLOW/DENY/DEFER/ERROR
  policies with per-rule explanations.
- Exact replay within the recorded runtime and implementation, optionally
  anchored to an independently retained digest.
- Raw JSON validation before computation or verification: duplicate decoded
  keys, number literals whose decimal value changes during parsing, and all
  integers outside ±9007199254740991 are refused. Browser formatting uses the
  same boundary.


No full-suite orchestration is included. The selected source inventory is in
`provenance/RELEASE-SELECTION.json`.

## Examples

These five examples cover discovery and evidence policies:

```sh
node cosmic-commons.mjs examples
node cosmic-commons.mjs demo sensor-investigation --out output/sensor.receipt.json
node cosmic-commons.mjs verify output/sensor.receipt.json
node cosmic-commons.mjs demo discovery-deferred
node cosmic-commons.mjs demo release-authorization
node cosmic-commons.mjs demo release-deferred
node cosmic-commons.mjs demo release-denied
```

The sensor example gives posterior probability 16/17 for the positive candidate
after two positive measurements, conditional on its declared likelihoods. Its
expected-loss action remains `investigate`. The rejected-family example includes
a zero-prior decoy that fits every observation; that excluded law cannot rescue
the active models, so the result is DEFER with no action. Posterior numbers stay
visible as conditional diagnostics.

The release examples exercise ALLOW, DEFER and DENY. All example evidence is
synthetic. A source digest does not authenticate a reviewer or measurement, and
an ALLOW report executes no action.


## Your inputs and receipts

```sh
node cosmic-commons.mjs run my-input.json --out my-receipt.json
node cosmic-commons.mjs verify my-receipt.json --expect YOUR_RETAINED_SHA256
```

Use an expected digest kept independently of the untrusted receipt. Without it,
successful verification establishes internal consistency and replay only.
Runtime or implementation differences refuse exact replay. The standalone file
and modular package have different execution identities: use the same artifact
that produced a receipt to verify it. Generate a fresh receipt when changing
artifacts or runtimes; do not rewrite an old receipt's metadata.

`--out` creates a new file exclusively. Existing files, directories and leaf
symlinks refuse, including an attempt to overwrite the input. Parent directories
follow ordinary filesystem path resolution.

CLI exit codes are 0 for successful computation/verification, 1 for a failed
verification or test suite, and 2 for invalid invocation/input or unsupported
execution. A malformed `--expect` exits 2; a well-formed but wrong digest exits 1.
A computed policy report may itself be DENY, DEFER or ERROR; inspect its verdict
before acting.

## SDK

The modular package exports compiled JavaScript and generated TypeScript
declarations. The standalone file exports the same selected API and can also be
imported directly from `./cosmic-commons.mjs`. For a modular local checkout:

```js
import { readFileSync } from 'node:fs';
import { parseStrictJson, runRequest, verifyRunText } from './dist/src/index.js';

const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  .decode(readFileSync('./examples/release-authorization.json'));
const receipt = runRequest(parseStrictJson(raw));
console.log(receipt.result);
console.log(verifyRunText(JSON.stringify(receipt), receipt.digest));
```

The digest in this small example comes from the new local computation. For
external receipts it must come from an independently trusted channel.

Use `parseStrictJson` before object APIs when receiving external JSON, and
`verifyRunText` or `verifyReceiptText` for external receipt text. Object APIs
operate on already represented binary64 values; they cannot recover keys or
precision discarded by a caller's earlier parse. Ordinary decimal literals such
as `0.1` are accepted; `0.10000000000000001` and `9007199254740993` are refused
because native parsing changes their decimal value. This is a loss-detection
boundary, not arbitrary-precision decimal arithmetic. Even exactly represented
integers outside the safe range are refused; generated receipt values obey the
same restriction. Requests and receipt exports have explicit node, byte and work
limits, documented in `docs/CONTRACTS.md`.

Lower-level policy receipts, discovery receipts and integrated run receipts
have distinct schemas. See `docs/CONTRACTS.md`, `docs/INFERENCE-CONTRACT.md` and
`docs/INTEGRATION-CAUTIONS.md` for their boundaries. The integration guide explains
null/type/Unicode comparisons, caller-selected time, process exit codes and the
separate meaning of each verification field.

## Prove and rebuild

Verify the delivered package before generating files inside it:

```sh
node VERIFY-PACKAGE.mjs
node bin/cosmic.mjs prove
node cosmic-commons.mjs prove
```

The archive includes runnable JavaScript, source, tests, compiler configuration,
build scripts and the dependency lock. Rebuilding requires the pinned development
dependencies; running and proving the shipped build does not. Follow
`docs/PORTABLE-BUILD.md` for both build procedures and byte-identity checks.

This standalone package does not modify or claim integration into any existing
application checkout.
