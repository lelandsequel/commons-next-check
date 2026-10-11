# Execution and evidence contracts

## Determinism

The integrated runner records Node, V8, operating-system platform, architecture, byte order, implementation version, the digest of every TypeScript file in `src`, and a separate digest of the executing source or compiled JavaScript tree. Exact verification refuses a different runtime or either fingerprint. Fresh execution supports Node 20 or newer; the recorded runtime matrix appears in `VERIFICATION.md`. Direct TypeScript execution, the modular compiled package and the standalone ESM file have different execution identities. Exact replay across these artifacts or across runtimes is not supported. The standalone file embeds the selected source fingerprint and hashes its own executed file; it does not require a source directory at runtime.

Canonical JSON sorts object keys and preserves array order. Finite binary64 numbers are supported, except integer values outside the safe range ±9007199254740991. Undefined values, nonfinite numbers, negative zero, sparse or extended arrays, unsupported object types, accessors and cycles are refused. JSON object names such as `__proto__` remain own data properties; parsing does not invoke setters. Individual domain schemas may restrict identifiers. Arrays are semantically ordered: changing observation order changes the recorded experiment.

At raw JSON boundaries, duplicate decoded object keys are refused before object construction. Number tokens must preserve their exact decimal value through native parsing and canonical serialization; equivalent spellings such as `0.10` and `1e-1` are accepted, but rounded integers, extra precision, underflow, overflow and negative zero are refused. Calculations still use binary64; this rule does not turn `0.1` into an exact binary fraction or promise arbitrary-precision arithmetic. All integer values outside the safe range are refused, including exactly round-tripping forms such as `1e20`. Canonical receipt generation enforces the same numeric restriction so it cannot emit such unverifiable values. An object supplied directly to an SDK function has already lost its textual spelling; the caller must use the strict text boundary before a permissive parser. Raw input is limited to 2,000,000 UTF-8 bytes and 128 nested containers. CLI and HTTP reject malformed UTF-8 rather than replacing bytes.

Budget arithmetic follows the extracted decimal contract. Bayesian and logarithmic calculations use binary64 native mathematics. Statistical uncertainty is about the declared model; deterministic evaluation is about replaying those same calculations.

No execution timestamp is silently inserted into a result. Policies use the explicit `asOf` input. Source retrieval is outside this runtime: URIs are references and are never fetched automatically.

## Discovery

Callers supply a finite hypothesis family, normalized priors and normalized likelihood rows. A zero prior excludes a hypothesis. Observations assume conditional independence given the hypothesis and experiment. Duplicate identifiers are refused. Exact decimal budget exhaustion is enforced.

Recommendations maximize one-step expected information per cost. They do not claim global optimality. Expected-loss action suggestions use caller-supplied losses, not an invented confidence score.

The adequacy monitor supports frozen finite conditional Bernoulli laws with strictly positive declared priors and commits its alternative prediction before seeing the outcome. It records the included and excluded hypothesis IDs, and never changes that support set with the posterior. `NOT_REJECTED` means insufficient evidence against this admitted family. It is not acceptance, calibration or proof that the real explanation was included. When the integrated monitor rejects the family, the output has `decisionStatus: DEFER`, no action suggestion, and a stop reason. An omitted monitor reports NOT_EVALUATED, and a valid nonbinary experiment reports UNSUPPORTED; both defer integrated action suggestions while preserving conditional posterior diagnostics. The workbench displays that refusal before its numerical diagnostics. The underlying posterior remains visible as a model-conditional diagnostic; after zero-support contradiction it is explicitly a pre-contradiction diagnostic. See `INFERENCE-CONTRACT.md` for the exact scope and receipt migration boundary.

Omitting adequacy reports `NOT_EVALUATED`; requesting the Bernoulli monitor for a valid nonbinary experiment reports `UNSUPPORTED`. Both retain the conditional posterior but set `decisionStatus: DEFER` and suppress integrated action suggestions. `AVAILABLE` requires a supported `NOT_REJECTED` monitor and no model mismatch; it does not validate the model. Lower-level `DiscoverySession.chooseAction` ranks conditional expected losses without this integrated gate.

The runner's 5,000-observation ceiling is subject to upfront conservative receipt budgets shared with the 100,000-node canonical cap and the 2,000,000-byte receipt cap. The bounds account for hypotheses, experiments, actions, quoted UTF-8 identifier lengths and both per-observation chains; excessive combinations refuse with `DISCOVERY_RECEIPT_LIMIT` before inference. Discovery/adequacy identifiers are limited to 256 UTF-16 code units. `INFERENCE-CONTRACT.md` gives both formulas and their scope.

