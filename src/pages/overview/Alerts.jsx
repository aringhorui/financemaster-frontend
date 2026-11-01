import { useState } from 'react'
import { Link } from 'react-router-dom'

const LIMIT = 4

const LINKS = {
  CATEGORY: { to: '/categories', label: 'Review budget' },
  SUBCATEGORY: { to: '/categories', label: 'Review budget' },
  EXPENSE: { to: '/expenses', label: 'View expenses' },
  BANK_ACCOUNT: { to: '/overview?tab=cards', label: 'View card' },
}

const SEVERITY_LABEL = { CRITICAL: 'Critical', WARNING: 'Warning', INFO: 'Note' }

export default function Alerts({ insights }) {
  const [expanded, setExpanded] = useState(false)
  if (!insights.length) return null

  const shown = expanded ? insights : insights.slice(0, LIMIT)
  const counts = insights.reduce((c, i) => ({ ...c, [i.severity]: (c[i.severity] || 0) + 1 }), {})

  return (
    <section className="alerts" aria-label="Needs attention">
      <div className="alerts-head">
        <h3>Needs attention</h3>
        <span className="muted">
          {['CRITICAL', 'WARNING', 'INFO']
            .filter((s) => counts[s])
            .map((s) => `${counts[s]} ${SEVERITY_LABEL[s].toLowerCase()}${counts[s] > 1 ? 's' : ''}`)
            .join(', ')}
        </span>
      </div>
      <ul>
        {shown.map((i, idx) => {
          const link = LINKS[i.targetType]
          return (
            <li key={`${i.type}-${i.targetId ?? idx}`} className={`alert ${i.severity.toLowerCase()}`}>
              <span className="sev">{SEVERITY_LABEL[i.severity]}</span>
              <div className="alert-body">
                <strong>{i.title}</strong>
                <span>{i.message}</span>
              </div>
              {link && <Link to={link.to}>{link.label}</Link>}
            </li>
          )
        })}
      </ul>
      {insights.length > LIMIT && (
        <button className="secondary small" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show all ${insights.length}`}
        </button>
      )}
    </section>
  )
}
