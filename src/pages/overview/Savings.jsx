import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tip, hoverable, useTooltip } from '../../components/Tooltip'
import { api } from '../../api'
import { categoryColor, fmt0 } from '../../format'
import { useAction } from '../../useAsync'
import { change, monthRange, shortMonth } from './shared'

const SPANS = [6, 12]
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

// The 50/30/20 rule: at most half on needs, at most 30% on wants, at least 20% kept.
const RULE = [
  { key: 'needs', label: 'Needs', target: 0.5, color: categoryColor('Needs'), cap: true },
  { key: 'wants', label: 'Wants', target: 0.3, color: categoryColor('Wants'), cap: true },
  { key: 'kept', label: 'Saved and invested', target: 0.2, color: categoryColor('Investment/Savings'), cap: false },
]

export default function Savings({ month, onSelectMonth }) {
  const { busy, error, run } = useAction()
  const [span, setSpan] = useState(6)
  const [data, setData] = useState(null)
  const { ym } = monthRange(month)

  useEffect(() => {
    run(async () => setData(await api.analytics.savings(ym, span)))
  }, [run, ym, span])

  if (error) return <div className="error">{error}</div>
  if (!data) return busy ? <div className="panel muted">Loading savings…</div> : null

  const months = data.months
  const cur = months[months.length - 1]
  const prev = months[months.length - 2]
  const other = cur.other

  if (!data.totalIncome) {
    return (
      <div className="panel empty">
        No income recorded for these months. <Link to="/income">Add your income</Link> to see how much you save and how your spending splits 50/30/20.
      </div>
    )
  }

  const rateDelta = prev && prev.savingsRate != null && cur.savingsRate != null ? cur.savingsRate - prev.savingsRate : null
  const shares = cur.income > 0 ? { needs: cur.needs / cur.income, wants: cur.wants / cur.income, kept: cur.savedAndInvested / cur.income } : null

  return (
    <>
      <section className="trend-facts">
        <div>
          <dt>{shortMonth(cur.month)} income</dt>
          <dd className="fig">{fmt0(cur.income)}</dd>
          {prev && <dd className={`delta ${change(cur.income, prev.income, fmt0).dir === 'up' ? 'down' : 'up'}`}>{change(cur.income, prev.income, fmt0).text} vs {shortMonth(prev.month)}</dd>}
        </div>
        <div>
          <dt>Spent</dt>
          <dd className="fig">{fmt0(cur.needs + cur.wants + cur.other)}</dd>
          <dd className="sub">plus {fmt0(cur.invested)} invested</dd>
        </div>
        <div>
          <dt>Saved and invested</dt>
          <dd className={`fig ${cur.savedAndInvested < 0 ? 'neg' : ''}`}>{fmt0(cur.savedAndInvested)}</dd>
          <dd className="sub">income minus spending</dd>
        </div>
        <div>
          <dt>Savings rate</dt>
          <dd className={`fig ${cur.savingsRate != null && cur.savingsRate < 0.2 ? 'neg' : ''}`}>{pct(cur.savingsRate)}</dd>
          {rateDelta != null && (
            <dd className={`delta ${rateDelta >= 0 ? 'down' : 'up'}`}>
              {rateDelta >= 0 ? '+' : '−'}{Math.abs(Math.round(rateDelta * 100))} points vs {shortMonth(prev.month)}
            </dd>
          )}
        </div>
      </section>

      <div className="ov-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>50/30/20 split for {shortMonth(cur.month)}</h3>
            <span className="muted">Share of income</span>
          </div>
          {shares ? (
            <>
              <div className="rule-bar" role="img" aria-label="Share of income on needs, wants and saving">
                {RULE.map((r) => (
                  <span key={r.key} style={{ flexGrow: Math.max(0, shares[r.key]), background: r.color }} />
                ))}
                {other > 0 && <span style={{ flexGrow: other / cur.income, background: 'var(--line-strong)' }} />}
                <i style={{ left: '50%' }} />
                <i style={{ left: '80%' }} />
              </div>
              <div className="rule-rows">
                {RULE.map((r) => {
                  const v = shares[r.key]
                  const ok = r.cap ? v <= r.target : v >= r.target
                  return (
                    <div key={r.key} className="rule-row">
                      <span className="dot" style={{ background: r.color }} />
                      <span>{r.label}</span>
                      <span className="fig-sm">{pct(v)}</span>
                      <span className="muted">target {r.cap ? 'up to' : 'at least'} {pct(r.target)}</span>
                      <span className={`chip ${ok ? 'ok' : 'warn'}`}>{ok ? 'Within' : r.cap ? 'Above' : 'Below'}</span>
                    </div>
                  )
                })}
                {other > 0 && (
                  <div className="rule-row">
                    <span className="dot" style={{ background: 'var(--line-strong)' }} />
                    <span>Other categories</span>
                    <span className="fig-sm">{pct(other / cur.income)}</span>
                    <span className="muted" style={{ gridColumn: 'span 2' }}>not counted as needs or wants</span>
                  </div>
                )}
              </div>
              <p className="hint">Needs, Wants and Investment/Savings map to the split by category name. Investment/Savings spending counts as saved.</p>
            </>
          ) : (
            <p className="muted">No income recorded for {shortMonth(cur.month)}. <Link to="/income">Add income</Link>.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h3>{span}-month totals</h3></div>
          <dl className="totals">
            <div><dt>Income</dt><dd className="fig-sm">{fmt0(data.totalIncome)}</dd></div>
            <div><dt>Spent, including investments</dt><dd className="fig-sm">{fmt0(data.totalSpent)}</dd></div>
            <div><dt>Saved and invested</dt><dd className="fig-sm">{fmt0(data.totalSavedAndInvested)}</dd></div>
            <div><dt>Savings rate</dt><dd className="fig-sm">{pct(data.savingsRate)}</dd></div>
          </dl>
        </section>

        <section className="panel span-2">
          <div className="panel-head">
            <h3>Income against spending</h3>
            <div className="seg" role="group" aria-label="Months shown">
              {SPANS.map((n) => (
                <button key={n} className={`seg-btn${span === n ? ' active' : ''}`} onClick={() => setSpan(n)}>{n} months</button>
              ))}
            </div>
          </div>
          <IncomeChart months={months} onSelectMonth={onSelectMonth} />
          <div className="legend">
            <span><span className="dot" style={{ background: 'var(--ok)' }} />Income</span>
            <span><span className="dot" style={{ background: 'var(--chart-ink)' }} />Spent (excluding investments)</span>
            <span><span className="dot" style={{ background: categoryColor('Investment/Savings') }} />Invested</span>
            <span><i className="k-rate" />Savings rate</span>
          </div>
        </section>

        <section className="panel span-2">
          <div className="panel-head">
            <h3>Budget against actual</h3>
            <span className="muted">Each month uses the budget it had at the time</span>
          </div>
          <div className="table-wrap">
            <table className="trend-table">
              <thead>
                <tr>
                  <th>Month</th><th className="num">Income</th><th className="num">Budget</th><th className="num">Spent</th>
                  <th className="num">vs budget</th><th className="num">Saved and invested</th><th className="num">Rate</th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => {
                  const diff = m.spent - m.budget
                  return (
                    <tr key={m.month}>
                      <td>{shortMonth(m.month)} {m.month.slice(0, 4)}</td>
                      <td className="num amount">{m.income ? fmt0(m.income) : '—'}</td>
                      <td className="num amount">{m.budget ? fmt0(m.budget) : '—'}</td>
                      <td className="num amount">{fmt0(m.spent)}</td>
                      <td className={`num delta ${m.budget ? (diff > 0 ? 'up' : 'down') : 'flat'}`}>
                        {m.budget ? `${diff > 0 ? '+' : '−'}${fmt0(Math.abs(diff))}` : '—'}
                      </td>
                      <td className={`num amount ${m.savedAndInvested < 0 ? 'neg' : ''}`}>{m.income ? fmt0(m.savedAndInvested) : '—'}</td>
                      <td className="num amount">{pct(m.savingsRate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}

function IncomeChart({ months, onSelectMonth }) {
  const tooltip = useTooltip()
  const W = 760
  const H = 240
  const padT = 16
  const padB = 22
  const max = Math.max(...months.map((m) => Math.max(m.income, m.spent)), 1) * 1.08
  const slot = W / months.length
  const bw = Math.min(26, slot * 0.28)
  const y = (v) => padT + (H - padT - padB) * (1 - v / max)
  const rateY = (r) => padT + (H - padT - padB) * (1 - Math.max(0, Math.min(1, r)))
  const ratePts = months.map((m, i) => (m.savingsRate == null ? null : [slot * i + slot / 2, rateY(m.savingsRate)]))

  return (
    <svg className="monthly savings-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income, spending and savings rate per month">
      {months.map((m, i) => {
        const cx = slot * i + slot / 2
        const consumption = m.needs + m.wants + m.other
        return (
          <g
            key={m.month}
            className="month-col"
            {...hoverable(
              tooltip,
              () => (
                <Tip
                  title={`${shortMonth(m.month)} ${m.month.slice(0, 4)}`}
                  rows={[
                    { color: 'var(--ok)', label: 'Income', value: fmt0(m.income) },
                    { color: 'var(--chart-ink)', label: 'Spent', value: fmt0(consumption) },
                    { color: categoryColor('Investment/Savings'), label: 'Invested', value: fmt0(m.invested) },
                    { label: 'Kept', value: fmt0(m.savedAndInvested), strong: true },
                    { label: 'Savings rate', value: pct(m.savingsRate) },
                  ]}
                  hint={i === months.length - 1 ? 'Selected cycle' : 'Click to open this cycle'}
                />
              ),
              i === months.length - 1 ? undefined : () => { const [yy, mm] = m.month.split('-').map(Number); onSelectMonth({ y: yy, m: mm - 1 }) },
            )}
          >
            <rect x={slot * i} y={0} width={slot} height={H - padB} className="hit" />
            <rect x={cx - bw - 2} y={y(m.income)} width={bw} height={Math.max(0, y(0) - y(m.income))} fill="var(--ok)" />
            <rect x={cx + 2} y={y(consumption)} width={bw} height={Math.max(0, y(0) - y(consumption))} fill="var(--chart-ink)" />
            <rect x={cx + 2} y={y(consumption + m.invested)} width={bw} height={Math.max(0, y(consumption) - y(consumption + m.invested))} fill={categoryColor('Investment/Savings')} />
            <text x={cx} y={H - 6} textAnchor="middle" className="tick">{shortMonth(m.month)}</text>
          </g>
        )
      })}
      <path
        d={ratePts.reduce((d, p, i) => (p ? `${d}${d && ratePts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}` : d), '')}
        className="rate-line"
      />
      {ratePts.map((p, i) =>
        p ? (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="3.5" className="rate-dot" />
            <text x={p[0]} y={p[1] - 8} textAnchor="middle" className="val">{pct(months[i].savingsRate)}</text>
          </g>
        ) : null,
      )}
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} className="axis" />
    </svg>
  )
}
