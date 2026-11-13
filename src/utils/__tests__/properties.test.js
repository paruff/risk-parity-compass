// Property-based review of the portfolio math (fast-check, fixed seed).
//
// `it(...)`  : an invariant that holds today (some are regressions for fixed findings).
// `bug(...)` : an invariant that SHOULD hold but does not. It is registered with
//              `it.fails`, so the suite stays green while the bug exists and turns
//              red the moment the bug is fixed (then change `bug` to `it`).
// Run `SHOW_BUGS=1 npm test -- properties` to see each bug's shrunk counterexample.
// Findings are written up in docs/superpowers/plans/2026-11-13-portfolio-math-review.md.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  inverseVolWeights,
  ercWeights,
  riskContribution,
  correlation,
  taxLocationWaterfall,
  generateTrades,
  simulatePerformance,
  monteCarloSimulation,
} from '../finance.js';
import {
  drawdownPath,
  rollingWithdrawalRates,
  monteCarloWithWithdrawals,
  withdrawalSequence,
  guardrailSpend,
} from '../withdrawal.js';
import { buildPortfolioPath } from '../portfolioPath.js';
import { rollingLongRun, LONG_RUN, PROXY } from '../longRun.js';

const bug = process.env.SHOW_BUGS ? it : it.fails;
const RUN = { seed: 20261113, numRuns: 100 };
const check = (arbs, predicate, opts = {}) =>
  fc.assert(fc.property(...arbs, predicate), { ...RUN, ...opts });

// ── Arbitraries ────────────────────────────────────────────────────────────
const num = (min, max) => fc.double({ min, max, noNaN: true });
const listOf = (arb, n) => fc.array(arb, { minLength: n, maxLength: n });
const sum = xs => xs.reduce((a, b) => a + b, 0);
const stdev = xs => {
  const m = sum(xs) / xs.length;
  return Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1));
};
const NAMES = ['A', 'B', 'C', 'D', 'E'];

// Vols plus a one-factor correlation matrix rho_ij = b_i * b_j (0.3 <= |b| <= 0.9), which
// is positive definite by construction. Mixed-sign loadings model stocks vs bonds.
const loading = fc.oneof(num(-0.9, -0.3), num(0.3, 0.9));
const market = fc.integer({ min: 2, max: 5 }).chain(n =>
  fc.tuple(listOf(num(0.03, 0.6), n), listOf(loading, n)).map(([v, b]) => {
    const tickers = NAMES.slice(0, n);
    return {
      tickers,
      vols: Object.fromEntries(tickers.map((t, i) => [t, v[i]])),
      corr: Object.fromEntries(
        tickers.map((a, i) => [
          a,
          Object.fromEntries(tickers.map((c, j) => [c, i === j ? 1 : b[i] * b[j]])),
        ])
      ),
    };
  })
);
// Share of portfolio variance per asset, computed here rather than by riskContribution.
const riskShares = ({ tickers, vols, corr }, w) => {
  const rc = tickers.map(a => w[a] * sum(tickers.map(c => corr[a][c] * vols[a] * vols[c] * w[c])));
  return rc.map(x => x / sum(rc));
};
const weightsFor = tickers =>
  listOf(num(0.05, 1), tickers.length).map(raw =>
    Object.fromEntries(tickers.map((t, i) => [t, raw[i] / sum(raw)]))
  );
// Price series from bounded per-step returns.
const prices = n =>
  fc
    .tuple(num(10, 500), listOf(num(-0.04, 0.04), n - 1))
    .map(([p0, rets]) => rets.reduce((acc, r) => [...acc, acc.at(-1) * (1 + r)], [p0]));

// Holdings across accounts, with account balances equal to what each account holds,
// so "total value" is the same number however it is computed.
const ACCTS = ['Taxable', 'Traditional IRA / 401k', 'Roth IRA'];
const TICKS = ['SPY', 'TLT', 'GLD', 'QQQ'];
const book = fc
  .record({
    px: listOf(num(20, 500), TICKS.length),
    shares: listOf(listOf(fc.integer({ min: 0, max: 400 }), TICKS.length), ACCTS.length),
    weights: weightsFor(TICKS),
  })
  .map(({ px, shares, weights }) => {
    const priceOf = Object.fromEntries(TICKS.map((t, i) => [t, px[i]]));
    const holdings = Object.fromEntries(
      ACCTS.map((a, i) => [a, Object.fromEntries(TICKS.map((t, j) => [t, shares[i][j]]))])
    );
    const accounts = Object.fromEntries(
      ACCTS.map((a, i) => [a, sum(TICKS.map((t, j) => shares[i][j] * px[j]))])
    );
    const total = sum(Object.values(accounts));
    const allocation = taxLocationWaterfall(weights, priceOf, accounts, total);
    return { priceOf, holdings, accounts, total, weights, allocation };
  })
  .filter(b => b.total > 1000);

