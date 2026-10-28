import { C } from '../tokens';
export default function DrawdownBacktestChart({ samples, horizonYears }) {
  if (!samples || samples.length === 0)
    return (
      <div style={{ color: C.onSurfaceMuted, textAlign: 'center', padding: 20 }}>
        No historical data for backtest
      </div>
    );

  const width = 600;
  const height = 200;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const rates = samples.flatMap(s => [s.swr, s.pwr]);
  const maxRate = Math.max(...rates) * 1.1 || 0.1;

  const xScale = i => margin.left + (i / (samples.length - 1 || 1)) * innerWidth;
  const yScale = rate => margin.top + innerHeight - (rate / maxRate) * innerHeight;

  return (
    <div style={{ width: '100%', maxWidth: width, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <line
            key={y}
            x1={margin.left}
            y1={yScale(maxRate * y)}
            x2={margin.left + innerWidth}
            y2={yScale(maxRate * y)}
            stroke="#1e293b"
            strokeWidth={0.5}
          />
        ))}
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
            y={yScale(maxRate * y) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#94a3b8"
          >
            {(maxRate * y * 100).toFixed(1)}%
          </text>
        ))}
        {samples
          .filter((_, i) => i % Math.max(1, Math.floor(samples.length / 10)) === 0)
          .map((s, idx) => (
            <text
              key={s.startIndex}
              x={xScale(s.startIndex)}
              y={margin.top + innerHeight + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
              transform={`rotate(-45, ${xScale(s.startIndex)}, ${margin.top + innerHeight + 16})`}
            >
              Start {s.startIndex}
            </text>
          ))}
        <polyline
          fill="none"
          stroke="#16a34a"
          strokeWidth={1.5}
          points={samples.map((s, i) => `${xScale(i)},${yScale(s.swr)}`).join(' ')}
        />
        <polyline
          fill="none"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4,2"
          points={samples.map((s, i) => `${xScale(i)},${yScale(s.pwr)}`).join(' ')}
        />
        {samples
          .filter(s => s.depleted)
          .map(s => (
            <circle
              key={s.startIndex}
              cx={xScale(samples.indexOf(s))}
              cy={yScale(s.swr)}
              r={3}
              fill="#f87171"
            />
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
              height: 2,
              background: C.positive,
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          SWR
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: C.accent,
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          PWR
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: C.negativeText,
              borderRadius: '50%',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          Depleted
        </span>
      </div>
    </div>
  );
}
