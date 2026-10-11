# Portable build and replay contract — Commons 0.2.2

This package contains TypeScript source, compiled JavaScript and the standalone
`cosmic-commons.mjs` ESM file. Both execution forms need only Node at runtime:
no TypeScript support, npm installation, network service or license key.

## Standalone execution

Copy `cosmic-commons.mjs` by itself into an otherwise empty directory:

```sh
node cosmic-commons.mjs doctor
node cosmic-commons.mjs prove
node cosmic-commons.mjs examples
node cosmic-commons.mjs demo discovery-deferred --out receipt.json
node cosmic-commons.mjs verify receipt.json --expect YOUR_RETAINED_SHA256
node cosmic-commons.mjs serve
```

The file embeds the selected examples, browser assets and proof checks. It does
not unpack them into temporary directories or require companion files. Writing a
requested receipt with `--out` is an explicit output operation. Reading a caller's
input file with `run` or receipt file with `verify` requires that supplied file.

The standalone file reserves `.cosmic-embedded-assets` beside itself as a virtual
resource namespace. If a physical entry exists at that path, including a dangling
symlink, asset access refuses with `EMBEDDED_ASSET_NAMESPACE_COLLISION`; a real
input is never silently replaced with an embedded example. Use a directory without
that reserved entry.

Standalone `prove` runs the embedded correctness suite against the bundled
implementation. Package-layout checks are replaced by standalone import,
executed-file commitment and embedded-asset integrity checks. `VERIFICATION.md`
records the exact checks, their results and the isolated-directory evidence for
this candidate. A reported standalone pass does not claim the full source test
suite was available beside the file.

## Modular execution

Keep the modular package together: `bin/` starts `dist/src/`, examples and web
assets live at the package root, and run receipts hash the shipped `src/` tree
as well as the executed code.

```sh
node bin/cosmic.mjs doctor
node bin/cosmic.mjs prove
node bin/cosmic.mjs demo discovery-deferred --out receipt.json
node bin/cosmic.mjs verify receipt.json --expect YOUR_RETAINED_SHA256
node bin/cosmic.mjs serve
```

The modular `prove` command runs every compiled correctness test shipped in the
selected edition, including the neutral regression fixtures. These tests run
without installing development dependencies.

The package's shared ESM exports (`@cosmic/commons`, `/inference` and `/policy`)
resolve to compiled JavaScript with matching declaration files. The standalone
file also exports the selected root SDK API; importing it does not start the CLI.
TypeScript sources remain available for review and rebuilds.


## Runtime compatibility and validation

The execution target is Node 20 or newer. `.nvmrc` records the reference runtime,
Node 24.19.0; it is not an execution restriction. This is a compatibility target,
not a claim that every future Node release or every platform has been validated.
An old runtime used to test a compatibility boundary is not a recommendation to
install that old runtime for general use.

`VERIFICATION.md` and the supplied verification evidence identify the actual
runtime versions, platforms, test counts, example counts and replay refusals for
this artifact. Results from an earlier version or another edition do not stand
in for this candidate's checks.

To rerun the modular runtime matrix, supply real Node executables:

```sh
node scripts/check-portability.mjs /path/to/node20 /path/to/node24.15 /path/to/node24.18 /path/to/node24.19
```

The checker copies shipped runtime resources, verifies that `node_modules` is
absent, runs `prove`, runs and anchors the included examples, and checks
cross-runtime refusals. Tests that exercise the server use local HTTP.

## Complete, reproducible build inputs

The package includes `src/`, `tests/`, `tsconfig.json`, the build scripts,
`package.json` and `package-lock.json`. Development dependencies are pinned:
TypeScript 5.9.3, `@types/node` 20.19.0 and esbuild 0.25.12; transitive packages
are recorded in the lockfile. There are no runtime npm dependencies.

```sh
npm ci --ignore-scripts
npm run build
npm run build:check
npm run bundle
npm run bundle:check
node bin/cosmic.mjs prove
node cosmic-commons.mjs prove
```

`npm ci` downloads development dependencies when they are not cached. The builds
then use local files. `scripts/build.mjs` type-checks in strict mode, compiles
source and tests, rewrites relative TypeScript imports to JavaScript imports, and
emits JavaScript plus declarations in `dist/`. It does not generate timestamps,
absolute build paths or source maps.

`node scripts/build.mjs --check` builds in a temporary directory and compares the
complete file list and contents against the delivered `dist/` tree. A failed
comparison exits nonzero.

`scripts/build-bundle.mjs` builds the standalone ESM artifact from compiled
`dist/` code with the pinned esbuild version. This JavaScript bundling stage
uses an explicit empty TypeScript configuration so an ambient `tsconfig.json`
cannot change its output. The shipped source, `standalone/` adapters, build scripts, compiled code and
tests, examples, web assets, fixtures and package metadata provide its build
inputs. The bundle
embeds the selected source fingerprint and runtime resources. `BUNDLE-INPUTS.json`
records the exact hashed build inputs.

```sh
node scripts/build-bundle.mjs --check
```

The bundle check regenerates its output and requires byte identity with both
`cosmic-commons.mjs` and `BUNDLE-INPUTS.json`; it exits nonzero on a mismatch. This is a build-time
check requiring the development dependencies and full package. Standalone
runtime `prove` is a separate command requiring only the single file and Node.
See `VERIFICATION.md` for the candidate's actual reproducibility results.

## Exact replay remains strict

Running on several Node versions does not make their results interchangeable for
exact verification. An integrated run receipt records exact Node and V8 versions,
operating system, architecture, endianness, implementation version, source digest
and executed-code digest. Verification compares these before replay. Different
runtimes or source/build artifacts produce `UNSUPPORTED`; there is no
tolerance-based exact replay pass.

For modular execution, `sourceDigest` hashes the TypeScript source tree and
`codeDigest` independently hashes the modules actually executed: compiled `.js`
for the distributed CLI/SDK, or `.ts` for an explicitly invoked native-TypeScript
source run. The standalone file embeds its selected source commitment, uses an implementation
identifier ending in `/standalone`, and sets `codeDigest` to the SHA-256 of its
whole executing file. It does not read a neighboring
source tree. The bundle and modular package therefore produce distinct replay
artifacts, even when they implement the same calculation.

Retain the exact artifact and runtime that created an old receipt. Changing
compiled code or the bundle without changing the corresponding TypeScript still
changes the execution commitment and refuses the old receipt.

Direct `DiscoverySession`/adequacy receipts record runtime context and rely on
the caller to retain the same source artifact. The complete run-envelope API
adds the source and executed-code hashes described above. Neither kind of
receipt is a signature or a substitute for a trusted external digest.

## Preserve the delivered artifact

Check `node VERIFY-PACKAGE.mjs` before installing development tools or generating
new files inside the package. The manifest covers delivered files; rebuilding or
writing evidence can change the checked tree. Use a review copy and preserve the
original archive as the candidate under validation.

The local workbench is a loopback application. Browser automation, when used for
validation, is external QA tooling; it is not needed to run the workbench.
Actual browser versions and results belong to the candidate's verification
record, not a portability claim for all browsers.
