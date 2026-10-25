import Tooltip from './Tooltip';

export default function CorrelationMatrix({ S, tickers, corrMatrix }) {
  if (Object.keys(corrMatrix).length === 0) return null;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        <Tooltip tip="Pairwise correlation of daily returns. Values near 1.0 mean assets move together (less diversification).">
          Correlation Matrix
        </Tooltip>
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
        Lower correlation = better diversification. Ideal: uncorrelated assets.
      </div>
      <div style={S.tableWrap}>
        <table className="sd-table" style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, fontSize: 12 }}>Ticker</th>
              {tickers.map(t => (
                <th key={t} style={{ ...S.th, fontFamily: 'monospace' }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map(a => (
              <tr key={a}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{a}</td>
                {tickers.map(b => {
                  const v = corrMatrix[a]?.[b] ?? 0;
                  const abs = Math.abs(v);
                  const bg =
                    a === b
                      ? '#1e293b'
                      : v > 0.5
                        ? `rgba(239,68,68,${abs * 0.4})`
                        : v > 0
                          ? `rgba(251,191,36,${abs * 0.3})`
                          : `rgba(34,197,94,${abs * 0.4})`;
                  return (
                    <td
                      key={b}
                      style={{
                        ...S.td,
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontSize: 13,
                        background: bg,
                        color: a === b ? '#94a3b8' : '#e2e8f0',
                      }}
                    >
                      {a === b ? '—' : v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
