const PARTS = {
  BUDGET: 'Budget',
  SAVINGS: 'Savings rate',
  STABILITY: 'Steady spending',
  TRACKING: 'Logging habit',
}

const GRADES = {
  STRONG: { label: 'Strong', color: 'var(--ok)' },
  STEADY: { label: 'Steady', color: 'var(--accent)' },
  NEEDS_WORK: { label: 'Needs work', color: 'var(--warn)' },
  AT_RISK: { label: 'At risk', color: 'var(--danger)' },
}

export default function HealthScore({ health }) {
  if (!health) return <section className="panel health" />
  const grade = GRADES[health.grade]
  const R = 52
  const C = 2 * Math.PI * R
  const pct = health.score ?? 0

  return (
    <section className="panel health">
      <div className="panel-head"><h3>Money health</h3></div>
      <div className="health-top">
        <svg viewBox="0 0 128 128" className="ring" role="img" aria-label={health.score == null ? 'No score yet' : `Score ${health.score} out of 100`}>
          <circle cx="64" cy="64" r={R} className="ring-track" />
          {health.score != null && (
            <circle
              cx="64" cy="64" r={R}
              className="ring-value"
              style={{ stroke: grade.color, strokeDasharray: `${(pct / 100) * C} ${C}` }}
              transform="rotate(-90 64 64)"
            />
          )}
          <text x="64" y="62" textAnchor="middle" className="ring-score">{health.score ?? '—'}</text>
          <text x="64" y="82" textAnchor="middle" className="ring-of">of 100</text>
        </svg>
        <div>
          <strong className="grade" style={{ color: grade?.color }}>{grade ? grade.label : 'Not enough data'}</strong>
          <p className="muted">Scored on the parts below that have data this month.</p>
        </div>
      </div>
      <ul className="health-parts">
        {health.components.map((c) => (
          <li key={c.type} className={c.points == null ? 'na' : ''}>
            <div className="hp-top">
              <span>{PARTS[c.type]}</span>
              <span className="fig-sm">{c.points == null ? '—' : `${Math.round(c.points)} / ${c.maxPoints}`}</span>
            </div>
            <div className="mini-meter"><span style={{ width: `${c.points == null ? 0 : (c.points / c.maxPoints) * 100}%` }} /></div>
            <small className="muted">{c.detail}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}
