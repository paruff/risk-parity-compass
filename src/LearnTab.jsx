import { useState } from 'react';
import { C } from './tokens';
import {
  RUBRIC,
  MODULES,
  MODULE_IDS,
  feedback,
  gradeAnswer,
  itemFor,
  recordAttempt,
  dueModules,
} from './utils/learning';

// Start with a due refresher, else the first module not yet tried.
const firstModule = learning =>
  dueModules(learning)[0] ?? MODULE_IDS.find(id => !learning?.modules?.[id]) ?? MODULE_IDS[0];

// Learning journey: self-located rubric and short retrieval-first modules. Recommends, never gates.
export default function LearnTab({ S, learning, setLearning }) {
  const [active, setActive] = useState(() => firstModule(learning));
  const due = dueModules(learning);

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Where are you now? (optional)</div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ ...S.label }}>Pick what you can already do</legend>
          {RUBRIC.map(r => (
            <label
              key={r.id}
              style={{ display: 'flex', gap: 10, padding: '10px 0', minHeight: 44 }}
            >
              <input
                type="radio"
                name="rubric"
                checked={learning?.rubricChoice === r.id}
                onChange={() => setLearning(l => ({ ...l, rubricChoice: r.id }))}
              />
              <span style={{ color: C.onSurfaceSecondary, fontSize: 15 }}>
                <strong>{r.name}.</strong> {r.can}
                <br />
                <span style={{ color: C.onSurfaceMuted }}>Common slip: {r.error}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p style={{ color: C.onSurfaceMuted, fontSize: 14, marginBottom: 0 }}>
          This is a map, not a test or a score. Every tab stays open whatever you pick, and the
          modules below can be done in any order.
        </p>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Short modules (3–5 min each)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MODULE_IDS.map(id => (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              onClick={() => setActive(id)}
              style={{
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 15,
                cursor: 'pointer',
                color: C.onSurface,
                background: active === id ? C.primaryDeep : C.border,
                border: `1px solid ${C.borderStrong}`,
              }}
            >
              {MODULES[id].title}
              {learning?.modules?.[id] ? ' ✓' : ''}
              {due.includes(id) ? ' (refresher due)' : ''}
            </button>
          ))}
        </div>
      </div>

      <ModuleCard key={active} id={active} S={S} learning={learning} setLearning={setLearning} />
    </div>
  );
}

function ModuleCard({ id, S, learning, setLearning }) {
  const m = MODULES[id];
  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState('3');
  const [result, setResult] = useState(null);
  const [intention, setIntention] = useState('');
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState(() => itemFor(learning, id));

  const isDue = dueModules(learning).includes(id);

  const submit = e => {
    e.preventDefault();
    const conf = Number(confidence);
    const { correct } = gradeAnswer(current, answer);
    setResult({ correct, ...feedback(current, answer, conf) });
    setLearning(l => recordAttempt(l, id, { correct, confidence: conf }));
  };

  const saveIntention = () => {
    setLearning(l => ({
      ...l,
      modules: { ...l?.modules, [id]: { ...l?.modules?.[id], intention } },
    }));
    setSaved(true);
  };

  // The attempt was recorded on submit, so itemFor now returns the next variant.
  const again = () => {
    setCurrent(itemFor(learning, id));
    setAnswer('');
    setResult(null);
    setIntention('');
    setSaved(false);
  };

  return (
    <div style={S.card}>
      {isDue && !result && (
        <div
          role="status"
          style={{ ...S.card, borderColor: C.warningBorder, background: C.warningSurface }}
        >
          <span style={{ color: C.warning }}>
            A quick refresher on this topic is due. It’s optional.
          </span>
        </div>
      )}
      <div style={S.cardTitle}>{m.title}</div>
      <h2 style={{ fontSize: 16, color: C.onSurfaceStrong, margin: '0 0 6px' }}>Worked example</h2>
      <p style={{ color: C.onSurfaceSecondary, fontSize: 15, lineHeight: 1.5, marginTop: 0 }}>
        {m.worked()}
      </p>

      <h2 style={{ fontSize: 16, color: C.onSurfaceStrong, margin: '16px 0 6px' }}>Your turn</h2>
      <form onSubmit={submit}>
        <p style={{ color: C.onSurfaceSecondary, fontSize: 15, lineHeight: 1.5, marginTop: 0 }}>
          {m.question(current)} (Within 5% counts.)
        </p>
        <label style={S.label} htmlFor="learn-answer">
          Your estimate in {m.unit}
        </label>
        <input
          id="learn-answer"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          style={S.input}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={!!result}
          required
        />
        <label style={{ ...S.label, marginTop: 12 }} htmlFor="learn-confidence">
          How confident are you?
        </label>
        <select
          id="learn-confidence"
          style={S.input}
          value={confidence}
          onChange={e => setConfidence(e.target.value)}
          disabled={!!result}
        >
          <option value="1">1 – guessing</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5 – certain</option>
        </select>
        {!result && (
          <button type="submit" style={{ ...S.btn, marginTop: 14 }}>
            Check my answer
          </button>
        )}
      </form>

      {result && (
        <div role="status" style={{ marginTop: 16 }}>
          <p style={{ color: result.correct ? C.onPositive : C.onNegative, fontWeight: 600 }}>
            {result.correct ? 'Correct.' : 'Not quite.'}
          </p>
          <p style={{ color: C.onSurfaceSecondary }}>
            <strong>Where you’re going:</strong> {result.where}
          </p>
          <p style={{ color: C.onSurfaceSecondary }}>
            <strong>How you’re doing:</strong> {result.how}
          </p>
          <p style={{ color: C.onSurfaceSecondary }}>
            <strong>Next:</strong> {result.next}
          </p>

          <label style={S.label} htmlFor="learn-intention">
            Finish: “{m.intention}”
          </label>
          <input
            id="learn-intention"
            style={S.input}
            value={intention}
            onChange={e => setIntention(e.target.value)}
            maxLength={200}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              style={{ ...S.btn, width: 'auto', padding: '12px 18px' }}
              onClick={saveIntention}
              disabled={!intention.trim()}
            >
              Save sentence
            </button>
            <button
              type="button"
              style={{ ...S.btn, width: 'auto', padding: '12px 18px', background: C.border }}
              onClick={again}
            >
              Try another
            </button>
          </div>
          {saved && <p style={{ color: C.onPositive }}>Saved on this device.</p>}
        </div>
      )}

      <p style={{ color: C.onSurfaceMuted, fontSize: 14, marginBottom: 0 }}>
        What this doesn’t show: {m.limits} Progress stays on this device.
      </p>
    </div>
  );
}