The monitor can miss an incorrect model. Inherited research results do not establish performance on arbitrary real data. Adequacy receipts and posterior receipts remain separate chains inside the integrated receipt.


## Evidence and policies

Sources may include content and its canonical-JSON digest. A matching digest establishes that supplied content matches the commitment. It does not authenticate the author, prove an observation occurred, or prove that a fact was correctly extracted from that content.

Facts declare stable IDs, sources, values, optional units, explicit observed/expiry times, and dependencies. Facts sharing a claim ID conflict when their values or units disagree among records available after source, time, direct-reference and cycle checks. A directly expired, future, missing or invalid partner is excluded from that comparison. Conflict grouping precedes dependency-availability propagation, so a record whose dependency later becomes unavailable can still conservatively mark its partner CONFLICT. Dependency unavailability propagates. A declared lineage edge records a supplied dependency; it does not infer an explanatory relationship.

Policies contain conjunctive requirements on exact fact IDs: `exists`, `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, or `in`. Numeric comparisons do not coerce strings. Verdict precedence is ERROR > DENY > DEFER > ALLOW: malformed evidence is an error; a known false requirement denies; otherwise unavailable required evidence defers; all requirements must pass to allow. An empty policy cannot approve anything.

Threshold sensitivity evaluates whether a monotone numeric comparison holds for all values, no values, or only some values in a supplied closed interval. It is not probabilistic confidence or general multivariate sensitivity analysis.

## Receipts

Integrated receipts bind the complete input, computed output and runtime/source contract. Verification reports integrity as NOT_CHECKED until a digest comparison is actually performed, then VALID or INVALID. It checks the optional external digest and runtime before recomputing the result. Malformed raw input is NOT_CHECKED, not an asserted digest failure. A forged result with a freshly computed hash still fails replay.

An internally consistent, fully rewritten history can be replayed. An independently retained trusted digest is necessary to detect replacement or truncation relative to that retained history. Reading the expected digest out of the same untrusted receipt adds no trust.

`valid: true` without an expected digest means internal integrity and exact replay, with `anchoring: UNANCHORED`. It does not prove origin, historical completeness or factual truth. Policy-only `verifyReceipt` also requires its recorded implementation, Node, OS and architecture to match the current environment by default; `expectedEnvironment` adds a constraint and cannot override an unsupported environment. Its `integrityValid`/`replayValid` compatibility booleans are accompanied by explicit integrity/replay statuses. Only integrated receipts add the complete source/code/V8 fingerprint.

There are no cryptographic signatures, key management, public timestamp service or external ledger in this release.

An ALLOW report does not execute or enforce an action. Integrators must bind any real action to the evaluated artifact, policy and context at the time of execution. No universal enforcement claim is made.

## Local server

The workbench listens on 127.0.0.1, checks Host and Origin, uses a restrictive content-security policy, and accepts at most 2 MB per request. Static files are served from an explicit allowlist. It has no accounts or remote deployment features and should not be exposed publicly as a multi-user service.

## Work and export limits

The byte limit is not the only resource bound. Canonicalization visits at most
100,000 JSON nodes, nests at most 100 levels, and tracks emitted UTF-8 bytes as
each token is serialized; it stops at 2,000,000 bytes before joining a large
expanded result. Integrated and policy-only receipts also check their standard
two-space JSON plus newline export against that same 2 MB raw-input ceiling.
A request that would echo a large value through many policy rules therefore
refuses instead of constructing an unbounded receipt. An explicit refusal is
not an ALLOW or DENY result.

Evidence graphs admit at most 1,000 sources, 1,000 facts and 10,000 declared
dependency references, including missing references. Oversized graphs return
EVIDENCE_LIMIT before graph allocation. Iterative strongly connected components
produce one diagnostic per cyclic component; dependency availability propagates
through an incremental queue. Diagnostics are bounded by facts and edges, rather
than enumerating every overlapping cycle. Policies admit at most 1,000 rules.

Discovery additionally checks the expanded receipt budget before inference;
see INFERENCE-CONTRACT.md for the observation, identifier and byte limits.
These are supported workload boundaries, not confidence scores. Raw-text
limits and internal canonical limits are separate and all apply.
