# Integration decisions that must stay explicit

Commons computes a scoped report. A process exit code, posterior weight or
matching hash does not authorize an external action.

| Interface | Exact behavior | Integrator responsibility |
| --- | --- | --- |
| `exists` | Passes for an available fact whose value is null, false, zero, an empty string, or any other supported JSON value. It checks presence, not truthiness or type. | Use explicit value requirements when null or an empty value is unacceptable. |
| `eq` / `ne` / `in` | Compare canonical JSON values without coercion. Null differs from a number; a string differs from a number. `ne` can therefore pass across types. | Enforce an expected type upstream if equality across arbitrary JSON types is not your policy. |
| Text | No Unicode normalization, case folding or trimming is applied to fact values. NFC and NFD spellings can compare unequal; `ne` may pass. | Choose and record a normalization contract before evidence enters Commons if the domain needs one. |
| Ordered predicates | `gt`, `gte`, `lt`, `lte` require numeric operands. Type mismatch gives ERROR. Unsafe integers and lossy raw numeric tokens refuse at the trust boundary. | Supply supported numeric values; do not pre-parse external JSON with a permissive parser. |
| `asOf` | The caller selects the UTC instant used for expiry and future-evidence checks. Commons does not consult a trusted clock. | Bind time to the actual authorization context and authenticate it where the application requires that. |
| `run` exit status | A successfully computed DENY, DEFER or ERROR report exits 0. Invalid invocation/input exits 2. | Inspect `receipt.result.verdict` or discovery `decisionStatus` before proceeding. Never deploy solely because `run` exited 0. |
| `verify` exit status | Valid verification exits 0; failed verification exits 1; malformed `--expect`, unreadable files or invalid invocation exit 2. | Require the intended integrity, replay and anchoring statuses. A valid but unanchored receipt establishes self-consistency only. |
| `--out` | Creates a new file using exclusive creation. Existing files, directories, symlinks and input aliases refuse. Parent directories follow normal filesystem resolution. | Choose the destination deliberately. To replace an old artifact, archive/remove it explicitly first; there is no implicit overwrite flag. |
| Discovery action | Integrated actions require supported NOT_REJECTED adequacy and no mismatch. Omitted/unsupported adequacy yields DEFER. Lower-level `chooseAction` ranks conditional expected losses without this gate. | Keep adequacy and authorization explicit when assembling your own SDK workflow. |
| Receipt environment | Integrated replay requires the recorded runtime and both source/code fingerprints. Policy-only exact replay requires the current declared environment by default; an expected environment cannot override compatibility. | Retain the original artifact/runtime for old receipts. Modular and standalone execution have distinct identities. Do not edit or rehash old runtime fields to manufacture a match. |

Conflict detection considers claim records available after source, time,
direct-reference and cycle checks. Directly unavailable records are excluded.
Dependency availability propagates after conflicts are grouped; this can
conservatively retain a conflict involving a record with an unavailable
dependency. The resulting DEFER is not evidence that either claim is true.

Integrations receiving raw JSON must use `parseStrictJson`, `verifyRunText` or
`verifyReceiptText` before an ordinary parser discards duplicate keys or rounds
numbers. Decode bytes with a fatal UTF-8 decoder. An already parsed object cannot
reveal the spelling or bytes a caller discarded earlier.
