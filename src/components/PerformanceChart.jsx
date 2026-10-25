import Tooltip from './Tooltip';
import { fmt } from '../utils/finance';

export default function PerformanceChart({ S, perfData }) {
  if (perfData.dates.length <= 10) return null;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        <Tooltip tip="Simulated cumulative return: rebalanced at your threshold vs buy-and-hold (no rebalancing).">
          Performance Simulation
        </Tooltip>
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
        Rebalanced (blue) vs buy-and-hold (gray) over {perfData.dates.length} trading days.
      </div>
      <div
        style={{
          position: 'relative',
          height: 200,
          background: '#0a0f1e',
          borderRadius: 6,
          padding: '12px 8px 24px 52px',
        }}
      >
        <svg
          viewBox={`0 0 ${Math.max(perfData.dates.length - 1, 1)} 1`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%' }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map(y => (
            <line
              key={y}
              x1={0}
              y1={y}
              x2={perfData.dates.length - 1}
              y2={y}
              stroke="#1e293b"
              strokeWidth={0.005}
            />
          ))}
          <polyline
            points={perfData.buyAndHold
              .map(
                (v, i) =>
                  `${i},${1 - (v - Math.min(...perfData.buyAndHold, ...perfData.rebalanced)) / (Math.max(...perfData.buyAndHold, ...perfData.rebalanced) - Math.min(...perfData.buyAndHold, ...perfData.rebalanced) || 1)}`
              )
              .join(' ')}
            fill="none"
            stroke="#64748b"
            strokeWidth={0.008}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={perfData.rebalanced
              .map(
                (v, i) =>
                  `${i},${1 - (v - Math.min(...perfData.buyAndHold, ...perfData.rebalanced)) / (Math.max(...perfData.buyAndHold, ...perfData.rebalanced) - Math.min(...perfData.buyAndHold, ...perfData.rebalanced) || 1)}`
              )
              .join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={0.008}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: 12,
            bottom: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#94a3b8',
          }}
        >
          <span>{fmt.pct(Math.max(...perfData.rebalanced, ...perfData.buyAndHold) - 1)}</span>
          <span>+0%</span>
          <span>{fmt.pct(Math.min(...perfData.rebalanced, ...perfData.buyAndHold) - 1)}</span>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 8,
          fontSize: 13,
          color: '#94a3b8',
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#3b82f6',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          Rebalanced
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#94a3b8',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          Buy &amp; hold
        </span>
        <span style={{ marginLeft: 'auto' }}>
          Return: rebalanced {fmt.pct(perfData.rebalanced[perfData.rebalanced.length - 1] - 1)} vs
          B&H {fmt.pct(perfData.buyAndHold[perfData.buyAndHold.length - 1] - 1)}
        </span>
      </div>
    </div>
  );
}
