import { describe, it, expect } from 'vitest';
import {
  RUBRIC,
  COST_ITEMS,
  feeDrag,
  gradeAnswer,
  feedback,
  itemFor,
  recordAttempt,
  dueModules,
  MODULES,
  MODULE_IDS,
  truthOf,
} from '../learning';

const DAY = 864e5;
const T0 = Date.UTC(2026, 9, 26);

describe('feeDrag', () => {
  it('matches hand-computed difference: $100k, 6% gross, 0.05% vs 1.00% fee, 30y', () => {
    // 100000·(1.0595^30 − 1.05^30), computed independently of the module.
    expect(feeDrag(COST_ITEMS[0])).toBeCloseTo(134082.64, 0);
  });

  it('matches hand-computed difference for the second item', () => {
    expect(feeDrag(COST_ITEMS[1])).toBeCloseTo(135749.94, 0);
  });
});

describe('gradeAnswer', () => {
  const truth = feeDrag(COST_ITEMS[0]);
  it('accepts within 5%', () => {
    expect(gradeAnswer(COST_ITEMS[0], truth * 1.04).correct).toBe(true);
    expect(gradeAnswer(COST_ITEMS[0], truth * 0.96).correct).toBe(true);
  });
  it('rejects outside 5%, blanks, NaN and negatives', () => {
    expect(gradeAnswer(COST_ITEMS[0], truth * 1.06).correct).toBe(false);
    expect(gradeAnswer(COST_ITEMS[0], '').correct).toBe(false);
    expect(gradeAnswer(COST_ITEMS[0], NaN).correct).toBe(false);
    expect(gradeAnswer(COST_ITEMS[0], -truth).correct).toBe(false);
  });
  it('returns the engine truth for display', () => {
    expect(gradeAnswer(COST_ITEMS[0], 1).truth).toBeCloseTo(truth, 6);
  });
});

describe('feedback', () => {
  it('answers where / how / next, never a bare right/wrong', () => {
    const f = feedback(COST_ITEMS[0], 1000, 5);
    expect(Object.keys(f)).toEqual(['where', 'how', 'next']);
    Object.values(f).forEach(s => expect(s.length).toBeGreaterThan(20));
  });
  it('flags overconfidence when confident and wrong', () => {
    expect(feedback(COST_ITEMS[0], 1000, 5).how).toMatch(/confident/i);
  });
  it('does not flag calibration when confident and right', () => {
    const truth = feeDrag(COST_ITEMS[0]);
    expect(feedback(COST_ITEMS[0], truth, 5).how).not.toMatch(/more confident than/i);
  });
});

describe('spacing', () => {
  it('first attempt schedules a review at +7 days, even if wrong', () => {
    const l = recordAttempt(null, 'cost', { correct: false, confidence: 3, now: T0 });
    expect(l.modules.cost.nextDue).toBe(T0 + 7 * DAY);
  });

  it('correct reviews expand 7 → 30 days, then stop', () => {
    let l = recordAttempt(null, 'cost', { correct: true, confidence: 3, now: T0 });
    l = recordAttempt(l, 'cost', { correct: true, confidence: 3, now: T0 + 7 * DAY });
    expect(l.modules.cost.nextDue).toBe(T0 + 37 * DAY);
    l = recordAttempt(l, 'cost', { correct: true, confidence: 3, now: T0 + 37 * DAY });
    expect(l.modules.cost.nextDue).toBeNull();
  });

  it('a wrong review resets to 7 days', () => {
    let l = recordAttempt(null, 'cost', { correct: true, confidence: 3, now: T0 });
    l = recordAttempt(l, 'cost', { correct: true, confidence: 3, now: T0 + 7 * DAY });
    l = recordAttempt(l, 'cost', { correct: false, confidence: 3, now: T0 + 37 * DAY });
    expect(l.modules.cost.nextDue).toBe(T0 + 44 * DAY);
  });

  it('dueModules lists only modules whose date has passed', () => {
    const l = recordAttempt(null, 'cost', { correct: true, confidence: 3, now: T0 });
    expect(dueModules(l, T0 + 6 * DAY)).toEqual([]);
    expect(dueModules(l, T0 + 7 * DAY)).toEqual(['cost']);
    expect(dueModules(null, T0)).toEqual([]);
  });

  it('does not mutate its input and keeps the rubric choice', () => {
    const base = Object.freeze({ rubricChoice: 2, modules: Object.freeze({}) });
    const l = recordAttempt(base, 'cost', { correct: true, confidence: 4, now: T0 });
    expect(l.rubricChoice).toBe(2);
    expect(base.modules).toEqual({});
  });

  it('keeps the learner’s intention across later reviews unless replaced', () => {
    let l = recordAttempt(null, 'cost', {
      correct: true,
      confidence: 3,
      intention: 'When a fund costs >0.5%, I will compare it.',
      now: T0,
    });
    l = recordAttempt(l, 'cost', { correct: true, confidence: 3, now: T0 + 7 * DAY });
    expect(l.modules.cost.intention).toMatch(/compare it/);
  });

  it('rotates question variants by attempt count', () => {
    expect(itemFor(null, 'cost')).toBe(COST_ITEMS[0]);
    const l = recordAttempt(null, 'cost', { correct: true, confidence: 3, now: T0 });
    expect(itemFor(l, 'cost')).toBe(COST_ITEMS[1]);
  });
});

