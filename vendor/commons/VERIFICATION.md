# COSMIC Commons 0.2.2 — public edition validation

Prepared 2 October 2026. This candidate awaits independent validation of its exact
archive hash. Publication is performed by the owner after that gate. No public
upload, repository push or package reservation was performed by this build.

## Executed checks

All results below were obtained on **Linux x64** with real Node binaries. No new
macOS or Windows run is claimed. The execution target is Node 20 or newer; the
matrix is evidence for these versions, not every future runtime or platform.

| Node | Modular suite | Standalone suite | Examples + anchored replay, each form |
| --- | ---: | ---: | ---: |
| 20.0.0 | 106/106 | 107/107 | 5/5 |
| 22.0.0 | 106/106 | 107/107 | 5/5 |
| 24.15.0 | 106/106 | 107/107 | 5/5 |
| 24.18.0 | 106/106 | 107/107 | 5/5 |
| 24.19.0 | 106/106 | 107/107 | 5/5 |

Every suite completed with zero failures and zero skips. The modular checker used
clean package copies without `node_modules`. The standalone checker copied only
`cosmic-commons.mjs` into otherwise empty working directories. Those directories
still contained only that file after proof and example execution; requested
receipt outputs were written to a separate test directory. There was no resource
or code extraction and no runtime dependency installation.

Each execution form also passed all **20 ordered cross-runtime refusal checks**:
replay UNSUPPORTED, integrity VALID and trusted anchoring MATCH. Exact replay
requires the original artifact and recorded runtime.

Evidence: `verification/portable-runtime-results.json`,
`verification/standalone-runtime-results.json`, and their ten per-runtime
transcripts. Re-run with `scripts/check-portability.mjs` and
`scripts/check-standalone.mjs` using real Node executable paths. The downloaded
20.0.0, 22.0.0, 24.15.0 and 24.18.0 archives matched official SHA-256 manifests;
24.19.0 was supplied by the execution environment. See
`verification/node-download-provenance.json`.

## Standalone proof scope

The standalone file embeds **13 compiled correctness-test files** from this
edition. The only replaced file is `dist/tests/portable.test.js`: its two modular
package-layout checks become three standalone checks for direct SDK imports and
exports, actual executing-file/source identity, and embedded asset hashes.
All other shipped correctness tests are retained. This explains the difference
between the modular and standalone counts; no skipped test is counted as passed.
`BUNDLE-INPUTS.json` lists the embedded and replaced test files exactly.

All eight historical regression fixtures survive under neutral
`tests/fixtures/regression/` paths with their bytes and hashes unchanged.
`provenance/REGRESSION-FIXTURES.json` supplies their exact identities. The two
zero-prior cases both DEFER with no action. The integer/underflow inputs refuse
before a policy verdict. Duplicate receipt keys refuse before integrity checking
on the text SDK, CLI and raw/envelope HTTP paths. The clean historical receipt
retains hash integrity but cannot exactly replay under this implementation.
These cases run within the suites above, including standalone execution.

## Reproducible compilation and bundle

A fresh locked dependency installation followed by strict TypeScript compilation
reproduced **64/64 JavaScript/declaration files byte for byte**. Compilation
checks also matched on all five runtimes. Development dependencies are pinned to
TypeScript 5.9.3, Node declarations 20.19.0 and esbuild 0.25.12, with transitive
integrity records in `package-lock.json`. None is a runtime dependency.

The standalone builder takes the selected `dist/` code, exact embedded source,
fixtures, examples, web assets and adapter inputs. `BUNDLE-INPUTS.json` records
their hashes. `node scripts/build-bundle.mjs --check` regenerates and compares both
the complete file and its input manifest. The JavaScript-only bundle stage uses
an explicit empty compiler configuration: ambient TypeScript settings cannot
intermittently add strict-mode directives to the emitted ESM.

**100/100 final byte-identity checks passed**, 20 per runtime across all five
versions, comparing both the bundle and its input manifest. Results are in
`verification/bundle-reproducibility.json` and its transcript. The compiled build
record is `verification/build-reproducibility.json`. Earlier exploratory output
is not presented as evidence for this final bundle.

## Browser behavior

The modular workbench passed **24/24 real Chromium cases** (18 discovery/format
and 6 receipt cases) on Node 24.19.0 and Chromium 153.0.8010.0, Linux x64.
There were no page or console errors. Screenshots were visually reviewed for
prominent non-green DEFER, honest conditional diagnostics, neutral NOT_CHECKED,
raw-upload refusal and mobile layout. Evidence and rerunnable harnesses are in
`verification/browser-discovery/`, `verification/browser-receipt/` and
`verification/browser-gate.txt`.

The public standalone file additionally passed **7/7 isolated browser cases**:
all five included examples, receipt download followed by raw anchored upload,
and a duplicate-key upload refusal. Only the single file was present before and
after. No page errors, console errors or external requests occurred. Its exact
bundle hash, results, screenshots and rerunnable harness are under
`verification/browser-standalone/` and `verification/browser-standalone-check.mjs`.

The selected public source and build inputs were compared with a fresh projection
from the canonical source. See `verification/source-projection-results.json`.

## Frozen implementation

```text
sourceDigest  aee2fd44a7b399e767cb353ff075fd7bbf5791ab60d7e52a9e0dd87e9962eb6b
codeDigest    1226e6f019a10386959a0115f41db91eeba925b7c2cfcffdcf00a76aa600d397
bundleSHA256  76716bd3de1a96cf0d4c739a53009fb541e36a1c3c159c4bae25919b91bfceb7
bundleBytes   434803
```

The modular `codeDigest` binds executed modules; the standalone one binds the
whole executing `.mjs` file and uses an implementation ending in `/standalone`.
Both commit the same selected TypeScript source bytes. These execution forms are
deliberately distinct replay artifacts. A changed bundle, changed source, changed
module tree or incompatible runtime cannot silently exact-replay an old run.

The standalone reserved virtual resource path refuses access if a real directory,
file or dangling symlink occupies `.cosmic-embedded-assets` beside the file.
It does not silently substitute embedded bytes for a real user file.

`CHECKSUMS.sha256` covers the delivered candidate, and `VERIFY-PACKAGE.mjs` checks
the exact file inventory and bytes. The separate handoff binds the archive hash.
Check the manifest before installing development tools or regenerating evidence.
Checksums establish integrity, not a signature or independent factual truth.