// ── Weights and risk ───────────────────────────────────────────────────────
describe('properties: weights and risk', () => {
  it('inverseVolWeights sums to 1 and gives every asset the same weight × vol', () => {
    check([market], ({ tickers, vols }) => {
      const w = inverseVolWeights(vols);
      expect(sum(Object.values(w))).toBeCloseTo(1, 12);
      for (const t of tickers) expect(w[t] * vols[t]).toBeCloseTo(w.A * vols.A, 12);
    });
  });

  it('ercWeights equals inverse-vol when every pair has the same correlation', () => {
    check([market, num(0, 0.9)], ({ tickers, vols }, c) => {
      const corr = Object.fromEntries(
        tickers.map(a => [a, Object.fromEntries(tickers.map(b => [b, a === b ? 1 : c]))])
      );
      const w = ercWeights(vols, corr);
      const iv = inverseVolWeights(vols);
      for (const t of tickers) expect(w[t]).toBeCloseTo(iv[t], 8);
    });
  });

  // Regression, finding 4 (fixed): the fixed-point update takes sqrt(target / rc_i); when an asset is negatively
  // correlated with the rest its starting rc_i is negative and every weight becomes NaN.
  it('ercWeights returns finite long-only weights with equal risk shares', () => {
    check([market], m => {
      const w = ercWeights(m.vols, m.corr);
      for (const t of m.tickers) expect(w[t]).toBeGreaterThan(0);
      expect(sum(Object.values(w))).toBeCloseTo(1, 9);
      for (const share of riskShares(m, w)) expect(share).toBeCloseTo(1 / m.tickers.length, 6);
    });
  });

  it('riskContribution matches an independent variance decomposition', () => {
    check([market.chain(m => weightsFor(m.tickers).map(w => ({ m, w })))], ({ m, w }) => {
      const rc = riskContribution(w, m.vols, m.corr);
      const oracle = riskShares(m, w);
      m.tickers.forEach((t, i) => expect(rc[t]).toBeCloseTo(oracle[i], 10));
    });
  });

  it('correlation is symmetric, bounded, and unchanged by positive rescaling', () => {
    check(
      [listOf(num(-0.1, 0.1), 30), listOf(num(-0.1, 0.1), 30), num(0.1, 10), num(-1, 1)],
      (a, b, k, shift) => {
        const r = correlation(a, b);
        expect(Math.abs(r)).toBeLessThanOrEqual(1 + 1e-12);
        expect(correlation(b, a)).toBeCloseTo(r, 12);
        expect(
          correlation(
            a.map(x => k * x + shift),
            b
          )
        ).toBeCloseTo(r, 9);
      }
    );
  });
});

// ── Allocation and trades ──────────────────────────────────────────────────
describe('properties: allocation and trades', () => {
  it('taxLocationWaterfall places every target dollar and never overfills an account', () => {
    check([book], ({ weights, accounts, total, allocation }) => {
      for (const t of TICKS) {
        const placed = sum(ACCTS.map(a => allocation[a][t] ?? 0));
        expect(placed).toBeCloseTo(weights[t] * total, 4);
      }
      for (const a of ACCTS) {
        expect(sum(Object.values(allocation[a]))).toBeLessThanOrEqual(accounts[a] + 1e-6);
      }
    });
  });

  // Regression, finding 6 (fixed): the trade's account is "where the target puts the ticker" (or the first
  // account), not where the shares are, so it can tell you to sell shares you do not hold there.
  it('a SELL never exceeds the shares held in the account it names', () => {
    check([book], ({ holdings, allocation, priceOf, total }) => {
      for (const tr of generateTrades(holdings, allocation, priceOf, total, 0.05)) {
        if (tr.action === 'SELL') {
          expect(tr.shares).toBeLessThanOrEqual(holdings[tr.account][tr.ticker] + 0.01);
        }
      }
    });
  });

  // Regression, finding 7 (fixed): only tickers past the drift threshold trade, so buys and sells do not net
  // to zero and the list cannot be executed without outside cash (or leaves cash idle).
  it('generated trades are self-financing (buys equal sells)', () => {
    check([book], ({ holdings, allocation, priceOf, total }) => {
      const trades = generateTrades(holdings, allocation, priceOf, total, 0.05);
      const net = sum(trades.map(t => (t.action === 'BUY' ? 1 : -1) * t.dollarAmount));
      expect(Math.abs(net)).toBeLessThan(1);
    });
  });
});

