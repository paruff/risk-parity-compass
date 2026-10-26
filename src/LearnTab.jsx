import { useState } from 'react';
import {
  RUBRIC,
  WORKED_ITEM,
  endValue,
  feeDrag,
  feedback,
  gradeAnswer,
  itemFor,
  recordAttempt,
  dueModules,
} from './utils/learning';

const usd = n => `$${Math.round(n).toLocaleString('en-US')}`;
const MODULE = 'cost';

// Learning journey: self-located rubric and one retrieval-first module. Recommends, never gates.
export default function LearnTab({ S, learning, setLearning }) {
  const [item, setItem] = useState(() => itemFor(learning, MODULE));
  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState('3');
  const [result, setResult] = useState(null);
  const [intention, setIntention] = useState('');
  const [saved, setSaved] = useState(false);

  const isDue = dueModules(learning).includes(MODULE);
  const w = WORKED_ITEM;

  const submit = e => {
    e.preventDefault();
    const conf = Number(confidence);
    const { correct } = gradeAnswer(item, answer);
    setResult({ correct, ...feedback(item, answer, conf) });
    setLearning(l => recordAttempt(l, MODULE, { correct, confidence: conf }));
  };

  const saveIntention = () => {
    setLearning(l => ({
      ...l,
      modules: { ...l?.modules, [MODULE]: { ...l?.modules?.[MODULE], intention } },
    }));
    setSaved(true);
  };

  const again = () => {
    setItem(itemFor(learning, MODULE));
    setAnswer('');
    setResult(null);
    setIntention('');
    setSaved(false);
  };

  return (
    <div>
      {isDue && !result && (
        <div role="status" style={{ ...S.card, borderColor: '#92400e', background: '#1c1200' }}>
          <span style={{ color: '#fbbf24' }}>
            A quick refresher on fund costs is due. It’s optional.
          </span>
        </div>
      )}

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
              <span style={{ color: '#cbd5e1', fontSize: 15 }}>
                <strong>{r.name}.</strong> {r.can}
                <br />
                <span style={{ color: '#94a3b8' }}>Common slip: {r.error}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 0 }}>
          This is a map, not a test or a score. Every tab stays open whatever you pick.
        </p>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Fund costs: what a small fee does over time (3–5 min)</div>
        <h2 style={{ fontSize: 16, color: '#f1f5f9', margin: '0 0 6px' }}>Worked example</h2>
        <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.5, marginTop: 0 }}>
          {usd(w.balance)} grows {w.gross}% a year before fees for {w.years} years. At a {w.lowFee}%
          fee it becomes {usd(endValue(w, w.lowFee))}; at {w.highFee}% it becomes{' '}
          {usd(endValue(w, w.highFee))}. The gap is {usd(feeDrag(w))}.
        </p>

        <h2 style={{ fontSize: 16, color: '#f1f5f9', margin: '16px 0 6px' }}>Your turn</h2>
        <form onSubmit={submit}>
          <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.5, marginTop: 0 }}>
            {usd(item.balance)} grows {item.gross}% a year before fees for {item.years} years. How
            many dollars more do you end with at a {item.lowFee}% fee than at a {item.highFee}% fee?
            (Within 5% counts.)
          </p>
          <label style={S.label} htmlFor="learn-answer">
            Your estimate in dollars
          </label>
          <input
            id="learn-answer"
            type="number"
            min="0"
            inputMode="numeric"
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
            <p style={{ color: result.correct ? '#86efac' : '#fca5a5', fontWeight: 600 }}>
              {result.correct ? 'Correct.' : 'Not quite.'}
            </p>
            <p style={{ color: '#cbd5e1' }}>
              <strong>Where you’re going:</strong> {result.where}
            </p>
            <p style={{ color: '#cbd5e1' }}>
              <strong>How you’re doing:</strong> {result.how}
            </p>
            <p style={{ color: '#cbd5e1' }}>
              <strong>Next:</strong> {result.next}
            </p>

            <label style={S.label} htmlFor="learn-intention">
              Finish: “When I see a fund fee, I will…”
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
                style={{ ...S.btn, width: 'auto', padding: '12px 18px', background: '#1e293b' }}
                onClick={again}
              >
                Try another
              </button>
            </div>
            {saved && <p style={{ color: '#86efac' }}>Saved on this device.</p>}
          </div>
        )}

        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 0 }}>
          What this doesn’t show: it improves your grasp of how fees compound; it does not predict
          your returns or tell you which fund to buy. Progress stays on this device.
        </p>
      </div>
    </div>
  );
}
