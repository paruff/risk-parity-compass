import { describe, it, expect } from 'vitest';
import {
  PORTFOLIO_TEMPLATES,
  diversificationScore,
  getMacroClass,
  validateAllocations,
  assertTemplateValid,
  getTemplate,
  getTemplateList,
  normalizeTemplateWeights,
  metricDifference,
  weightRows,
} from '../portfolios';

describe('PORTFOLIO_TEMPLATES', () => {
  it('has at least 4 templates with valid allocations summing to 1', () => {
    expect(PORTFOLIO_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const t of PORTFOLIO_TEMPLATES) {
      expect(t.id).toBeTypeOf('string');
      expect(t.name).toBeTypeOf('string');
      expect(t.source).toBeTypeOf('string');
      expect(t.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.allocations).toBeTypeOf('object');
      const sum = Object.values(t.allocations).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
      for (const w of Object.values(t.allocations)) {
        expect(w).toBeGreaterThan(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });

  it('pins each template to its sourced weights', () => {
    const w = id => PORTFOLIO_TEMPLATES.find(t => t.id === id).allocations;
    expect(w('golden-butterfly')).toEqual({
      VTI: 0.205,
      VIOV: 0.205,
      VGLT: 0.2,
      SHY: 0.19,
      GLDM: 0.2,
    });
    expect(w('all-seasons')).toEqual({ VTI: 0.3, VGLT: 0.4, VGIT: 0.15, GLDM: 0.075, PDBC: 0.075 });
    expect(w('golden-ratio')).toEqual({
      VUG: 0.21,
      VIOV: 0.21,
      VGLT: 0.26,
      GLDM: 0.16,
      DBMF: 0.1,
      BIL: 0.06,
    });
    expect(w('permanent-portfolio')).toEqual({ VTI: 0.25, VGLT: 0.25, VGSH: 0.25, GLDM: 0.25 });
  });

  it('every template records a source URL or named author', () => {
    for (const t of PORTFOLIO_TEMPLATES) {
      expect(t.source).toMatch(/riskparityradio\.com|Harry Browne/);
    }
  });

  it('has no unpublished RPR templates', () => {
    const ids = PORTFOLIO_TEMPLATES.map(t => t.id);
    expect(ids).not.toContain('risk-parity-core');
    expect(ids).not.toContain('aggressive-50-50');
  });

  it('assertTemplateValid throws instead of adjusting weights', () => {
    expect(() => assertTemplateValid({ id: 'x', allocations: { A: 0.5, B: 0.4 } })).toThrow(/sum/);
    for (const t of PORTFOLIO_TEMPLATES) expect(() => assertTemplateValid(t)).not.toThrow();
  });

  it('all templates have unique IDs', () => {
    const ids = PORTFOLIO_TEMPLATES.map(t => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(PORTFOLIO_TEMPLATES.length);
  });

  it('all templates have lastReviewed in YYYY-MM-DD format', () => {
    for (const t of PORTFOLIO_TEMPLATES) {
      expect(t.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('validateAllocations', () => {
  it('returns true for valid allocations summing to 1', () => {
    expect(validateAllocations({ A: 0.5, B: 0.5 })).toBe(true);
    expect(validateAllocations({ A: 0.33, B: 0.33, C: 0.34 })).toBe(true);
  });

  it('returns false for allocations not summing to 1', () => {
    expect(validateAllocations({ A: 0.5, B: 0.3 })).toBe(false);
    expect(validateAllocations({ A: 0.6, B: 0.6 })).toBe(false);
  });

  it('handles floating point tolerance', () => {
    expect(validateAllocations({ A: 1 / 3, B: 1 / 3, C: 1 / 3 })).toBe(true);
  });
});

describe('getTemplate', () => {
  it('returns template by exact ID', () => {
    const t = getTemplate('golden-butterfly');
    expect(t).toBeDefined();
    expect(t.id).toBe('golden-butterfly');
  });

  it('returns undefined for unknown ID', () => {
    expect(getTemplate('nonexistent')).toBeUndefined();
  });
});

describe('getTemplateList', () => {
  it('returns array of {id, name} for all templates', () => {
    const list = getTemplateList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(PORTFOLIO_TEMPLATES.length);
    for (const item of list) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
    }
  });
});

describe('normalizeTemplateWeights', () => {
  it('renormalizes weights for available tickers only', () => {
    const template = { A: 0.5, B: 0.3, C: 0.2 };
    const available = ['A', 'B']; // C missing
    const norm = normalizeTemplateWeights(template, available);
    expect(norm.A).toBeCloseTo(0.5 / 0.8, 6);
    expect(norm.B).toBeCloseTo(0.3 / 0.8, 6);
    expect(norm.C).toBeUndefined();
  });

  it('returns empty object when no tickers available', () => {
    const norm = normalizeTemplateWeights({ A: 0.5, B: 0.5 }, []);
    expect(norm).toEqual({});
  });

  it('returns same weights when all tickers available', () => {
    const template = { A: 0.5, B: 0.5 };
    const available = ['A', 'B'];
    const norm = normalizeTemplateWeights(template, available);
    expect(norm.A).toBe(0.5);
    expect(norm.B).toBe(0.5);
  });
});

describe('getMacroClass', () => {
  it('returns correct class for known tickers', () => {
    expect(getMacroClass('VTI')).toBe('US Equity');
    expect(getMacroClass('TLT')).toBe('US Long Bonds');
    expect(getMacroClass('GLD')).toBe('Gold');
    expect(getMacroClass('VNQ')).toBe('US REIT');
  });

  it('returns "Other" for unknown tickers', () => {
    expect(getMacroClass('UNKNOWN')).toBe('Other');
  });
});

describe('diversificationScore', () => {
  it('flags high average correlation > 0.6', () => {
    const highCorr = {
      A: { A: 1, B: 0.8, C: 0.8 },
      B: { A: 0.8, B: 1, C: 0.8 },
      C: { A: 0.8, B: 0.8, C: 1 },
    };
    const r = diversificationScore(highCorr);
    expect(r.avgPairwiseCorrelation).toBeCloseTo(0.8, 2);
    expect(r.warnings).toContain(
      'Average pairwise correlation exceeds 0.6 — portfolio may lack diversification'
    );
  });

  it('flags low macro class count < 4', () => {
    const equityOnly = {
      VTI: { VTI: 1, VOO: 0.95 },
      VOO: { VTI: 0.95, VOO: 1 },
    };
    const r = diversificationScore(equityOnly);
    expect(r.classCount).toBeLessThan(4);
    expect(r.warnings).toContain('Fewer than 4 macro asset classes represented');
  });

  it('flags extreme correlation > 0.9', () => {
    const extreme = {
      A: { A: 1, B: 0.95 },
      B: { A: 0.95, B: 1 },
    };
    const r = diversificationScore(extreme);
    expect(r.maxPairwiseCorrelation).toBeCloseTo(0.95, 2);
    expect(r.warnings).toContain(
      'Extreme pairwise correlation > 0.9 detected — two assets may be redundant'
    );
  });

  it('passes for well-diversified matrix (but flags < 4 classes)', () => {
    const wellDiv = {
      VTI: { VTI: 1, TLT: -0.2, GLD: 0.1 },
      TLT: { VTI: -0.2, TLT: 1, GLD: 0.05 },
      GLD: { VTI: 0.1, TLT: 0.05, GLD: 1 },
    };
    const r = diversificationScore(wellDiv);
    expect(r.avgPairwiseCorrelation).toBeLessThan(0.6);
    expect(r.classCount).toBe(3);
    // 3 classes < 4 triggers warning (correct RPR behavior)
    expect(r.warnings).toContain('Fewer than 4 macro asset classes represented');
  });

  it('handles single ticker gracefully', () => {
    const single = { VTI: { VTI: 1 } };
    const r = diversificationScore(single);
    expect(r.avgPairwiseCorrelation).toBe(0);
    expect(r.maxPairwiseCorrelation).toBe(0);
    expect(r.classCount).toBe(1);
    expect(r.warnings).toContain('Need at least 2 tickers for diversification analysis');
  });

  it('handles empty matrix gracefully', () => {
    const r = diversificationScore({});
    expect(r.avgPairwiseCorrelation).toBe(0);
    expect(r.classCount).toBe(0);
    expect(r.warnings).toContain('Need at least 2 tickers for diversification analysis');
  });

  it('computes correct average for 3-asset matrix', () => {
    // Correlations: A-B=0.2, A-C=0.1, B-C=0.3 → avg = 0.6/3 = 0.2
    const matrix = {
      A: { A: 1, B: 0.2, C: 0.1 },
      B: { A: 0.2, B: 1, C: 0.3 },
      C: { A: 0.1, B: 0.3, C: 1 },
    };
    const r = diversificationScore(matrix);
    expect(r.avgPairwiseCorrelation).toBeCloseTo(0.2, 4);
    expect(r.maxPairwiseCorrelation).toBeCloseTo(0.3, 4);
  });
});

describe('comparison helpers', () => {
  it('metricDifference is template minus current (positive = template has more)', () => {
    const d = metricDifference(
      { swr: 0.04, pwr: 0.03, successRate: 0.9, maxDrawdown: 0.35 },
      { swr: 0.05, pwr: 0.025, successRate: 0.95, maxDrawdown: 0.2 }
    );
    expect(d.swr).toBeCloseTo(0.01, 10);
    expect(d.pwr).toBeCloseTo(-0.005, 10);
    expect(d.successRate).toBeCloseTo(0.05, 10);
    expect(d.maxDrawdown).toBeCloseTo(-0.15, 10);
  });

  it('weightRows covers the union of tickers with differences in percentage points', () => {
    const rows = weightRows({ SPY: 0.6, TLT: 0.4 }, { VTI: 0.5, TLT: 0.5 });
    const byTicker = Object.fromEntries(rows.map(r => [r.ticker, r]));
    expect(rows).toHaveLength(3);
    expect(byTicker.SPY).toMatchObject({ current: 0.6, template: 0 });
    expect(byTicker.SPY.diffPp).toBeCloseTo(-60, 10);
    expect(byTicker.VTI.diffPp).toBeCloseTo(50, 10);
    expect(byTicker.TLT.diffPp).toBeCloseTo(10, 10);
  });
});
