---
name: deep-research
description: Conduct comprehensive multi-source research with AI-assisted analysis, adversarial claim verification, and explicit source synthesis. Use when investigating complex topics, comparing evidence, gathering current information, or producing a fact-finding report with citations and uncertainty notes. Do not use for metric-driven candidate optimization.
model: opus
argument-hint: "<research-topic> [optional-focus-area]"
---

# Deep Research

Systematic multi-source fact-finding: analyze sources in parallel, iteratively
discover new ones from what they reveal, adversarially test each load-bearing
claim before it can enter the report, and synthesize a cited report with
explicit confidence ratings and knowledge gaps. Metric-driven candidate
optimization belongs to `essential:autoresearch`.

## Boundaries

- Use for: investigating complex or multi-domain topics, comparing evidence
  across sources, gathering current information, and producing a fact-finding
  deliverable with citations, confidence ratings, and uncertainty notes.
- Do not use for: questions a single web search answers, optimizing candidates
  against a scoreable metric (`essential:autoresearch`), or any output without
  source attribution — every finding must trace to its sources.

## Inputs

- **Required**: a research topic (`$ARGUMENTS`).
- **Optional**: a focus area narrowing the topic's scope.
- **Prerequisites**: `WebSearch`/`WebFetch` available for external topics;
  restricted or non-public topics are declined with a suggested public
  reframing.

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the active work directory from
that contract.

## Workflow

Steps 2, 3, and 4 dispatch subagents per
`plugins/governance/standards/delegation/`; skill-specific
bounds are stated at each step. Compose each first task handover from
[subagent-handover.md](../../references/directions/subagent-handover.md), with
source batches or claims in its task-specific Context.

1. **Plan the run.** Parse the topic and optional focus from `$ARGUMENTS` and
   pick the source strategy by topic type — technical/scientific: academic
   papers, documentation, code repositories; historical: primary sources,
   archives, temporal progression; current events: recent news and real-time
   updates; theoretical: foundational texts balanced with recent work;
   product/market: industry reports, user feedback, competitive analysis.
   Create `artifacts/research/<topic-slug>/` under the active work directory,
   with `source-tracker.md` listing each source's URL/path, credibility class
   (Academic/Official/Industry/Community), discovery level, discovered-from
   source, and status (pending/analyzing/analyzed/failed). If the tracker
   already exists, resume instead: keep completed analyses and continue from
   every `pending` or `analyzing` source.
2. **Analyze sources in parallel.** Dispatch source-analysis subagents — at
   most ~10 sources per subagent, independent batches in one parallel message,
   each report under 1000 tokens. Each subagent reports, per source: key
   information relevant to the topic, cross-source patterns and themes,
   contradictions and debates, new insights naming candidate sources for
   further research, and the source's **falsifiable claims** — concrete,
   checkable statements bearing on the topic, each with a direct supporting
   quote and an importance rating (central/supporting/tangential) per
   [references/claim-verification.md](references/claim-verification.md).
   Update `source-tracker.md` after every returned analysis —
   the tracker is the checkpoint that makes the run resumable. A subagent that
   times out marks its sources `failed`; continue with the available data.
3. **Iterate on discoveries.** When an analysis surfaces an unfamiliar concept,
   a referenced work, an understanding gap, or a contradiction needing more
   context: add the discovered sources to the tracker immediately with their
   discovery level and origin, dispatch analysis for high-relevance ones first
   (priority = relevance + credibility), and record the connection chain
   (source → insight → new source). Bounds that keep the run convergent: at
   most 3 discovery levels; near-duplicate sources are checked for content
   similarity before analysis and recorded as duplicates; circular references
   are documented, never re-analyzed. Stop iterating early once convergent
   evidence from multiple credible sources answers the research question; if
   no sources are found at all, widen the search parameters once before
   reporting the gap.
4. **Adversarially verify claims.** Do not promote claims on convergence alone;
   test them. Pool the extracted claims, rank them, and run a three-vote
   skeptical panel per claim exactly as
   [references/claim-verification.md](references/claim-verification.md)
   specifies: dispatch three independent adversarial-verifier subagents (one
   vote per claim each, ~25 claims max per verifier, each report under ~1000
   tokens), each trying to refute. A claim is **refuted** when at least 2 of 3
   votes refute it — it cannot become a finding; **confirmed** when it has ≥2
   valid votes and fewer than 2 refute; **unverified** when fewer than 2 votes
   were cast (an infrastructure failure, never a refutation). Record each
   claim's outcome and vote margin (`support-refute`) in the tracker. Carry
   refuted and unverified claims forward for the report's transparency and
   caveats sections rather than dropping them silently.
5. **Synthesize.** Merge and group **confirmed claims only**; refuted and
   unverified claims never enter findings. Resolve remaining conflicts by source
   priority (credibility class, then convergence). Apply the synthesis
   framework: convergent evidence (multiple sources supporting one conclusion),
   divergent perspectives (contrasting viewpoints kept with their context),
   confidence scoring per the rule in
   [references/deliverable-format.md](references/deliverable-format.md) (which
   folds in the vote margin), and explicit knowledge gaps wherever evidence is
   insufficient.
6. **Write the deliverable** as `report.md` in the research directory, following
   the section order and confidence rules in
   [references/deliverable-format.md](references/deliverable-format.md), and
   remove temporary scratch files so only the tracker, findings, and
   deliverable remain.
7. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- Every source marked `analyzed` in `source-tracker.md` has a summary, and
  every discovered source is tracked with its level and origin.
- Discovery chains are valid: each level 2+ source traces back through
  source → insight → new source.
- Every finding traces to a **confirmed** claim (≥2 valid votes, fewer than 2
  refutes); no refuted or unverified claim is presented as a finding.
- Each verified claim records its outcome and vote margin; unverified claims are
  attributed to panel failure, never conflated with refuted ones.
- Every finding cites its sources; contradictions are documented rather than
  silently resolved; gaps are stated explicitly.
- The deliverable contains every section required by
  [references/deliverable-format.md](references/deliverable-format.md),
  including the refuted- and unverified-claim sections.

## Completion

Deliver the report and state: total sources analyzed (initial vs discovered,
and depth reached), claims verified with confirmed/refuted/unverified counts,
overall confidence with its basis, the key findings in one line each, and the
open research gaps. If every claim was refuted, report the research as
inconclusive; if every panel failed (all unverified), report the
infrastructure failure and advise a retry rather than "nothing found." A partial
or blocked run still reports the tracker state, what was analyzed, and the
blocker — the tracker makes the run resumable later. Return explicit final paths generated or materially
rewritten as `generated_files`; the PM size-checks only eligible work Markdown
inside the target `.state/`.
