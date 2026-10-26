# REVIEW.md — Code review guide

How to review a change to Risk Parity Compass. Use it for human and agent reviews. The goal is to find **bugs**, catch **security** problems, and prove **correctness** — in that order of cost-of-miss.

This repo has already shipped ten Critical arithmetic defects behind green CI (`docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md`). Passing tests are not evidence. Reproduce, don't infer.

## How to review

1. Read the PR description and the linked issue/spec section (`docs/spec.md`, `docs/plan.md`).
2. `git diff main...HEAD`; read every changed line, not just the summary.
3. Run the gates (all with `env -u NODE_OPTIONS`): `npm test`, `npm run lint`, `npm run format`, `npm run build`, `npm run test:e2e`.
4. For any finance change, **execute the function** with realistic inputs and compare to a hand/closed-form value. Record the command and output in the finding.
5. Report findings with severity, `file:line`, a concrete failing scenario, and a suggested fix.

## Severity

| Level | Meaning | Action |
|-------|---------|--------|
| Critical | Wrong money maths, data loss, security hole | Block merge |
| High | Reachable bug or missing test for a financial output | Fix before merge |
| Medium | Maintainability, a11y or design-system deviation | Fix or ticket |
| Low | Style, naming | Optional |

## 1. Finding bugs

- [ ] **Rates and periods.** Annual rate applied per month? Every rate-taking function takes `periodsPerYear` and divides first; band decisions on year boundaries.
- [ ] **Units.** Dollars vs normalised-to-1. A simulation must start at the user's dollar value.
- [ ] **Compounding.** Withdrawals reduce the base before growth: `B(i+1) = max(0, B(i) − spend) × p(i+1)/p(i)`.
- [ ] **Tautologies.** A metric derived from itself (e.g. `successRate` computed at the SWR is always 1.0).
- [ ] **Vacuous tests.** `0 ≥ 0`, `assert true`, length-only checks, label-only E2E, assertions that pass on an error path.
- [ ] **Spreading non-objects** (`...someNumber` yields nothing → `undefined` cells, `$NaN`).
- [ ] **Annual vs monthly handoffs** between functions (RMD, spend, rates).
- [ ] **Short or misaligned history.** Missing timestamps, fewer points than the horizon, empty overlap — must degrade with `effectiveYears`, never zeros or `NaN`.
- [ ] **Stale async results.** An effect result applied to a different input set than it was computed for (a previous result read for a newly added item). Tag results with their inputs and ignore mismatches; cancel on cleanup.
- [ ] **Staleness signatures.** The "last run" signature and the live signature must cover the same fields.
- [ ] **React.** Hooks rules, exhaustive deps (justify every disable), stable keys (never index for reorderable lists), cleanup of timers/listeners/fetches.
- [ ] **Persistence.** Added state is saved *and* restored, and defaults survive older saved data (missing keys, wrong types).
- [ ] **Edge inputs.** Zero portfolio, zero spend, empty ticker list, one ticker, duplicate tickers, lowercase tickers, negative numbers, `NaN` from `parseFloat`.

## 2. Reviewing security

This is a client-only app with no accounts, but it handles financial data and untrusted network and storage input.

- [ ] **No secrets.** No keys/tokens in source, tests, fixtures or commit history. Env vars with a `VITE_` prefix are public.
- [ ] **XSS.** No `dangerouslySetInnerHTML`/`innerHTML`; any exception needs a sanitised source documented at the call site. Ticker text and imported JSON render as text only.
- [ ] **Untrusted data.** Yahoo responses, `localStorage` and (M5) imported plan JSON are untrusted: validate type, shape, finiteness and ranges before use; never spread untrusted objects into state (prototype pollution: reject `__proto__`, `constructor`).
- [ ] **Ticker input.** Normalise and allow-list characters before it goes into a request URL (`encodeURIComponent` or a strict pattern); cap count.
- [ ] **CSV/clipboard export.** Cells beginning with `=`, `+`, `-`, `@` are spreadsheet-formula injection risks; quote or prefix them. Commas/quotes/newlines must be escaped.
- [ ] **Links.** `target="_blank"` carries `rel="noopener noreferrer"`; no `javascript:`/`data:` URLs from data.
- [ ] **Network.** The only third-party origin is Yahoo Finance. A new origin, script, font or CDN needs justification (and SRI). No telemetry or personal data in requests.
- [ ] **Storage.** No PII beyond what the user typed; keys unchanged unless a migration with a test exists; storage access wrapped in try/catch.
- [ ] **Dependencies.** New runtime dependency = justification in the commit; run `npm audit`; lockfile changes explained.
- [ ] **CI/workflows.** Least-privilege `permissions`; no untrusted `${{ }}` interpolation into shell; pinned or reputable actions.

## 3. Ensuring correctness

- [ ] **Numeric oracle.** Every new/changed financial output has a test whose expected value is computed independently (hand or closed form) at realistic scale: six-figure portfolio, four-figure monthly spend, 30-year horizon. State the derivation in a comment.
- [ ] **Property checks.** Spend 0 → terminal equals gross growth; success is non-increasing as spend rises; a guardrail trip *reduces* spend; allocations sum to 1; difference = template − current.
- [ ] **Determinism.** Monte Carlo takes a seed; tests pin exact or near-exact values.
- [ ] **Mocks are realistic.** Yahoo mocks carry timestamps and enough points (≥ 600 monthly for a 30-year horizon); a mock that cannot satisfy the code path is a test bug.
- [ ] **E2E asserts values.** Metric cells match `/^\d+(\.\d+)?%$/`; zero `NaN`; error banner absent. Ambiguous selectors (`has-text("Calculate")` also matches "Recalculate") are a defect.
- [ ] **Spec conformance.** Behaviour matches `docs/spec.md` §3 contracts; a deliberate deviation is recorded in the spec.
- [ ] **Docs match code.** README, `Known Limitations.md`, `docs/plan.md` status, and test counts quoted anywhere.

## 4. Design and accessibility

- [ ] Colours, radii, type and spacing come from `DESIGN.md` tokens — a raw hex outside the token set is a finding (e.g. warning banner = `warning-surface #1c1200`, `warning-border #92400e`, `warning #fbbf24`).
- [ ] Inline styles only; no shadow, no radius above 10px on a rectangle, one accent family.
- [ ] 44px targets, visible 2px `#93c5fd` focus ring, labels with `htmlFor`/`id`, `role="tab"`/`aria-controls`, charts have a text or table alternative.
- [ ] Meaning is never colour-only; sign and label also carry direction.
- [ ] Axe reports zero violations on touched tabs; Lighthouse a11y ≥ 0.95.
- [ ] Disclaimer sits next to any retirement metric.

## 5. Process

- [ ] One milestone per PR, < 400 changed lines (excluding lockfile and formatter churn); Conventional Commit messages.
- [ ] Linked issue; `Closes #n` only when the issue's exit criteria are all met.
- [ ] CI green on the **latest** commit, not an earlier one.
- [ ] Agents do not merge.

## Finding template

```
[Severity] <one-line defect>
Where: path/to/file.js:123
Scenario: <inputs> → <actual> (expected <value, with derivation>)
Evidence: <command run and output>
Fix: <smallest change> + <test that fails first>
```

## Verdict

- **Approve:** no Critical or High.
- **Request changes:** any High.
- **Block:** any Critical.
