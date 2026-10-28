import Tooltip from './Tooltip';
import { fmt, clampPct } from '../utils/finance';
import { C } from '../tokens';

export default function RiskContribution({ S, tickers, targetWeights, riskContrib }) {
  if (Object.keys(riskContrib).length === 0) return null;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        <Tooltip tip="How much risk each asset contributes to total portfolio risk. Risk parity aims for equal contribution.">
          Risk Contribution
        </Tooltip>
      </div>
      <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginBottom: 12 }}>
        Weight % vs risk contribution %. Equal risk contribution = true risk parity.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {tickers.map(t => {
          const w = targetWeights[t] ?? 0;
          const rc = riskContrib[t] ?? 0;
          const diff = rc - w;
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ width: 44, fontFamily: 'monospace', color: C.onSurfaceMuted }}>
                {t}
              </span>
              <div style={{ flex: 1, position: 'relative', height: 16 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 2,
                    height: 12,
                    width: `${w * 100}%`,
                    background: '#3b82f633',
                    borderRadius: 2,
                    border: '1px dashed #3b82f6',
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 2,
                    height: 12,
                    width: `${clampPct(rc) * 100}%`,
                    background: diff > 0.02 ? '#f59e0b88' : '#16a34a88',
                    borderRadius: 2,
                    opacity: 0.85,
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
              <span style={{ width: 50, textAlign: 'right', color: C.onSurfaceMuted }}>
                {fmt.pct(w)}
              </span>
              <span
                style={{
                  width: 50,
                  textAlign: 'right',
                  color: Math.abs(diff) > 0.02 ? '#f59e0b' : C.positive,
                }}
              >
                {fmt.pct(rc)}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 13, color: C.onSurfaceMuted }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              background: '#3b82f633',
              border: '1px dashed #3b82f6',
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Weight
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              background: '#16a34a88',
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Risk contribution
        </span>
      </div>
    </div>
  );
}
