# Discovery and model adequacy in Commons 0.2.2

A declared prior of zero excludes a hypothesis from discovery inference. Adequacy
now uses the same exclusion: its null family contains exactly the hypotheses with
strictly positive priors in the original declaration. The set is frozen when the
monitor is constructed. Posterior changes cannot add or remove a null law.

Every positive prior is included, however small. Prior magnitudes do not weight
the adequacy denominator. The full input declaration remains hash-bound, while
the monitor's identity, prepared predictions, receipts and snapshot explicitly
record `supportPolicy`, `nullHypothesisIds` and
`excludedZeroPriorHypothesisIds`. `effectiveNullLaws` contains only admitted laws.
A zero-prior law therefore cannot shield an inadequate active family. Giving a
law a positive prior intentionally admits it and broadens the tested family.

For the frozen admitted family H, the monitored statistic is
`E_t = Q_t / max_{h in H} L_{h,t}`. Q is a probability law built from predictions
committed before each observation, using the per-experiment beta-half predictor.
Under any fixed true law h in H, E is pointwise bounded by `Q_t / L_{h,t}`. That
likelihood ratio is a nonnegative supermartingale (a martingale when the relevant
support conditions hold). The probability of ever crossing `1 / alpha` is thus at
most alpha in exact arithmetic. Experiment choice may depend on past outcomes.
The recorded maximum is a historical statistic, not itself an e-process.

This guarantee concerns the **effective normalized conditional Bernoulli laws**,
not an arbitrary physical mechanism. Approximate input probability rows within
the existing validation tolerance are normalized by preserving their smaller
tail and interpreting the other probability as its mathematical complement.
The effective laws and normalization policy are hash-bound. Native binary64
arithmetic is not a formal numerical proof of the exact-arithmetic bound.

The guarantee excludes zero-prior laws, unknown or fitted laws, parameter
families, automatic resets, and distributions that violate the declared
conditional-law assumptions. `NOT_REJECTED` means insufficient evidence against
the admitted family; it is not approval or proof that any admitted law is true.
The discovery posterior remains conditional on the caller's finite model.

When adequacy crosses the threshold, rejection is retained. An observation with
zero probability under every admitted law instead reports
`ZERO_SUPPORT_CONTRADICTION` and stops further monitoring. In the integrated
runner either result sets `decisionStatus: DEFER`, suppresses action suggestions,
and reports the stop reason.

The integrated runner always reports an adequacy status. Omitting the monitor
produces `NOT_EVALUATED`; requesting it for a valid experiment with more than two
outcomes produces `UNSUPPORTED` and names those experiments. These cases retain
the discovery posterior as a conditional diagnostic, but set
`decisionStatus: DEFER`, suppress action suggestions and provide a stop reason.
They do not abort an otherwise valid discovery run. Malformed options and invalid
model declarations remain errors. `AVAILABLE` requires a supported monitor in
`NOT_REJECTED` state and no model mismatch; it still means only that a conditional
action ranking is available, not that the model has been validated.

The lower-level `DiscoverySession.chooseAction` API ranks the caller's losses
using its conditional posterior. It does not attach an adequacy monitor or apply
the integrated runner's gate. Integrators using that API must provide their own
explicit adequacy/authorization policy; the ranking alone is not approval.

## Integrated receipt work limit

Discovery and adequacy identifiers are limited to 256 UTF-16 code units, including
model, hypothesis, experiment, outcome, observation, epoch and action IDs. The
integrated validator checks these before inference; the low-level session and
monitor APIs apply the same identifier contract.

An integrated request accepts no more than 5,000 observations, 100 hypotheses,
100 experiments, 100 outcomes per experiment and 100 actions. These are individual
ceilings, not a promise that their maximum combination fits. Before inference,
the runner also computes a conservative bound on the final receipt's JSON nodes:

`inputNodes + 512 + 8H + E(8 + 5H) + 4A + N(40 + H + M(128 + 10H))`

