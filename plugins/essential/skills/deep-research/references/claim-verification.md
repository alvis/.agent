# Adversarial Claim Verification

The stage that tests each load-bearing claim by trying to break it, rather than
only checking that sources agree. A claim survives into the report only when an
independent, skeptical panel fails to refute it. This replaces confidence-by-
convergence alone: agreement among weak or stale sources no longer promotes a
claim on its own.

## Falsifiable claims

Source analysis (workflow step 2) extracts, per source, the concrete claims
that bear on the research question. Each claim is:

- a **checkable statement**, not a vague generality — something a skeptic could
  look up and dispute;
- backed by a **direct supporting quote** from the source;
- rated **central / supporting / tangential** to the research question.

Record each claim with its source URL and the source's credibility class. Claims
with no verbatim support, or that merely restate the question, are not
extracted.

## Selecting claims to verify

Verification is per claim and costs a panel each, so bound it: rank the pooled
claims by importance (central before supporting before tangential), then by
source credibility, and verify at most the top **25**. Every central claim that
is load-bearing for a finding must be in the verified set; if the cap would drop
one, drop a tangential claim instead. Note any unverified-for-budget claims so
the report does not present them as confirmed.

## The three-vote panel

For each batch of ranked claims, dispatch **exactly three independent
adversarial-verifier subagents**. Each verifier votes **once per claim** — three
independent agents over the same claim give three independent votes. Keep at
most ~25 claims per verifier and each report under ~1000 tokens. The three
verifiers must not see each other's verdicts. Compose each first task handover
from [subagent-handover.md](../../../references/directions/subagent-handover.md):
put the skeptical checklist and output shape in Requirements, isolation in
Boundary, and only the assigned claim batch and source paths in Context.

Each verifier is instructed to be skeptical and to **try to refute** each claim,
returning per claim: `refuted` (boolean), `evidence` (specific, not generic),
`confidence` (high/medium/low), and any `counterSource` found. The verifier
checklist:

1. Is the claim actually supported by its quote, or is it an overreach or
   misread of the source?
2. Search for contradicting evidence — does any credible source dispute or
   heavily qualify it?
3. Is the source quality sufficient for the claim's strength? Extraordinary
   claims need primary sources.
4. Is the claim outdated? Old claims about fast-moving topics are suspect —
   check dates.
5. Is this a marketing claim, press release, cherry-picked benchmark, or forum
   speculation?

Vote `refuted=true` when the claim is unsupported by its quote, contradicted,
backed by a source too weak for its strength, outdated, or promotional. Vote
`refuted=false` only when the claim is well-supported, current, and matched by
adequate source quality. **Default to `refuted=true` when uncertain.**

## Adjudication — three outcomes

Count only votes actually cast (a verifier that times out or errors casts no
vote for that claim). Let `refutes` = refute votes and `valid` = votes cast:

- **Confirmed** — `valid ≥ 2` and `refutes < 2`. The claim survives into
  synthesis. Record its vote margin as `support-refute` (e.g. `3-0`, `2-1`).
- **Refuted** — `refutes ≥ 2` (two of three). The claim is killed: it does not
  become a finding. Keep it for the transparency section of the report.
- **Unverified** — fewer than two valid votes, so the panel could not
  adjudicate. This is an **infrastructure failure, not a refutation** — a claim
  whose verifiers all errored is neither confirmed nor refuted. Never let a
  failed panel read as "refuted." Carry these to the report's caveats.

If **no** claim is confirmed, distinguish the causes in the report: all-refuted
means sources were weak or claims overstated (research inconclusive); all-
unverified means the verifier panels failed (infrastructure failure — advise a
retry rather than reporting "nothing found").

## How this feeds synthesis and confidence

Synthesis merges and groups **confirmed claims only**. A finding's confidence
combines source credibility, convergence, and the vote margin: a unanimous `3-0`
across primary sources supports High; a split `2-1` or secondary-source support
caps it at Medium; single-source or blog-quality support is Low. Refuted and
unverified claims are reported for transparency but never raise a finding's
confidence.
