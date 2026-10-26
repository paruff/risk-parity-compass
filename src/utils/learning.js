// Learning journey: pure logic. Recommends, never gates. See
// docs/superpowers/research/2026-10-26-investor-levels-and-learning-science.md
import { requiredMinimumDistribution, guardrailSpend, withdrawalSequence } from './withdrawal';

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

const usd = n => `$${Math.round(n).toLocaleString('en-US')}`;
const pct2 = n => `${n.toFixed(2)}%`;

// Cost module: dollar gap after `years` between a low- and high-fee fund.
export const COST_ITEMS = [
  { module: 'cost', balance: 100000, years: 30, gross: 6, lowFee: 0.05, highFee: 1.0 },
  { module: 'cost', balance: 250000, years: 25, gross: 5, lowFee: 0.1, highFee: 0.85 },
];

export const endValue = (item, fee) =>
  item.balance * Math.pow(1 + (item.gross - fee) / 100, item.years);

// Worked example shown before the learner is asked (Sweller et al.).
export const WORKED_ITEM = { balance: 50000, years: 20, gross: 7, lowFee: 0.1, highFee: 1.0 };

export const feeDrag = item => endValue(item, item.lowFee) - endValue(item, item.highFee);

// Two-asset volatility (%) from weights, vols (%) and correlation.
const pairVol = ({ w1, v1, v2, rho }) => {
  const w2 = 1 - w1;
  return Math.sqrt(w1 * w1 * v1 * v1 + w2 * w2 * v2 * v2 + 2 * w1 * w2 * rho * v1 * v2) || 0;
};

const TAX = 'Traditional IRA / 401k';
const sequence = item =>
  withdrawalSequence(item.accounts, item.spend, {
    rmdByAccount: { [TAX]: item.rmdMonthly ?? 0 },
  }).byAccount[TAX];

