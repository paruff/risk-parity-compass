import { useState, useEffect } from 'react';
import { C } from '../tokens';

export default function Confetti() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  const pieces = Array.from({ length: 20 }, (_, i) => ({
    left: `${(i * 137) % 100}%`,
    delay: `${(i % 8) * 0.08}s`,
    color: [C.primary, C.secondary, C.positive, '#f59e0b', '#f87171'][i % 5],
  }));
  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="sd-confetti"
          style={{
            position: 'absolute',
            top: '-12px',
            left: p.left,
            width: 8,
            height: 12,
            background: p.color,
            borderRadius: 2,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