// ── Backtest and portfolio path ────────────────────────────────────────────
describe('properties: backtest and portfolio path', () => {
  const twoSeries = fc.tuple(prices(40), prices(40), weightsFor(['A', 'B']));

  it('with no rebalancing, both backtest lines equal Σ w × p(t)/p(0)', () => {
    check([twoSeries], ([a, b, w]) => {
      const r = simulatePerformance({ A: a, B: b }, w, Infinity);
      a.forEach((_, d) => {
        const oracle = (w.A * a[d]) / a[0] + (w.B * b[d]) / b[0];
        expect(r.buyAndHold[d]).toBeCloseTo(oracle, 9);
        expect(r.rebalanced[d]).toBeCloseTo(oracle, 9);
      });
    });
  });

  it('buildPortfolioPath equals startingValue × Σ w × p(t)/p(0), whatever the price units', () => {
    check([twoSeries, num(1e4, 5e6), num(0.01, 100)], ([a, b, w], start, unit) => {
      const path = buildPortfolioPath({ A: a.map(p => p * unit), B: b }, w, start);
      a.forEach((_, d) => {
        const oracle = start * ((w.A * a[d]) / a[0] + (w.B * b[d]) / b[0]);
        expect(path[d] / oracle).toBeCloseTo(1, 9);
      });
    });
  });

  // Regression, finding 8 (fixed): series are aligned from their first element, not their most recent one
  // (correlationMatrix aligns from the end), so a ticker with a shorter history shifts dates.
  it('older history on one ticker does not change the backtest of the shared window', () => {
    check([twoSeries, prices(15)], ([a, b, w], older) => {
      const scale = a[0] / older.at(-1);
      const longA = [...older.slice(0, -1).map(p => p * scale), ...a];
      const expected = simulatePerformance({ A: a, B: b }, w, 0.05);
      const actual = simulatePerformance({ A: longA, B: b }, w, 0.05);
      expected.buyAndHold.forEach((v, d) => expect(actual.buyAndHold[d]).toBeCloseTo(v, 9));
    });
  });
});