// Each module: items graded against an independent calculation or the app's own engine.
export const MODULES = {
  cost: {
    title: 'Fund costs',
    worked: () =>
      `${usd(WORKED_ITEM.balance)} grows ${WORKED_ITEM.gross}% a year before fees for ${WORKED_ITEM.years} years. At a ${WORKED_ITEM.lowFee}% fee it becomes ${usd(endValue(WORKED_ITEM, WORKED_ITEM.lowFee))}; at ${WORKED_ITEM.highFee}% it becomes ${usd(endValue(WORKED_ITEM, WORKED_ITEM.highFee))}. The gap is ${usd(feeDrag(WORKED_ITEM))}.`,
    items: COST_ITEMS,
    truth: feeDrag,
    unit: 'dollars',
    question: i =>
      `${usd(i.balance)} grows ${i.gross}% a year before fees for ${i.years} years. How many dollars more do you end with at a ${i.lowFee}% fee than at a ${i.highFee}% fee?`,
    goal: 'see how a small yearly fee compounds',
    result: (i, t) =>
      `On ${usd(i.balance)} over ${i.years} years at ${i.gross}% gross, ${i.lowFee}% vs ${i.highFee}% in fees leaves a gap of ${usd(t)}.`,
    next: 'Next time you see an expense ratio, multiply the difference by your balance and years before comparing funds.',
    intention: 'When I see a fund fee, I will…',
    limits:
      'it improves your grasp of how fees compound; it does not predict your returns or tell you which fund to buy.',
  },
  correlation: {
    title: 'Correlation and diversification',
    worked: () =>
      `Two assets, each with 20% volatility, held 50/50. If they move in lockstep (correlation 1), the mix is still 20% volatile. If they are uncorrelated (0), it falls to √(2 × 0.25 × 0.04) = ${pct2(pairVol({ w1: 0.5, v1: 20, v2: 20, rho: 0 }))}.`,
    items: [
      { module: 'correlation', w1: 0.5, v1: 16, v2: 16, rho: 0 },
      { module: 'correlation', w1: 0.6, v1: 12, v2: 20, rho: 0 },
    ],
    truth: pairVol,
    unit: 'percent',
    question: i =>
      `Two assets with ${i.v1}% and ${i.v2}% volatility, held ${Math.round(i.w1 * 100)}/${Math.round((1 - i.w1) * 100)}, are uncorrelated. What is the portfolio’s volatility, in percent?`,
    goal: 'see why low correlation lowers risk without lowering the holdings’ own volatility',
    result: (i, t) =>
      `With correlation ${i.rho}, ${Math.round(i.w1 * 100)}/${Math.round((1 - i.w1) * 100)} of ${i.v1}% and ${i.v2}% volatility gives ${pct2(t)}.`,
    next: 'When you compare allocations, look at how the pieces move together, not only how risky each piece is.',
    intention: 'When I add a new fund, I will check its correlation with what I hold by…',
    limits:
      'it shows the arithmetic of diversification; correlations change, and rise in crises, so real risk can be higher.',
  },
  withdrawal: {
    title: 'Required minimum distributions',
    worked: () =>
      `At 73, a $500,000 traditional balance has an IRS divisor of 26.5, so the minimum is $500,000 ÷ 26.5 = ${usd(requiredMinimumDistribution(73, 500000).rmd)} for the year.`,
    items: [
      { module: 'withdrawal', age: 75, balance: 600000 },
      { module: 'withdrawal', age: 73, balance: 500000 },
    ],
    truth: i => requiredMinimumDistribution(i.age, i.balance).rmd,
    unit: 'dollars',
    question: i =>
      `You are ${i.age} with ${usd(i.balance)} in a traditional IRA at the end of last year. What is this year’s required minimum distribution, in dollars?`,
    goal: 'work out a withdrawal you are required to take',
    result: (i, t) => `At ${i.age}, ${usd(i.balance)} requires about ${usd(t)} this year.`,
    next: 'Divide last year-end balance by the IRS divisor for your age, then plan the rest of your spending around it.',
    intention: 'Each January, I will look up my RMD and…',
    limits:
      'this uses the IRS Uniform Lifetime Table only; inherited accounts, spouse-age rules and law changes differ. It is not tax advice.',
  },
  guardrail: {
    title: 'The 80% spending guardrail',
    worked: () =>
      `Start with $1,000,000 and spend $4,000 a month. If the portfolio falls below 80% ($800,000) it drops to $780,000: spending is cut to 6% a year of the current value, 0.06 ÷ 12 × $780,000 = ${usd(guardrailSpend(4000, 780000, 1000000, 'rpr-80').nextSpend)} a month.`,
    items: [
      { module: 'guardrail', spend: 4000, value: 750000, start: 1000000 },
      { module: 'guardrail', spend: 4000, value: 700000, start: 900000 },
    ],
    truth: i => guardrailSpend(i.spend, i.value, i.start, 'rpr-80').nextSpend,
    unit: 'dollars',
    question: i =>
      `You started at ${usd(i.start)} and spend ${usd(i.spend)} a month. The portfolio is now ${usd(i.value)}. What monthly spending does the 80% guardrail allow, in dollars?`,
    goal: 'apply a spending rule before the market forces your hand',
    result: (i, t) =>
      `${usd(i.value)} is below 80% of ${usd(i.start)}, so spending becomes 6% a year of the current value: ${usd(t)} a month.`,
    next: 'Decide the guardrail now, while calm, so a downturn triggers a rule instead of a panic.',
    intention: 'If my portfolio drops below 80% of its start, I will…',
    limits:
      'the rule trades some spending for a better chance the money lasts; it does not guarantee success and its cut rate is a convention, not a law.',
  },
  sequencing: {
    title: 'Which account to draw from',
    worked: () =>
      `Spending $4,000 a month with $2,000 in taxable and $100,000 traditional: taxable goes first (${usd(2000)}), the remaining $2,000 comes from traditional, and Roth is left to grow.`,
    items: [
      {
        module: 'sequencing',
        spend: 4000,
        accounts: { Taxable: 2000, [TAX]: 100000, 'Roth IRA': 30000 },
      },
      {
        module: 'sequencing',
        spend: 4000,
        rmdMonthly: 5000,
        accounts: { Taxable: 50000, [TAX]: 100000, 'Roth IRA': 30000 },
      },
    ],
    truth: sequence,
    unit: 'dollars',
    question: i =>
      `You need ${usd(i.spend)} this month. You have ${usd(i.accounts.Taxable)} taxable, ${usd(i.accounts[TAX])} traditional and ${usd(i.accounts['Roth IRA'])} Roth${i.rmdMonthly ? `, and a required minimum of ${usd(i.rmdMonthly)} a month from the traditional account` : ''}. How much comes from the traditional account, in dollars?`,
    goal: 'order withdrawals taxable, then traditional, then Roth, without breaking a required minimum',
    result: (i, t) =>
      `Taxable is used first; traditional covers any gap or the required minimum, whichever is larger: ${usd(t)} this month.`,
    next: 'Check for a required minimum before you decide which account pays this month.',
    intention: 'Before I withdraw, I will check…',
    limits:
      'this is a simple ordering heuristic; the best order depends on your brackets, state and estate goals. It is not tax advice.',
  },
};

export const MODULE_IDS = Object.keys(MODULES);

const mod = item => MODULES[item.module ?? 'cost'];
export const truthOf = item => mod(item).truth(item);

export function gradeAnswer(item, answer) {
  const truth = truthOf(item);
  const n = Number(answer);
  const correct =
    answer !== '' &&
    answer != null &&
    Number.isFinite(n) &&
    Math.abs(n - truth) / truth <= TOLERANCE;
  return { correct, truth };
}

// Hattie & Timperley: where am I going / how am I going / where to next.
export function feedback(item, answer, confidence) {
  const m = mod(item);
  const { correct, truth } = gradeAnswer(item, answer);
  const where = `Goal: ${m.goal}. ${m.result(item, truth)}`;
  const calibration =
    confidence >= 4 && !correct
      ? ' You were confident and off — the gap between those two is the thing to notice.'
      : confidence <= 2 && correct
        ? ' You were unsure but right; you know more than you rated.'
        : '';
  const how = correct
    ? `Within 5% of the calculated answer.${calibration}`
    : `Your answer was not within 5% of the calculated answer.${calibration}`;
  return { where, how, next: m.next };
}

export const itemFor = (learning, id) => {
  const { items } = MODULES[id];
  return items[(learning?.modules?.[id]?.attempts ?? 0) % items.length];
};

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
