import { fmt } from '../utils/finance';
import { C } from '../tokens';

export default function FanChart({ bands, steps, monthlySpend }) {
  if (!bands || !bands.p50 || bands.p50.length === 0)
    return (
      <div style={{ color: C.onSurfaceMuted, textAlign: 'center', padding: 20 }}>
        No Monte Carlo data
      </div>
    );

  const width = 600;
  const height = 200;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const allVals = [...bands.p90, ...bands.p75, ...bands.p50, ...bands.p25, ...bands.p10];
  const maxVal = Math.max(...allVals) * 1.05 || 1;

  const xScale = i => margin.left + (i / (steps - 1)) * innerWidth;
  const yScale = val => margin.top + innerHeight - (val / maxVal) * innerHeight;

  return (
    <div style={{ width: '100%', maxWidth: width, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <line
            key={y}
            x1={margin.left}
            y1={yScale(maxVal * y)}
            x2={margin.left + innerWidth}
            y2={yScale(maxVal * y)}
            stroke="#1e293b"
            strokeWidth={0.5}
          />
        ))}
        <path
          d={`M${bands.p10.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' L')} L${bands.p90.map((v, i) => `${xScale(steps - 1 - i)},${yScale(v)}`).join(' L')} Z`}
          fill="#3b82f622"
        />
        <path
          d={`M${bands.p25.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' L')} L${bands.p75.map((v, i) => `${xScale(steps - 1 - i)},${yScale(v)}`).join(' L')} Z`}
          fill="#3b82f644"
        />
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          points={bands.p50.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ')}
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + innerHeight}
          stroke="#334155"
          strokeWidth={1}
        />
        <line
          x1={margin.left}
          y1={margin.top + innerHeight}
          x2={margin.left + innerWidth}
          y2={margin.top + innerHeight}
          stroke="#334155"
          strokeWidth={1}
        />
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <text
            key={y}
            x={margin.left - 8}
            y={yScale(maxVal * y) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#94a3b8"
          >
            {fmt.usd(maxVal * y)}
          </text>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <text
            key={i}
            x={margin.left + (i * innerWidth) / 4}
            y={margin.top + innerHeight + 18}
            textAnchor="middle"
            fontSize={10}
            fill="#94a3b8"
          >
            Y{Math.round((frac * steps) / 12)}
          </text>
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 8,
          fontSize: 12,
          color: C.onSurfaceMuted,
          justifyContent: 'center',
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 8,
              background: '#3b82f622',
              border: '1px solid #3b82f6',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          P10–P90
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 8,
              background: '#3b82f644',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          P25–P75
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: C.primary,
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          Median
        </span>
      </div>
    </div>
  );
}