describe('RUBRIC', () => {
  it('has four competencies, each demonstrable, with a characteristic error', () => {
    expect(RUBRIC).toHaveLength(4);
    RUBRIC.forEach((r, i) => {
      expect(r.id).toBe(i + 1);
      expect(r.name && r.can && r.error).toBeTruthy();
    });
  });
});

describe('module registry', () => {
  const first = id => MODULES[id].items[0];
  const second = id => MODULES[id].items[1];

  it('has five modules, each with two items, worked example, title and honest limits', () => {
    expect(MODULE_IDS).toEqual(['cost', 'correlation', 'withdrawal', 'guardrail', 'sequencing']);
    MODULE_IDS.forEach(id => {
      const m = MODULES[id];
      expect(m.items.length).toBeGreaterThanOrEqual(2);
      expect(m.title && m.worked && m.limits && m.next).toBeTruthy();
      m.items.forEach(i => expect(i.module).toBe(id));
    });
  });

  it('correlation: two-asset volatility at zero correlation (hand-computed)', () => {
    // 50/50, 16% each, ρ=0: √(2·0.25·0.0256)=11.3137%
    expect(truthOf(first('correlation'))).toBeCloseTo(11.3137, 3);
    // 60/40, 12% and 20%: √(0.36·0.0144 + 0.16·0.04)=10.7629%
    expect(truthOf(second('correlation'))).toBeCloseTo(10.7629, 3);
  });

  it('withdrawal: RMD from the IRS table (75 → 24.6, 73 → 26.5)', () => {
    expect(truthOf(first('withdrawal'))).toBeCloseTo(600000 / 24.6, 2);
    expect(truthOf(second('withdrawal'))).toBeCloseTo(500000 / 26.5, 2);
  });

  it('guardrail: rpr-80 cuts to 6%/12 of current value below 80% of start', () => {
    expect(truthOf(first('guardrail'))).toBeCloseTo(3750, 6);
    expect(truthOf(second('guardrail'))).toBeCloseTo(3500, 6);
  });

  it('guardrail wording explains the lower-of rule', () => {
    const worked = MODULES.guardrail.worked();
    const result = MODULES.guardrail.result(first('guardrail'), truthOf(first('guardrail')));
    expect(worked).toContain('lower of');
    expect(result).toContain('lower of');
  });

  it('sequencing: draws taxable first, traditional only for the gap or RMD floor', () => {
    expect(truthOf(first('sequencing'))).toBeCloseTo(2000, 6);
    expect(truthOf(second('sequencing'))).toBeCloseTo(5000, 6);
  });

  it('every module grades, gives three-part feedback, and rejects blanks', () => {
    MODULE_IDS.forEach(id => {
      const item = first(id);
      const t = truthOf(item);
      expect(gradeAnswer(item, t).correct).toBe(true);
      expect(gradeAnswer(item, '').correct).toBe(false);
      expect(gradeAnswer(item, t * 1.2).correct).toBe(false);
      expect(Object.keys(feedback(item, t * 1.2, 5))).toEqual(['where', 'how', 'next']);
    });
  });

  it('itemFor rotates within the chosen module', () => {
    expect(itemFor(null, 'guardrail')).toBe(first('guardrail'));
    const l = recordAttempt(null, 'guardrail', { correct: true, confidence: 3, now: T0 });
    expect(itemFor(l, 'guardrail')).toBe(second('guardrail'));
  });
});
