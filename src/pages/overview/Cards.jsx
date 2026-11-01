import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { fmt0 } from '../../format'
import { useAction } from '../../useAsync'
import { change } from './shared'

const LEVEL = {
  LOW: { label: 'Low use', tone: 'ok' },
  MODERATE: { label: 'Moderate use', tone: 'muted' },
  HIGH: { label: 'High use', tone: 'warn' },
  OVER_LIMIT: { label: 'Over limit', tone: 'bad' },
}

const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function Cards() {
  const { busy, error, run } = useAction()
  const [data, setData] = useState(null)

  useEffect(() => {
    run(async () => setData(await api.analytics.cards()))
  }, [run])

  if (error) return <div className="error">{error}</div>
  if (!data) return busy ? <div className="panel muted">Loading cards…</div> : null
  if (!data.cards.length) {
    return (
      <div className="panel empty">
        No credit cards yet. <Link to="/bank-accounts">Add a credit card</Link> with its billing day and limit to track each billing cycle.
      </div>
    )
  }

  const totalLimit = data.cards.reduce((s, c) => s + c.creditLimit, 0)
  const totalSpent = data.cards.reduce((s, c) => s + c.cycleSpent, 0)

  return (
    <>
      <section className="trend-facts">
        <div>
          <dt>Spent this cycle, all cards</dt>
          <dd className="fig">{fmt0(totalSpent)}</dd>
          <dd className="sub">of {fmt0(totalLimit)} combined limit</dd>
        </div>
        <div>
          <dt>Overall limit used</dt>
          <dd className="fig">{totalLimit ? Math.round((totalSpent / totalLimit) * 100) : 0}%</dd>
          <dd className="sub">Keeping it under 30% is generally better for your credit score</dd>
        </div>
      </section>

      <div className="cards-list">
        {data.cards.map((c) => {
          const pct = c.utilization * 100
          const lv = LEVEL[c.level]
          const vsPrev = change(c.cycleSpent, c.previousCycleSpent, fmt0)
          const cycleDays = Math.round((new Date(c.statementDate) - new Date(c.cycleStart)) / 86400000) + 1
          const elapsed = cycleDays - c.daysToStatement
          return (
            <section key={c.bankAccountId} className="panel card-row">
              <div className="card-id">
                <h3>{c.bankAccountName}</h3>
                <span className={`chip ${lv.tone}`}>{lv.label}</span>
              </div>

              <div className="card-gauge">
                <div className="gauge-top">
                  <span className="fig big">{fmt0(c.cycleSpent)}</span>
                  <span className="muted">of {fmt0(c.creditLimit)}</span>
                  <span className={`fig-sm ${c.level === 'OVER_LIMIT' ? 'neg' : ''}`}>{Math.round(pct)}%</span>
                </div>
                <div className={`gauge ${c.level.toLowerCase()}`} role="img" aria-label={`${Math.round(pct)}% of limit used`}>
                  <span style={{ width: `${Math.min(100, pct)}%` }} />
                  <i style={{ left: '30%' }} title="30%" />
                  <i style={{ left: '70%' }} title="70%" />
                </div>
                <div className="gauge-foot muted">
                  <span>{fmt0(Math.max(0, c.creditLimit - c.cycleSpent))} available</span>
                  <span>{c.cycleCount} {c.cycleCount === 1 ? 'expense' : 'expenses'}</span>
                </div>
              </div>

              <dl className="card-facts">
                <div>
                  <dt>Cycle</dt>
                  <dd>{day(c.cycleStart)} to {day(c.statementDate)}</dd>
                  <dd className="cycle-track"><span style={{ width: `${(elapsed / cycleDays) * 100}%` }} /></dd>
                </div>
                <div>
                  <dt>Statement</dt>
                  <dd>{c.daysToStatement === 0 ? 'Today' : `In ${c.daysToStatement} ${c.daysToStatement === 1 ? 'day' : 'days'}`}</dd>
                </div>
                <div>
                  <dt>Last cycle</dt>
                  <dd>{fmt0(c.previousCycleSpent)}</dd>
                  {c.previousCycleSpent > 0 && <dd className={`delta ${vsPrev.dir}`}>{vsPrev.text} so far</dd>}
                </div>
              </dl>
            </section>
          )
        })}
      </div>
    </>
  )
}
