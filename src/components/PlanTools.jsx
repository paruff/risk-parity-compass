import { useRef, useState } from 'react';

const FONT_SCALES = [1, 1.15, 1.3];
const btn = {
  padding: '10px 12px',
  background: '#1e293b',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  minHeight: 44,
};

// Export/import, backup reminder, and display preferences.
export default function PlanTools({ onExport, onImport, backupDue, prefs, setPrefs }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');

  const handleFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      onImport(await file.text());
      setMsg('Plan imported.');
    } catch (err) {
      setMsg(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="sd-noprint" style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Plan backup</div>
      {backupDue && (
        <div role="status" style={{ fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>
          Back up your plan: it is stored only in this browser.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={btn} onClick={onExport}>
          Export plan
        </button>
        <button type="button" style={btn} onClick={() => fileRef.current?.click()}>
          Import plan
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Import plan file"
          hidden
          onChange={handleFile}
        />
      </div>
      <div role="status" style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
        {msg}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', margin: '12px 0 6px' }}>Display</div>
      <label htmlFor="pref-font-scale" style={{ fontSize: 13, marginRight: 8 }}>
        Text size
      </label>
      <select
        id="pref-font-scale"
        className="sd-input"
        value={prefs.fontScale}
        onChange={e => setPrefs(p => ({ ...p, fontScale: Number(e.target.value) }))}
        style={{ ...btn, minHeight: 44 }}
      >
        {FONT_SCALES.map(s => (
          <option key={s} value={s}>
            {Math.round(s * 100)}%
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-pressed={prefs.highContrast}
        style={{ ...btn, marginTop: 8 }}
        onClick={() => setPrefs(p => ({ ...p, highContrast: !p.highContrast }))}
      >
        High contrast: {prefs.highContrast ? 'on' : 'off'}
      </button>
    </div>
  );
}
