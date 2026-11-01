import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tip, hoverable, useTooltip } from '../../components/Tooltip'
import { api } from '../../api'
import { categoryColor, fmt0 } from '../../format'
import { useAction } from '../../useAsync'
import { change, expensesLink, monthRange, shortMonth } from './shared'

const SPANS = [6, 12]
const SUB_LIMIT = 10

export default function Trends({ month, onSelectMonth }) {
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(() => new Set())
  const { busy, error, run } = useAction()
  const [span, setSpan] = useState(6)
  const [data, setData] = useState(null)
  const [showAllSubs, setShowAllSubs] = useState(false)
  const { ym } = monthRange(month)

  useEffect(() => {
    run(async () => setData(await api.analytics.trend(ym, span)))
  }, [run, ym, span])

  if (error) return <div className="error">{error}</div>
  if (!data) return busy ? <div className="panel muted">Loading trends…</div> : null

  const months = data.months
  const last = months.length - 1
  const cur = months[last]
  const prev = months[last - 1]
  const withSpend = months.filter((m) => m.total > 0)
  const avg = withSpend.length ? withSpend.reduce((s, m) => s + m.total, 0) / withSpend.length : 0
  const highest = months.reduce((h, m) => (m.total > (h?.total ?? -1) ? m : h), null)
  const curVsPrev = prev ? change(cur.total, prev.total, fmt0) : null
  const avgVsPrev = prev ? change(cur.average, prev.average, fmt0) : null
  const subs = showAllSubs ? data.subcategories : data.subcategories.slice(0, SUB_LIMIT)

  return (
    <>
      <section className="trend-facts">
        <div>
          <dt>{shortMonth(cur.month)} total</dt>
          <dd className="fig">{fmt0(cur.total)}</dd>
          {curVsPrev && <dd className={`delta ${curVsPrev.dir}`}>{curVsPrev.text} vs {shortMonth(prev.month)}</dd>}
        </div>
        <div>
          <dt>Monthly average</dt>
          <dd className="fig">{fmt0(avg)}</dd>
          <dd className="sub">over {withSpend.length} {withSpend.length === 1 ? 'month' : 'months'} with spending</dd>
        </div>
        <div>
          <dt>Highest month</dt>
          <dd className="fig">{highest && highest.total > 0 ? fmt0(highest.total) : '—'}</dd>
          {highest && highest.total > 0 && <dd className="sub">{shortMonth(highest.month)} {highest.month.slice(0, 4)}</dd>}
        </div>
        <div>
          <dt>Average expense</dt>
          <dd className="fig">{fmt0(cur.average)}</dd>
          {avgVsPrev && <dd className={`delta ${avgVsPrev.dir}`}>{avgVsPrev.text}, {cur.count} expenses</dd>}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Monthly spending by category</h3>
          <div className="seg" role="group" aria-label="Months shown">
            {SPANS.map((n) => (
              <button key={n} className={`seg-btn${span === n ? ' active' : ''}`} onClick={() => setSpan(n)}>
                {n} months
              </button>
            ))}
          </div>
        </div>
        <MonthlyBars data={data} hidden={hidden} onSelectMonth={onSelectMonth} />
        <div className="legend">
          {data.categories.map((c) => (
            <button
              key={c.categoryId}
              className={`legend-toggle${hidden.has(c.categoryId) ? ' off' : ''}`}
              aria-pressed={!hidden.has(c.categoryId)}
              onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(c.categoryId)) n.delete(c.categoryId); else n.add(c.categoryId); return n })}
              title={hidden.has(c.categoryId) ? 'Show this category' : 'Hide this category'}
            >
              <span className="dot" style={{ background: categoryColor(c.categoryName) }} />{c.categoryName}
            </button>
          ))}
          {months.some((m) => m.budget > 0) && <span><i className="k-budget" />Budget for that month</span>}
        </div>
      </section>

      <div className="ov-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Categories</h3>
            <span className="muted">{shortMonth(cur.month)} vs {prev ? shortMonth(prev.month) : '—'}</span>
          </div>
          <TrendTable
            rows={data.categories.map((c) => ({
              key: c.categoryId,
              name: c.categoryName,
              color: categoryColor(c.categoryName),
              monthly: months.map((m) => m.byCategory[c.categoryId] || 0),
              budget: cur.budgetByCategory?.[c.categoryId] ?? c.budget,
              link: expensesLink(monthRange(month), { categoryId: c.categoryId }),
            }))}
            onOpen={navigate}
          />
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Activity</h3></div>
          <MiniBars label="Expenses logged" values={months.map((m) => m.count)} months={months} format={(v) => String(v)} />
          <MiniBars label="Average expense" values={months.map((m) => m.average)} months={months} format={fmt0} />
        </section>

        <section className="panel span-2">
          <div className="panel-head">
            <h3>Subcategories</h3>
            <span className="muted">Sorted by {shortMonth(cur.month)} spending</span>
          </div>
          {data.subcategories.length ? (
            <>
              <TrendTable
                rows={subs.map((s) => ({
                  key: s.subcategoryId,
                  name: s.subcategoryName,
                  sub: s.categoryName,
                  color: categoryColor(s.categoryName),
                  monthly: s.monthly,
                  link: expensesLink(monthRange(month), { subCategoryId: s.subcategoryId }),
                }))}
                onOpen={navigate}
              />
              {data.subcategories.length > SUB_LIMIT && (
                <button className="secondary small" style={{ marginTop: 12 }} onClick={() => setShowAllSubs(!showAllSubs)}>
                  {showAllSubs ? 'Show top 10' : `Show all ${data.subcategories.length}`}
                </button>
              )}
            </>
          ) : (
            <p className="muted">No spending in these months.</p>
          )}
        </section>
      </div>
    </>
  )
}