// ── Drawdown and rolling withdrawal rates ──────────────────────────────────
describe('properties: drawdown', () => {
  // Constant growth g per month: balance after the (i+1)-th withdrawal is
  // V·g^i − s·(g^(i+1) − 1)/(g − 1), floored at zero (spec §3.1).
  const annuity = (V, s, g, i) => Math.max(0, V * g ** i - (s * (g ** (i + 1) - 1)) / (g - 1));
  const growthPath = (V, g, n) => Array.from({ length: n }, (_, i) => V * g ** i);

  it('drawdownPath matches the closed-form annuity balance under constant growth', () => {
    check(
      [num(1e5, 5e6), num(0.02, 0.1), num(0.001, 0.01), fc.integer({ min: 12, max: 480 })],
      (V, rate, monthlyGrowth, n) => {
        const g = 1 + monthlyGrowth;
        const s = (rate * V) / 12;
        const r = drawdownPath(growthPath(V, g, n), s);
        for (const i of [0, Math.floor(n / 2), n - 1]) {
          expect(Math.abs(r.balances[i] - annuity(V, s, g, i))).toBeLessThan(1e-6 * V);
        }
      }
    );
  });

  it('spending more never leaves a larger terminal balance', () => {
    check([prices(120), num(500, 20000), num(0, 5000), num(0, 0.06)], (p, s, extra, infl) => {
      const path = p.map(x => (x / p[0]) * 1e6);
      const lo = drawdownPath(path, s, { inflationRate: infl });
      const hi = drawdownPath(path, s + extra, { inflationRate: infl });
      expect(hi.terminalReal).toBeLessThanOrEqual(lo.terminalReal + 1e-6);
    });
  });

  // BUG 11: the cash buffer is funded with months × spend even when that exceeds the
  // portfolio; the shortfall is clamped to zero, so the buffer holds money that never existed.
  bug('BUG 11: portfolio plus cash buffer never exceeds the starting value on a flat path', () => {
    check([num(1e5, 3e6), num(1000, 20000), fc.integer({ min: 0, max: 36 })], (V, s, months) => {
      const r = drawdownPath(Array(24).fill(V), s, { cashBufferMonths: months });
      expect(r.terminalReal + r.bufferBalance).toBeLessThanOrEqual(V + 1e-6);
    });
  });

  // BUG 12: drawdownPath has no `age` option (App.jsx passes one), so VPW always throws.
  bug('BUG 12: drawdownPath supports the vpw guardrail when given an age', () => {
    check([fc.integer({ min: 60, max: 100 })], age => {
      drawdownPath(Array(24).fill(1e6), 4000, { guardrail: 'vpw', age });
    });
  });

  // Regression, finding 5 (fixed): successRate tests the user's dollar spend against each window's own starting
  // value. The path starts at the user's portfolio and grows, so later windows start
  // richer and survive spending that the user's actual portfolio would not (spec §3.2, §3.4).
  it('identical return windows give identical outcomes for the same spend', () => {
    check(
      [
        num(1e5, 5e6),
        num(0.001, 0.008),
        fc.integer({ min: 5, max: 20 }),
        fc.integer({ min: 12, max: 60 }),
        fc.oneof(num(0.5, 0.9), num(1.1, 1.5)),
      ],
      (V, monthlyGrowth, years, extraWindows, k) => {
        const g = 1 + monthlyGrowth;
        const n = years * 12;
        // Largest spend the user's V sustains for n withdrawals; k scales around it.
        const sustainable = (V * g ** (n - 1) * (g - 1)) / (g ** n - 1);
        const r = rollingWithdrawalRates(growthPath(V, g, n + extraWindows), {
          horizonYears: years,
          monthlySpend: k * sustainable,
        });
        expect(r.samples.map(s => s.depleted)).toEqual(r.samples.map(() => k > 1));
        expect(r.successRate).toBe(k > 1 ? 0 : 1);
      }
    );
  });

  // Regression, finding 5, reachable form (fixed): the 1928+ path compounds from totalValue, so a 1990 window
  // starts with hundreds of times the user's money while spend stays in today's dollars.
  it('long-run success rate replays the user’s own portfolio from each start year', () => {
    const proxied = ['VTI', 'IEF', 'GLD', 'BIL'];
    check(
      [
        weightsFor(proxied),
        num(1e5, 5e6),
        num(0.03, 0.08),
        num(0, 0.05),
        fc.integer({ min: 15, max: 40 }),
      ],
      (w, V, rate, infl, H) => {
        const yearly = LONG_RUN.years.map((_, y) =>
          sum(proxied.map(t => w[t] * LONG_RUN.series[PROXY[t].series][y]))
        );
        let survived = 0;
        const windows = yearly.length + 1 - H + 1;
        for (let a = 0; a < windows; a++) {
          let bal = V;
          let alive = true;
          for (let k = 0; k < H && alive; k++) {
            bal -= rate * V * (1 + infl) ** k;
            if (bal <= 0) alive = false;
            else if (k < H - 1) bal *= 1 + yearly[a + k];
          }
          if (alive) survived++;
        }
        const r = rollingLongRun(w, V, {
          horizonYears: H,
          inflationRate: infl,
          annualSpend: rate * V,
        });
        expect(r.windowCount).toBe(windows);
        expect(r.successRate).toBeCloseTo(survived / windows, 9);
      },
      { numRuns: 30 }
    );
  });
});