Here H is the number of declared hypotheses (including excluded ones), E the
number of experiments, A the number of actions, N the observation count, and M
is 1 when a requested Bernoulli monitor is supported, otherwise 0. The input node
count includes each object, array and primitive once. The fixed terms bound the
snapshots, recommendation, action ranking and envelope; per-observation terms
bound the posterior receipt and, when present, the adequacy receipt with its
prepared prediction. Bounds over 100,000 nodes are refused up front with
`DISCOVERY_RECEIPT_LIMIT`. This uses the same named limit as canonicalization and
avoids accepting a long observation chain that fails only while hashing its
expanded result. The bound is deliberately conservative and can refuse some
requests whose actual results would be smaller. It applies to the integrated
runner; the streaming lower-level session APIs retain their separate contracts.

The runner also checks a conservative bound against the 2,000,000-byte limit for
the final receipt, including two-space pretty printing. Each caller identifier is
first JSON-quoted and measured in UTF-8 bytes, so escaping and multibyte characters
are included. Define S_H as the summed hypothesis-ID bytes, S_E as the summed
experiment-ID bytes, S_O as the summed outcome-label bytes across experiments,
O_max as the largest outcome-label byte sum for one experiment, S_A as the summed
action-ID bytes, L as the model-ID bytes, K as the epoch-ID bytes (zero if absent),
and B_i as the summed observation ID, experiment ID and outcome bytes for
observation i. The bound is:

```
inputBytes = bytes(JSON.stringify(input, null, 2)) + 4 * inputNodes
fixedBytes = 32768 + 8*S_H + 4*S_E + 4*L + 4*K + 4*S_A + 256*A
             + E*(256 + 512*H + 4*S_H) + 4*H*S_O
posteriorBytes_i = 2048 + 64*H + S_H + 2*B_i
adequacyBytes_i = 8192 + 256*H + 12*S_H + 8*B_i + 4*K
                 + 4*(H+1)*O_max
totalBytes = inputBytes + fixedBytes
             + sum_i(posteriorBytes_i + M*adequacyBytes_i)
```

The fixed reserves cover schema keys, hashes, runtime fields, punctuation, finite
number spellings and indentation; caller strings are accounted for separately at
their repeated positions. Input indentation is increased to match its position
inside the receipt. A bound above the byte limit also produces
`DISCOVERY_RECEIPT_LIMIT` before inference. This estimate deliberately has slack;
it is a work/admission limit, not a prediction of exact output size. Canonical
encoding and final receipt serialization independently enforce the same byte cap.
Long identifier amplification therefore refuses before constructing either
observation chain. The regression suite exercises maximum admitted short-ID
chains, escaped/multibyte identifiers, and the 20,000-character-ID attack.

The changed family semantics use adequacy schema 2 and implementation
`@cosmic/commons-adequacy/0.2.2`. Old schema-1 adequacy receipts are refused by the
new exact replay helper. Run the original artifact to verify old receipts; do not
relabel or rehash them as new evidence. Discovery's existing evidence schema is
unchanged by this adequacy repair.

## Adequacy regression evidence

The original `with-zero-prior.json` and `without-zero-prior.json` regression
fixtures are shipped unchanged in `tests/fixtures/regression/adequacy/`. `tests/inference-scope.test.ts` runs
both and requires `REJECTED_DECLARED_FAMILY`, `DEFER` and no action. It also checks
the explicit absent/unsupported states and successful hashing at the largest
admitted chain lengths with and without a monitor.

`tests/inference-adequacy-adversarial.test.ts` additionally reconstructs the same
failure mechanism in a separate scenario; it is not an original fixture. Two active laws each predict a positive
outcome with probability 0.1. An excluded zero-prior decoy predicts it with
probability 1. After four positive observations, Q is 35/128. Commons 0.1.1
incorrectly used the decoy's likelihood of 1, reported `NOT_REJECTED` and
`AVAILABLE`, and suggested the zero-loss action. Commons 0.2.0 uses the active
maximum likelihood of 0.0001, so E is 2734.375 and the integrated result is
`DEFER` with no action. With alpha 0.05, rejection begins at observation 2.

The regression suite also checks unchanged statistics when an excluded law is
added, genuine positive-prior admission, zero-support contradiction, immutable
support selection, replay binding, and rejection of old-schema receipts.