function MonthlyBars({ data, hidden, onSelectMonth }) {
  const tooltip = useTooltip()
  const W = 760
  const H = 240
  const padT = 22
  const padB = 22
  const months = data.months
  const shown = data.categories.filter((c) => !hidden.has(c.categoryId))
  const totalOf = (m) => shown.reduce((s, c) => s + (m.byCategory[c.categoryId] || 0), 0)
  const budgetOf = (m) => shown.reduce((s, c) => s + (m.budgetByCategory?.[c.categoryId] || 0), 0)
  const max = Math.max(...months.map((m) => Math.max(totalOf(m), budgetOf(m))), 1) * 1.05
  const slot = W / months.length
  const bw = Math.min(56, slot * 0.6)
  const y = (v) => padT + (H - padT - padB) * (1 - v / max)
  const last = months.length - 1

  return (
    <svg className="monthly" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly spending stacked by category">
      {months.map((m, i) => {
        const cx = slot * i + slot / 2
        const total = totalOf(m)
        const budget = budgetOf(m)
        let acc = 0
        const [yy, mm] = m.month.split('-').map(Number)
        return (
          <g
            key={m.month}
            className={`month-col${i === last ? ' current' : ''}`}
            {...hoverable(
              tooltip,
              () => (
                <Tip
                  title={`${shortMonth(m.month)} ${yy}`}
                  rows={[
                    ...shown.filter((c) => m.byCategory[c.categoryId]).map((c) => ({ color: categoryColor(c.categoryName), label: c.categoryName, value: fmt0(m.byCategory[c.categoryId]) })),
                    { label: 'Total', value: fmt0(total), strong: true },
                    ...(budget > 0 ? [{ label: 'Budget', value: fmt0(budget) }] : []),
                    { label: 'Expenses', value: String(m.count) },
                  ]}
                  hint={i === last ? 'Selected cycle' : 'Click to open this cycle'}
                />
              ),
              i === last ? undefined : () => onSelectMonth({ y: yy, m: mm - 1 }),
            )}
          >
            <rect x={slot * i} y={0} width={slot} height={H - padB} className="hit" />
            {shown.map((c) => {
              const v = m.byCategory[c.categoryId]
              if (!v) return null
              const top = y(acc + v)
              const h = y(acc) - top
              acc += v
              return <rect key={c.categoryId} x={cx - bw / 2} y={top} width={bw} height={Math.max(h, 1)} fill={categoryColor(c.categoryName)} />
            })}
            {budget > 0 && <line x1={slot * i + 4} x2={slot * (i + 1) - 4} y1={y(budget)} y2={y(budget)} className="budget" />}
            {total > 0 && <text x={cx} y={y(Math.max(total, budget)) - 6} textAnchor="middle" className="val">{fmt0(total)}</text>}
            <text x={cx} y={H - 6} textAnchor="middle" className="tick">{shortMonth(m.month)}</text>
          </g>
        )
      })}
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} className="axis" />
    </svg>
  )
}

function Sparkline({ values, color }) {
  const W = 96
  const H = 26
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? W / (values.length - 1) : 0
  const pts = values.map((v, i) => [i * step, H - 3 - (v / max) * (H - 6)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg className="spark" viewBox={`-3 0 ${W + 6} ${H}`} width={W + 6} height={H} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.6" fill={color} />
    </svg>
  )
}

function TrendTable({ rows, onOpen }) {
  return (
    <div className="table-wrap">
      <table className="trend-table">
        <thead>
          <tr><th>Name</th><th>Trend</th><th className="num">Previous</th><th className="num">Selected</th><th className="num">Change</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const n = r.monthly.length
            const now = r.monthly[n - 1]
            const before = n > 1 ? r.monthly[n - 2] : 0
            const c = change(now, before, fmt0)
            return (
              <tr key={r.key} className={r.link ? 'clickable' : ''} onClick={r.link ? () => onOpen(r.link) : undefined} title={r.link ? 'Click to see these expenses' : undefined}>
                <td>
                  <div className="cat-cell">
                    <span className="dot" style={{ background: r.color }} />
                    <div>{r.name}{r.sub && <div className="muted" style={{ fontSize: '0.8rem' }}>{r.sub}</div>}</div>
                  </div>
                </td>
                <td><Sparkline values={r.monthly} color={r.color} /></td>
                <td className="num amount">{fmt0(before)}</td>
                <td className="num amount">
                  {fmt0(now)}
                  {r.budget > 0 && <div className="muted" style={{ fontSize: '0.75rem' }}>of {fmt0(r.budget)}</div>}
                </td>
                <td className={`num delta ${c.dir}`}>{c.dir === 'flat' ? '—' : c.text}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MiniBars({ label, values, months, format }) {
  const max = Math.max(...values, 1)
  const last = values.length - 1
  return (
    <div className="minibars">
      <div className="bd-top">
        <span>{label}</span>
        <span className="fig-sm">{format(values[last])}</span>
      </div>
      <div className="minibars-row">
        {values.map((v, i) => (
          <div key={months[i].month} className={`mb${i === last ? ' current' : ''}`} title={`${shortMonth(months[i].month)}: ${format(v)}`}>
            <span style={{ height: `${(v / max) * 100}%` }} />
            <small>{shortMonth(months[i].month).slice(0, 1)}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
