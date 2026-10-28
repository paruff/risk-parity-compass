import { fmt } from '../utils/finance';
import { C } from '../tokens';

export default function WeightBar({ current, target, ticker }) {
  const maxW = Math.max(current, target, 0.001);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <span style={{ width: 48, fontFamily: 'monospace', color: C.onSurfaceMuted }}>{ticker}</span>
      <div style={{ flex: 1, position: 'relative', height: 20 }}>
        {/* Target bar (background) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            height: 12,
            width: `${(target / maxW) * 100}%`,
            background: '#1e40af22',
            borderRadius: 2,
            border: '1px dashed #3b82f6',
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        {/* Current bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            height: 12,
            width: `${(current / maxW) * 100}%`,
            background: current > target ? C.negative : C.positive,
            borderRadius: 2,
            opacity: 0.85,
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
      <span style={{ width: 52, color: C.onSurfaceSecondary, textAlign: 'right' }}>
        {fmt.pct(current)}
      </span>
      <span style={{ width: 52, color: C.accent, textAlign: 'right' }}>{fmt.pct(target)}</span>
    </div>
  );
}
