# Investor levels and the learning-science evidence

**Date:** 2026-10-26
**Question:** Is there objective, research-based evidence for the four-level investor model described at riskparityradio.com (or for any comparable developmental-level model), and what would it take to build online distance learning that actually moves a learner from one level to the next?
**Status:** Research complete. Informs M6 (Learning Journey), which is unscoped.

---

## 1. Answer

**There is no validated research instrument behind the four-level investor model.** It is a practitioner's taxonomy, articulated by Frank Vasquez on Risk Parity Radio, not a measured construct with reliability, factor structure or predictive validity. No paper develops, validates or tests it. Treating it as science would be a category error — and building UI that presents a learner's "level" as a diagnosis would repeat exactly the mistake the 2026-10-26 code review found in the retirement engine: a confident number with nothing behind it.

**The model is, however, directionally consistent with adjacent evidence**, and three parts of it are defensible if restated as competencies rather than stages:

1. Financial knowledge and behaviour form a continuum, not a set of types (Lusardi & Mitchell's financial-literacy work measures it continuously).
2. Financial education **does** change knowledge and downstream behaviour — modestly, and with decay unless refreshed (Kaiser et al. 2022; Fernandes et al. 2014).
3. Expertise in a domain is built by experience plus feedback, and only weakly predicted by time-on-task (Macnamara et al. 2014).

**What the evidence does not support** is the strong claim implied by "levels": that people occupy discrete stages, that a stage predicts what intervention will work, or that a learner can be reliably assigned to one. Stage models in general (Dreyfus, transtheoretical) are influential heuristics with weak measurement properties.

**Therefore:** build the learning journey on **observable competencies and reliable instructional mechanisms**, present levels as *self-located wayfinding* rather than assessment, and measure learning with retrieval-based checks rather than with declared progress.

---

## 2. What the four levels actually say

From Episode 459 ("Kicks And Giggles With A Bogleheads Forum Thread…", 2026), Vasquez describes four levels of investor development:

| Level | Description (paraphrased from the episode) |
|---|---|
| **1 — Money hygiene** | Little or no investing knowledge. The live problems are debt, credit score, budgeting, emergency fund. Consumer-finance teachers (Ramsey, Orman) are the right resource. |
| **2 — Shiny-object syndrome** | Has learned a little and is drawn to whatever is being promoted: infinite banking, dividend-focused portfolios, covered-call funds, "passive income" schemes. The common feature is that someone profits from the recommendation. |
| **3 — Formulaic level** | Recognises that shiny objects are not optimal and adopts a formula — two-fund, three-fund, target-date, a simple Bogleheads portfolio. This works. Its failure mode is that the formula becomes identity and groupthink. |
| **4 — Principle-based** | Applies sound principles to a specific goal rather than following a formula. Strips out psychology and sales pressure, looks at what professional investors actually do, adapts what transfers. Vasquez names the principles: the "Holy Grail" of low correlation, macro allocation, and simplicity. The goal is a higher safe withdrawal rate. |

Vasquez is explicit on the episode that the model is his own framing and that he does not know what "level five" would be. That is a hypothesis stated as a hypothesis — honest, and exactly what a research-grounded product must not upgrade into a measurement.

**Adjacent, more formal frameworks** exist for investor knowledge and capability, and none of them is stage-based:

- **Financial literacy** is measured as a continuous score (the "Big Three": compound interest, inflation, risk diversification) — Lusardi & Mitchell's work across many national surveys.
- **Financial capability / well-being** (CFPB) is measured on continuous behavioural and attitudinal scales.
- **Investor sophistication** in behavioural finance is inferred from behaviour (diversification, fee sensitivity, trading frequency), not from a stage.

So the literature's answer to "what level is this investor?" is a **score plus a behaviour profile**, not a label.

---

## 3. What would count as evidence

For the record, because "is there evidence?" deserves a specific bar:

1. **Construct definition** — an operational statement of what distinguishes each level.
2. **Instrument** — items with known reliability (internal consistency, test–retest).
3. **Factor structure** — evidence the levels are separable rather than one continuum arbitrarily cut into four.
4. **Criterion validity** — level predicts something measurable (portfolio cost, diversification, drawdown behaviour, returns net of fees).
5. **Incremental validity** — level adds prediction beyond age, income, education and financial-literacy score.
6. **Intervention evidence** — a trial showing a level-matched intervention outperforms a generic one.

The Dreyfus model, the closest well-known stage theory, satisfies (1) loosely and (2)–(6) poorly; reviews describe it as descriptively useful and empirically underdetermined (Peña 2010). The transtheoretical model satisfies (2) partially in health behaviour and is contested on (3): the boundaries between stages are criticised as arbitrary (Walton 2022). Neither gives us licence to label a user.

**What RPR's model does satisfy** is practitioner validity: it names real, recognisable failure modes, and those failure modes are the useful part. A level-2 investor really does buy the thing being sold; a level-3 investor really does confuse a formula with a principle. That is worth designing for — as **diagnostic content**, not as a learner attribute.

---

## 4. What the evidence does support

### 4.1 Financial education works — modestly — and then decays

- **Kaiser, Lusardi, Menkhoff & Urban (2022)**, *Journal of Financial Economics* 145(2), 255–272: meta-analysis of **76 randomised experiments** with more than 160,000 individuals. Financial education produces positive, statistically significant effects on both financial knowledge and downstream behaviours, with effect sizes **comparable to educational interventions in maths and reading**. Effects are largest for budgeting, saving and credit behaviour.
- **Kaiser & Menkhoff (2017)**, *World Bank Economic Review* 31(3): meta-analysis of **126 impact evaluations**. Financial education significantly improves both literacy and behaviour, with larger effects on behaviour than on knowledge.
- **Fernandes, Lynch & Netemeyer (2014)**, *Management Science* 60(8), 1861–1883: meta-analysis of 201 studies. Interventions explain only **0.1% of the variance** in financial behaviours, effects **decay over time**, and effects are weaker for low-income consumers. Crucially, the paper finds **just-in-time** and **rule-of-thumb** interventions outperform broad, front-loaded education.

Read together, these are not contradictory. Education moves knowledge reliably and behaviour somewhat; the effect fades without reinforcement; and timing beats volume. The design implication is unambiguous: **short, embedded, repeated, and tied to the decision in front of the learner** — not a course.

### 4.2 Knowledge is not behaviour

The gap between knowing and doing is the central finding of behavioural finance, and it is why a "level" inferred from a quiz would misdescribe the user. Someone can answer the Big Three correctly and still hold an expensive, undiversified portfolio. Any learning design that certifies competence from quiz scores will overstate it.

### 4.3 Expertise is domain-specific and only weakly predicted by hours

- **Macnamara, Hambrick & Oswald (2014)**, *Psychological Science* 25(8): meta-analysis of deliberate practice. Deliberate practice explained **26%** of performance variance in games, **21%** in music, **18%** in sports, **4%** in education, and **less than 1%** in professions. Overall ≈12%.

The "10,000 hours" reading is not supported. For a professional domain like investing, practice alone explains almost nothing; what matters is **feedback quality, decision structure and the opportunity to learn from outcomes**. This argues for simulations with immediate, interpretable feedback (which this product already has, once M3.5 makes the engine correct) rather than for lesson volume.

### 4.4 The reliable instructional mechanisms

These are the mechanisms with the strongest evidence, drawn from the verified Tier-1 list maintained in `~/projects/github/paruff/learn-languages/docs/learning-science-references.md`:

| Mechanism | Source | Effect on design |
|---|---|---|
| **Retrieval practice** (testing effect) | Roediger & Karpicke 2006, *Psych. Science* 17(3) | Ask the learner to recall/decide before revealing the answer. Always. |
| **Spaced practice** | Cepeda et al. 2006, *Psych. Bulletin* 132(3) | Revisit each concept across days, expanding intervals. |
| **Interleaving** | Rohrer & Taylor 2007, *Instructional Science* 35 | Mix problem types (e.g. "which account first?" alongside "which guardrail?") rather than blocking by topic. |
| **Feedback** | Hattie & Timperley 2007, *Review of Educational Research* 77(1) | Feedback must answer: where am I going, how am I going, where to next. "Wrong" alone is not feedback. |
| **Cognitive load / worked examples** | Sweller, van Merriënboer & Paas 2019, *Educ. Psych. Review* 31 | Show a fully worked retirement calculation before asking for one. |
| **Metacognitive calibration** | Bjork, Dunlosky & Kornell 2013, *Annual Review of Psychology* 64 | Learners overestimate their understanding. Pair "how confident are you?" with an objective check so the illusion is visible. |
| **Implementation intentions** | Gollwitzer & Sheeran 2006, *Adv. Exp. Soc. Psych.* 38 (d ≈ 0.65) | "When X happens, I will do Y" — the single most effective behaviour-change prompt, and cheap to implement. |
| **Mastery learning (soft)** | Bloom 1968; Guskey 2007 | Recommend before advancing; never hard-lock. |

### 4.5 What does not work — do not build it

| Idea | Status |
|---|---|
| **Learning-styles matching** (visual/auditory/kinaesthetic learners) | **No evidence.** Pashler, McDaniel, Rohrer & Bjork 2008, *Psych. Science in the Public Interest* 9(3). |
| **Gamification: points, badges, leaderboards, streaks** | Weak and mixed evidence; harmful when it substitutes for feedback. Excluded by design in the sibling project for the same reason. |
| **Hattie effect-size rankings as justification** | Methodologically criticised (Simpson 2017; Bergeron & Rivard 2017): averages across incomparable meta-analyses, mostly K-12, teacher-mediated. Useful for orientation only. |
| **"Level" as a diagnosis or a gate** | No validated instrument; gating contradicts adult learners' autonomy and would block the product's core task. |
| **Streak/loss-framed nudges** | Exploit loss aversion to drive engagement — a dark pattern in a product whose credibility depends on not manipulating the user. |
| **AI learner profiling** | Unnecessary for the mechanisms above, and a privacy cost with no evidence of benefit. |

---

## 5. The four levels, restated as observable competencies

This is the useful transformation: keep the model's insight, drop its claim to be a stage theory. Each row is written so it can be **demonstrated in the product**, not self-declared.

| Level (RPR name) | Observable competency | How the product can observe it | Characteristic error |
|---|---|---|---|
| **1 — Money hygiene** | Can state net cash flow, carry no revolving credit-card balance, hold an emergency fund, and distinguish saving from investing. | A short diagnostic that asks for the user's actual situation, not definitions. | Confusing investing with saving; no emergency fund. |
| **2 — Shiny-object** | Can identify who profits from a product recommendation, compute a fund's all-in cost, and explain why a "guaranteed income" product is not guaranteed. | Cost comparison exercise on a real product description; "who is paid, and how?" prompt. | Selecting a product by its marketing narrative rather than its mechanics. |
| **3 — Formulaic** | Can build and maintain a simple multi-asset portfolio, rebalance to a threshold, and state why the formula works. | This is what the rebalancing tab already teaches; the observable is a completed trade plan with a stated rationale. | Treating the formula as an identity; not knowing what would falsify it. |
| **4 — Principle-based** | Can choose allocation by correlation and goal, size a withdrawal against a stated success definition, and explain the trade-offs they rejected. | Retirement tab with guardrails, a stated SWR basis, and a written plan summary. | Over-optimising; confusing a model with the future. |

**Crucially, no level is a prerequisite for using any tab.** A level-1 user can still enter a portfolio and see what rebalancing would do. The rubric tells them what to learn next; it does not decide what they are allowed to touch.

---

## 6. Design constraints for M6 (distance learning)

Derived from the evidence above, in priority order.

1. **Just-in-time, not front-loaded.** Put the lesson at the decision point: the cost explainer beside the fee input, the RMD explainer beside the RMD field, the correlation explainer beside the allocation. Fernandes et al. is the reason.
2. **Retrieval before reveal.** Every module asks a question the learner must answer — ideally by *doing something in the tool* — before it explains. Roediger & Karpicke.
3. **Spacing and return.** A concept returns on later visits, at expanding intervals, without a streak counter and without notification pressure. Cepeda et al.
4. **Interleave.** Mix account-ordering, guardrail and allocation questions rather than blocking them by chapter. Rohrer & Taylor.
5. **Feedback that answers three questions.** "Where am I going / how am I going / where to next" — never a bare right/wrong. Hattie & Timperley.
6. **Worked example first.** Show one complete retirement projection with the arithmetic visible, then ask for one. Sweller et al.
7. **Calibration, not confidence theatre.** Ask for a confidence rating, then show the outcome. The gap is the lesson. Bjork et al.
8. **Implementation intentions.** End each module with one sentence the learner writes: "When my portfolio drifts past X, I will…". Gollwitzer & Sheeran.
9. **No gating, no streaks, no badges, no leaderboards.** Soft recommendation only. Bloom/Guskey for mastery; the rest is excluded on evidence and on product ethics.
10. **Local-only progress.** No accounts, no telemetry, consistent with the repository's static-site and privacy posture.
11. **Accessible by default.** 16px minimum body text, no colour-only meaning, keyboard-operable, reduced-motion respected — the audience is older than the average web user.
12. **Honest limits.** Every module ends with what the evidence does *not* show. "This improves your knowledge; it does not predict your returns."

### Proposed M6 shape

- **A self-located rubric**, not a test: the learner reads the four competency rows and picks the one that describes what they can already do. No score, no diagnosis.
- **Three to five micro-modules**, each 3–6 minutes, each anchored to a tab: cost literacy, correlation and the Holy Grail, withdrawal-rate arithmetic, guardrail rules, tax-aware sequencing.
- **A knowledge check that is a task**, not a quiz: "given these three funds and these fees, which goes in the Roth?" — with the tool's own engine computing the answer.
- **A progress view phrased as capability** ("you can now explain why the 80% guardrail reduces spending") rather than as a percentage complete.
- **A short spaced follow-up** on the next visit, not a push notification.

### What M6 should not include

Course catalogues, certificates, levels-as-badges, daily streaks, points, avatars, AI tutors, community feeds, or any claim that completing it improves investment outcomes. Each fails either the evidence test or the product's credibility test.

---

## 7. How we would know it works

A claim of learning needs a measurement, and the sibling project's experience is instructive: measures must be objective and must not be satisfiable by the error path.

| Measure | Instrument | Timing |
|---|---|---|
| Knowledge | 6–10 retrieval items tied to module content, scored automatically | Immediately before and after each module |
| Retention | The same items, unannounced | 7 and 30 days later (the decay finding predicts a drop) |
| Calibration | Confidence rating vs correctness, per item | Every module |
| Behaviour | Self-reported action taken in the tool (a trade plan run, a guardrail selected, a withdrawal rate compared) | Next session |
| Transfer | A novel scenario solved in the tool | After 2+ modules |

**Honest expectation setting:** the literature predicts a small but real knowledge gain, a smaller behaviour gain, and decay without spacing. A design that promises transformation is lying; a design that promises "you will understand this decision" is defensible.

---

## 8. Sources

Tiered as in the sibling project's reference file: primary research and systematic reviews first.

### Tier 1 — cite these

| Claim | Source | Limit |
|---|---|---|
| Financial education improves knowledge and behaviour, comparably to maths/reading interventions | Kaiser, Lusardi, Menkhoff & Urban (2022). Financial education affects financial knowledge and downstream behaviors. *Journal of Financial Economics*, 145(2), 255–272. 76 randomised experiments, >160,000 individuals. | Mostly short-run; heterogeneity across programmes is large |
| Effects are small and decay; just-in-time and rule-of-thumb formats work better | Fernandes, Lynch & Netemeyer (2014). Financial literacy, financial education, and downstream financial behaviors. *Management Science*, 60(8), 1861–1883. | Interventions explain 0.1% of behavioural variance; the authors argue for timing over volume |
| Financial education effects across 126 evaluations | Kaiser & Menkhoff (2017). Does financial education impact financial literacy and financial behavior, and if so, when? *World Bank Economic Review*, 31(3). | Effects larger for behaviour than knowledge; decay without follow-up |
| Deliberate practice explains little in professional domains | Macnamara, Hambrick & Oswald (2014). Deliberate practice and performance in music, games, sports, education, and professions: a meta-analysis. *Psychological Science*, 25(8), 1608–1618. | 26% games … <1% professions; overall ≈12% |
| Retrieval practice | Roediger & Karpicke (2006). Test-enhanced learning. *Psychological Science*, 17(3), 249–255. | Laboratory and classroom, mostly young adults |
| Spacing | Cepeda, Pashler, Vul, Wixted & Rohrer (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3), 354–380. | Verbal recall tasks; transfer to financial decisions is an extrapolation |
| Interleaving | Rohrer & Taylor (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35, 481–498. | Mathematics problem sets |
| Feedback | Hattie & Timperley (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112. | Extracted from school settings |
| Cognitive load / worked examples | Sweller, van Merriënboer & Paas (2019). Cognitive architecture and instructional design: 20 years later. *Educational Psychology Review*, 31, 261–292. | Strong theory, mostly school and novice populations |
| Metacognitive illusions | Bjork, Dunlosky & Kornell (2013). Self-regulated learning: beliefs, techniques, and illusions. *Annual Review of Psychology*, 64, 417–444. | Learners misjudge their own learning |
| Implementation intentions | Gollwitzer & Sheeran (2006). *Advances in Experimental Social Psychology*, 38. | General behaviour change (d ≈ 0.65), not finance-specific |
| Learning styles are unsupported | Pashler, McDaniel, Rohrer & Bjork (2008). *Psychological Science in the Public Interest*, 9(3). | — |
| Overview of technique effectiveness | Dunlosky, Rawson, Marsh, Nathan & Willingham (2013). *Psychological Science in the Public Interest*, 14(1), 4–58. | Ranks testing and spacing high, rereading low |
| Stage models are descriptively useful, empirically underdetermined | Peña (2010). The Dreyfus model of clinical problem-solving skills acquisition. *Medical Education Online*, 15. | Review; nursing/medical education |
| Stage boundaries contested | Walton (2022). Facilitating behavior change: introducing the transtheoretical model. | Critiques arbitrary stage boundaries; limited evidence for stage-matching |

### Tier 2 — orientation only, never justification

- **Hattie (2009/2023), *Visible Learning*.** Enormously useful as a map of what to investigate; its effect-size averages are methodologically criticised (Simpson 2017, *Journal of Education Policy* 32(4); Bergeron & Rivard 2017, *McGill Journal of Education* 52(1)) and drawn largely from K-12 classrooms. **Never cite a Hattie effect size as the justification for a feature.**
- **RPR Episode 459** — the source of the four levels. A practitioner's framing, stated as a hypothesis by its author.
- **Brown, Roediger & McDaniel (2014), *Make It Stick*.** Accessible synthesis; follow citations to Tier 1.

### Consciously excluded

Learning-styles inventories, gamification research, "10,000 hours" pop literature, and AI-tutoring vendor material. Each fails the Tier-1 bar, conflicts with the product's ethics, or both.

---

## 9. Limitations of this review

- **No primary research on investor stage models was found**, which is itself the finding. A negative result from a literature search is weaker than a positive one: absence of validation is not proof that no validation exists, only that none is discoverable.
- Most instructional evidence comes from children and young adults in formal education. Adult, self-directed, high-stakes financial learning is thinly studied.
- The financial-education literature measures short-run behaviour; nothing robustly measures whether education improves **net investment outcomes**, and some of it suggests it does not.
- The four-level rubric in §5 is a **proposal**, internally coherent and grounded in the described failure modes. It has not been validated. If M6 is built, the rubric should be treated as a hypothesis to test — and the product should never present it as an assessment.