// ── Monte Carlo ────────────────────────────────────────────────────────────
describe('properties: Monte Carlo', () => {
  const one = { A: { A: 1 } };
  const seed = fc.integer({ min: 1, max: 1e6 });
  const MC = { numRuns: 12 };

  // Regression, finding 1 (fixed): shocks are L·z with L from the per-step covariance (already σ·√dt) and are
  // then multiplied by √dt again, so simulated vol is σ/√252 (daily) or σ/√12 (monthly).
  it('monteCarloSimulation terminal log-return dispersion is σ√T', () => {
    check(
      [num(0.05, 0.5), seed],
      (sigma, s) => {
        const steps = 63;
        const r = monteCarloSimulation({ A: [100] }, { A: 1 }, { A: sigma }, one, {
          simulations: 2000,
          steps,
          seed: s,
        });
        const sd = stdev(Array.from(r.terminalValues, Math.log));
        expect(sd / (sigma * Math.sqrt(steps / 252))).toBeCloseTo(1, 0.5); // within ~16%
      },
      MC
    );
  });

  it('monteCarloWithWithdrawals (Gaussian mode) dispersion is σ√T', () => {
    check(
      [num(0.05, 0.5), seed, num(1e5, 5e6)],
      (sigma, s, V) => {
        const r = monteCarloWithWithdrawals({ A: [100] }, { A: 1 }, { A: sigma }, one, {
          simulations: 2000,
          steps: 12,
          driftMode: 'zero',
          inflationRate: 0,
          startingValue: V,
          seed: s,
        });
        const sd = stdev(Array.from(r.terminalValues, v => Math.log(v / V)));
        expect(sd / sigma).toBeCloseTo(1, 0.5);
      },
      MC
    );
  });

  // Regression, finding 2 (fixed): historical drift uses years = closes.length / 12 (n closes span n − 1 months)
  // and then applies the resulting CAGR as a continuously compounded rate.
  it('with zero vol, historical drift reproduces the history’s own growth rate', () => {
    check(
      [num(-0.05, 0.12), fc.integer({ min: 3, max: 25 }), fc.integer({ min: 1, max: 30 })],
      (g, histYears, simYears) => {
        const closes = Array.from(
          { length: histYears * 12 + 1 },
          (_, i) => 100 * (1 + g) ** (i / 12)
        );
        const r = monteCarloWithWithdrawals({ A: closes }, { A: 1 }, { A: 0 }, one, {
          simulations: 1,
          steps: simYears * 12,
          inflationRate: 0,
          startingValue: 1e6,
        });
        expect(r.terminalValues[0] / (1e6 * (1 + g) ** simYears)).toBeCloseTo(1, 6);
      }
    );
  });

  // BUG 3: stats.cagr is mean^(1/years) − 1 on a dollar mean, not mean / startingValue.
  bug('BUG 3: stats.cagr is zero when nothing grows, whatever the starting value', () => {
    check([num(1e5, 5e6), fc.integer({ min: 1, max: 40 })], (V, years) => {
      const r = monteCarloWithWithdrawals({ A: [100] }, { A: 1 }, { A: 0 }, one, {
        simulations: 5,
        steps: years * 12,
        driftMode: 'zero',
        inflationRate: 0,
        startingValue: V,
      });
      expect(r.terminalValues[0]).toBeCloseTo(V, 6);
      expect(r.stats.cagr).toBeCloseTo(0, 9);
    });
  });
});

// ── Withdrawal sequencing and guardrails ───────────────────────────────────
describe('properties: sequencing and guardrails', () => {
  it('withdrawalSequence conserves dollars and never overdraws an account', () => {
    const scenario = fc.record({
      taxable: num(0, 2e6),
      trad: num(0, 2e6),
      roth: num(0, 2e6),
      spend: num(0, 30000),
      rmdShare: num(0, 0.01), // monthly RMD as a share of the traditional balance
      strategy: fc.constantFrom('taxable-first', 'bracket-fill'),
      bracketHeuristic: fc.boolean(),
      conversion: num(0, 5000),
    });
    check([scenario], s => {
      const accounts = { Taxable: s.taxable, 'Traditional IRA / 401k': s.trad, 'Roth IRA': s.roth };
      const r = withdrawalSequence(accounts, s.spend, {
        strategy: s.strategy,
        bracketHeuristic: s.bracketHeuristic,
        rothConversionMonthly: s.conversion,
        rmdByAccount: { 'Traditional IRA / 401k': s.rmdShare * s.trad },
      });
      for (const a of Object.keys(accounts)) {
        expect(r.byAccount[a]).toBeGreaterThanOrEqual(0);
        expect(r.byAccount[a]).toBeLessThanOrEqual(accounts[a] + 1e-6);
      }
      expect(r.totalSpend + r.shortfall).toBeCloseTo(s.spend + r.rmdSurplus, 6);
    });
  });

  // BUG 9: the floor/ceiling clamp (0.8–1.2 × a hard-coded 5% of the STARTING value)
  // is applied even in the 'normal' state, so spending jumps although no guardrail was hit.
  bug(
    'BUG 9: Guyton-Klinger leaves spend unchanged while the rate is inside the guardrails',
    () => {
      check([num(2e5, 5e6), num(0.5, 1.5), num(0.042, 0.058)], (start, ratio, rate) => {
        const value = start * ratio;
        const spend = (rate * value) / 12;
        const r = guardrailSpend(spend, value, start, 'guyton-klinger', { step: 12 });
        expect(r.policyState).toBe('normal');
        expect(r.nextSpend).toBeCloseTo(spend, 6);
      });
    }
  );
});
