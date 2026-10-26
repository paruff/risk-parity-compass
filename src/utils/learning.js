// Learning journey: pure logic. Recommends, never gates. See
// docs/superpowers/research/2026-10-26-investor-levels-and-learning-science.md
const DAY = 864e5;
const REVIEW_DAYS = [7, 30]; // expanding intervals; nothing after the last
const TOLERANCE = 0.05;

// Self-located wayfinding, not an assessment (research §5).
export const RUBRIC = [
  {
    id: 1,
    name: 'Money hygiene',
    can: 'I can state my net cash flow, carry no revolving card balance, hold an emergency fund, and tell saving from investing.',
    error: 'Confusing investing with saving; no emergency fund.',
  },
  {
    id: 2,
    name: 'Product skeptic',
    can: 'I can say who profits from a product recommendation, work out a fund’s all-in cost, and explain why “guaranteed income” is not guaranteed.',
    error: 'Choosing a product by its marketing story rather than its mechanics.',
  },
  {
    id: 3,
    name: 'Formula user',
    can: 'I can build and maintain a simple multi-asset portfolio, rebalance to a threshold, and say why the formula works.',
    error: 'Treating the formula as an identity; not knowing what would falsify it.',
  },
  {
    id: 4,
    name: 'Principle-based',
    can: 'I can choose an allocation by correlation and goal, size a withdrawal against a stated success definition, and explain the trade-offs I rejected.',
    error: 'Over-optimising; confusing a model with the future.',
  },
];

// Cost module items: dollar gap after `years` between a low- and high-fee fund.
export const COST_ITEMS = [
  { balance: 100000, years: 30, gross: 6, lowFee: 0.05, highFee: 1.0 },
  { balance: 250000, years: 25, gross: 5, lowFee: 0.1, highFee: 0.85 },
];

export const endValue = (item, fee) =>
  item.balance * Math.pow(1 + (item.gross - fee) / 100, item.years);

// Worked example shown before the learner is asked (Sweller et al.).
export const WORKED_ITEM = { balance: 50000, years: 20, gross: 7, lowFee: 0.1, highFee: 1.0 };

export const feeDrag = item => endValue(item, item.lowFee) - endValue(item, item.highFee);

export function gradeAnswer(item, answer) {
  const truth = feeDrag(item);
  const n = Number(answer);
  const correct =
    answer !== '' &&
    answer != null &&
    Number.isFinite(n) &&
    Math.abs(n - truth) / truth <= TOLERANCE;
  return { correct, truth };
}

const usd = n => `$${Math.round(n).toLocaleString('en-US')}`;

// Hattie & Timperley: where am I going / how am I going / where to next.
export function feedback(item, answer, confidence) {
  const { correct, truth } = gradeAnswer(item, answer);
  const where = `Goal: see how a small yearly fee compounds. On ${usd(item.balance)} over ${item.years} years at ${item.gross}% gross, ${item.lowFee}% vs ${item.highFee}% in fees leaves a gap of ${usd(truth)}.`;
  const calibration =
    confidence >= 4 && !correct
      ? ' You were confident and off — the gap between those two is the thing to notice.'
      : confidence <= 2 && correct
        ? ' You were unsure but right; you know more than you rated.'
        : '';
  const how = correct
    ? `Within 5% of the calculated gap.${calibration}`
    : `Your answer was not within 5% of the calculated gap.${calibration}`;
  const next =
    'Next time you see an expense ratio, multiply the difference by your balance and years before comparing funds.';
  return { where, how, next };
}

export const itemFor = (learning, id) =>
  COST_ITEMS[(learning?.modules?.[id]?.attempts ?? 0) % COST_ITEMS.length];

export function recordAttempt(learning, id, { correct, confidence, intention, now = Date.now() }) {
  const prev = learning?.modules?.[id];
  const step = !prev ? 0 : correct ? prev.step + 1 : 0;
  const days = REVIEW_DAYS[step];
  return {
    ...learning,
    modules: {
      ...learning?.modules,
      [id]: {
        completedAt: now,
        attempts: (prev?.attempts ?? 0) + 1,
        step,
        correct,
        confidence,
        intention: intention || prev?.intention || '',
        nextDue: days == null ? null : now + days * DAY,
      },
    },
  };
}

export const dueModules = (learning, now = Date.now()) =>
  Object.entries(learning?.modules ?? {})
    .filter(([, m]) => m.nextDue != null && m.nextDue <= now)
    .map(([id]) => id);
