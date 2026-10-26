# M6 — Learning journey: scope (proposal)

Issue: #23. Research: `docs/superpowers/research/2026-10-26-investor-levels-and-learning-science.md` (§5 rubric, §6 constraints, §7 measures).
Status: **Building v1 with the recommended defaults** (Learn tab + contextual links later; cost literacy first; branched from `main` after M5). Override in the PR if you disagree. Satisfies the issue's "needs scoping" gate.

## Goal

Help a user learn the decision in front of them, using the tool's own engine for answers. Recommend, never gate. No claim that it improves returns.

## In scope (v1, three slices, one PR each, < 400 lines)

| Slice | Delivers | Evidence basis |
|---|---|---|
| **A. Self-located rubric** | "Learn" tab. Four competency rows (research §5); user picks the one that fits what they can already do. No score, no diagnosis, no lock on any tab. Choice stored locally. | Stage models are heuristics, not measures — wayfinding only |
| **B. One module end-to-end: cost literacy** (3–6 min, beside the fee/cost inputs) | Worked example → retrieval task answered *in the tool* (engine computes truth) → confidence rating → three-part feedback (where going / how going / where next) → one implementation-intention sentence → "what this does not show" footer. | Retrieval, worked examples, calibration, implementation intentions, feedback |
| **C. Spaced return** | On next visit, one unannounced retrieval item from a past module, due at 7 then 30 days. Passive banner only; no push, no streaks. | Spacing; decay finding |

Storage: one `learning` object inside storage v2 (`rubricChoice`, per-module `{completedAt, confidence, correct, intention, nextDue}`). Included in export/import. Local only, no telemetry.

## Out of scope

Gating, levels-as-badges, streaks, points, certificates, AI tutor/profiling, learning-styles, accounts, notifications, any outcome claim. Built in the same PR after review feedback: modules 2–5 (correlation, required minimum distributions, 80% guardrail, withdrawal sequencing), each graded by the app’s own engine function (RMD, `guardrailSpend`, `withdrawalSequence`) or a closed form, with hand-computed test oracles. Deferred: contextual links from the fee/RMD/allocation fields.

## Acceptance

- Every module answer is checked against the engine's value, computed independently in the test (numeric oracle, spec §4); an error path cannot pass.
- Zero axe violations on the Learn tab; keyboard operable; no colour-only meaning; 16px body text; reduced motion respected; `DESIGN.md` tokens only.
- No tab is disabled or hidden by rubric choice (E2E asserts all tabs usable with no rubric picked).
- Export → clear → import round-trips learning state.
- Disclaimer and "honest limits" present on every module.

## Measures (post-ship, local self-check only)

Pre/post retrieval items and 7/30-day retention per research §7; reported to the learner as capability statements, not percentages.

## Decisions (defaults taken; contextual links from fee/RMD/allocation fields deferred)

1. **Placement:** new "Learn" tab plus contextual links from fee/RMD/allocation fields (recommended) vs. contextual panels only.
2. **First module:** cost literacy (recommended: lowest dependency on unfinished engine work) vs. withdrawal-rate arithmetic.
3. **Sequencing:** branch from `main` after M5 (#11) merges, since Slice A/C extend storage v2 (recommended) vs. branch from the M5 branch now.
