import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { Tip, hoverable, useTooltip } from '../../components/Tooltip'
import { categoryColor, fmt, fmt0 } from '../../format'
import { useAction } from '../../useAsync'
import { expensesLink, monthRange } from './shared'

const PATTERN = {
  DAILY: { label: 'Daily', tone: 'bad' },
  FREQUENT: { label: 'Every few days', tone: 'warn' },
  WEEKLY: { label: 'Weekly', tone: 'muted' },
  OCCASIONAL: { label: 'Occasional', tone: 'ok' },
}

export default function Habits({ month }) {
  const navigate = useNavigate()
  const { busy, error, run } = useAction()
  const [habits, setHabits] = useState(null)
  const [summary, setSummary] = useState(null)
  const { from, to } = monthRange(month)

  useEffect(() => {
    run(async () => {
      const [h, s] = await Promise.all([api.analytics.habits(from, to), api.analytics.summary(from, to)])
      setHabits(h)
      setSummary(s)
    })
  }, [run, from, to])

  if (error) return <div className="error">{error}</div>
  if (!habits || !summary) return busy ? <div className="panel muted">Loading habits…</div> : null

  const st = habits.streaks
  const totalCount = habits.sizes.reduce((s, b) => s + b.count, 0)

  return (
    <>
      <section className="trend-facts">
        <div>
          <dt>No-spend days</dt>
          <dd className="fig">{st.noSpendDays}<span className="of"> of {st.daysCounted}</span></dd>
          <dd className="sub">longest run {st.longestNoSpendStreak} {st.longestNoSpendStreak === 1 ? 'day' : 'days'}</dd>
        </div>
        <div>
          <dt>Current no-spend streak</dt>
          <dd className="fig">{st.currentNoSpendStreak}<span className="of"> {st.currentNoSpendStreak === 1 ? 'day' : 'days'}</span></dd>
          <dd className="sub">{st.currentNoSpendStreak ? 'keep it going' : 'something was spent on the last day'}</dd>
        </div>
        <div>
          <dt>Days within daily budget</dt>
          <dd className="fig">{st.dailyBudget == null ? '—' : <>{st.daysUnderDailyBudget}<span className="of"> of {st.daysCounted}</span></>}</dd>
          <dd className="sub">{st.dailyBudget == null ? 'set budgets to track this' : `${fmt0(st.dailyBudget)} a day`}</dd>
        </div>
        <div>
          <dt>Longest run within budget</dt>
          <dd className="fig">{st.dailyBudget == null ? '—' : <>{st.longestUnderBudgetStreak}<span className="of"> days</span></>}</dd>
        </div>
      </section>

      <div className="ov-grid">
        <section className="panel span-2">
          <div className="panel-head">
            <h3>What the month was spent on</h3>
            <span className="muted">Each block is a subcategory, sized by spend</span>
          </div>
          <Treemap summary={summary} />
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Expense sizes</h3></div>
          {totalCount ? (
            <>
              <p className="insight small">
                Expenses under {fmt0(habits.smallSpendLimit)} add up to <strong>{fmt0(habits.smallSpendTotal)}</strong> across {habits.smallSpendCount} spends,{' '}
                {Math.round(habits.smallSpendShare * 100)}% of the month.
              </p>
              <SizeBars sizes={habits.sizes} />
            </>
          ) : <p className="muted">No expenses this month.</p>}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Things you buy again and again</h3>
            <span className="muted">Matched by description</span>
          </div>
          {habits.repeatItems.length ? (
            <div className="table-wrap"><table className="trend-table">
              <thead><tr><th>Item</th><th className="num">Times</th><th className="num hide-phone">Average</th><th className="num">Total</th></tr></thead>
              <tbody>
                {habits.repeatItems.map((r) => (
                  <tr key={r.name}>
                    <td>
                      <div className="cat-cell">
                        <span className="dot" style={{ background: categoryColor(r.categoryName) }} />
                        <div>{r.name}<div className="muted" style={{ fontSize: '0.75rem' }}>last {new Date(r.lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div>
                      </div>
                    </td>
                    <td className="num amount">×{r.count}</td>
                    <td className="num amount hide-phone">{fmt0(r.average)}</td>
                    <td className="num amount">{fmt0(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <p className="muted">No description appears more than once this month. Describing expenses the same way each time makes repeats show up here.</p>}
        </section>

        <section className="panel span-2">
          <div className="panel-head">
            <h3>Habit tracker</h3>
            <span className="muted">Subcategories bought 3+ times, by projected cost for the cycle</span>
          </div>
          {habits.habits?.length ? (
            <div className="habit-grid">
              {habits.habits.map((h) => (
                <button
                  key={h.subcategoryId}
                  className="habit linkish"
                  onClick={() => navigate(expensesLink(habits, { subCategoryId: h.subcategoryId }))}
                  title="See these expenses"
                >
                  <span className="habit-name">
                    <span className="dot" style={{ background: categoryColor(h.categoryName) }} />
                    {h.subcategoryName}
                    <span className={`chip ${PATTERN[h.pattern].tone}`}>{PATTERN[h.pattern].label}</span>
                  </span>
                  <span className="fig-sm">{fmt0(h.projectedPeriodCost)}</span>
                  <span className="habit-meta">
                    <span>{h.count}× so far</span>
                    <span>avg {fmt0(h.average)}</span>
                    {h.averageGapDays > 0 && <span>every {h.averageGapDays} days</span>}
                    {h.daysSinceLast != null && <span>{h.daysSinceLast === 0 ? 'last today' : `last ${h.daysSinceLast}d ago`}</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : <p className="muted">No subcategory has 3 or more expenses yet this cycle.</p>}
        </section>

        <section className="panel span-2">
          <div className="panel-head">
            <h3>Your year in spending</h3>
            <span className="muted">Each square is a day; shades are quarters of your spending days</span>
          </div>
          <YearHeatmap days={habits.year} />
        </section>
      </div>
    </>
  )
}

function SizeBars({ sizes }) {
  const maxTotal = Math.max(...sizes.map((s) => s.total), 1)
  return (
    <div className="sizes">
      {sizes.map((b) => (
        <div key={b.label} className="size-row">
          <span className="size-label">{b.label}</span>
          <div className="size-bar"><span style={{ width: `${(b.total / maxTotal) * 100}%` }} /></div>
          <span className="fig-sm">{fmt0(b.total)}</span>
          <span className="muted">{b.count}×</span>
        </div>
      ))}
    </div>
  )
}

// Squarified treemap (Bruls et al.): lays items into rows that keep blocks close to square.
function squarify(items, rect) {
  const out = []
  const total = items.reduce((s, i) => s + i.value, 0)
  if (!total) return out
  const scale = (rect.w * rect.h) / total
  const queue = items.map((i) => ({ ...i, area: i.value * scale }))
  let { x, y, w, h } = rect
  let row = []
  const worst = (r, side) => {
    const s = r.reduce((a, i) => a + i.area, 0)
    const max = Math.max(...r.map((i) => i.area))
    const min = Math.min(...r.map((i) => i.area))
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min))
  }
  const layout = (r) => {
    const s = r.reduce((a, i) => a + i.area, 0)
    if (w >= h) {
      const cw = s / h
      let cy = y
      r.forEach((i) => { const ih = i.area / cw; out.push({ ...i, x, y: cy, w: cw, h: ih }); cy += ih })
      x += cw
      w -= cw
    } else {
      const rh = s / w
      let cx = x
      r.forEach((i) => { const iw = i.area / rh; out.push({ ...i, x: cx, y, w: iw, h: rh }); cx += iw })
      y += rh
      h -= rh
    }
  }
  while (queue.length) {
    const item = queue[0]
    const side = Math.min(w, h)
    if (!row.length || worst([...row, item], side) <= worst(row, side)) {
      row.push(item)
      queue.shift()
    } else {
      layout(row)
      row = []
    }
  }
  if (row.length) layout(row)
  return out
}

function Treemap({ summary }) {
  const tooltip = useTooltip()
  const navigate = useNavigate()
  const items = summary.categories
    .flatMap((c) =>
      c.subcategories
        .filter((s) => s.spent > 0)
        .map((s) => ({ id: s.subcategoryId, label: s.subcategoryName, category: c.categoryName, value: s.spent, budget: s.budget })),
    )
    .sort((a, b) => b.value - a.value)
  if (!items.length) return <p className="muted">Nothing spent yet this month.</p>

  const W = 760
  const H = 300
  const total = items.reduce((s, i) => s + i.value, 0)
  const blocks = squarify(items, { x: 0, y: 0, w: W, h: H })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="treemap" role="img" aria-label="Spending by subcategory">
      {blocks.map((b) => {
        const share = Math.round((b.value / total) * 100)
        const roomy = b.w > 70 && b.h > 34
        return (
          <g
            key={b.id}
            className="tm-block"
            {...hoverable(
              tooltip,
              () => (
                <Tip
                  title={`${b.label} · ${b.category}`}
                  rows={[
                    { color: categoryColor(b.category), label: 'Spent', value: fmt(b.value) },
                    { label: 'Share of spending', value: `${share}%` },
                    ...(b.budget ? [{ label: 'Budget', value: fmt0(b.budget) }, { label: 'Budget used', value: `${Math.round((b.value / b.budget) * 100)}%`, strong: true }] : []),
                  ]}
                  hint="Click to see these expenses"
                />
              ),
              () => navigate(expensesLink(summary, { subCategoryId: b.id })),
            )}
          >
            <rect x={b.x + 1} y={b.y + 1} width={Math.max(0, b.w - 2)} height={Math.max(0, b.h - 2)} rx="3" fill={categoryColor(b.category)} className={b.budget && b.value > b.budget ? 'over' : ''} />
            {roomy && (
              <>
                <text x={b.x + 8} y={b.y + 18} className="tm-label">{b.label}</text>
                <text x={b.x + 8} y={b.y + 34} className="tm-value">{fmt0(b.value)} · {share}%</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function YearHeatmap({ days }) {
  const tooltip = useTooltip()
  const navigate = useNavigate()
  const max = Math.max(...days.map((d) => d.total), 1)
  const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
  const lead = (parse(days[0].date).getDay() + 6) % 7 // Monday-first
  const cells = [...Array(lead).fill(null), ...days]
  const weeks = Math.ceil(cells.length / 7)
  const S = 13
  const G = 3
  const top = 16
  const left = 28
  // Quartiles of the days with spending, so one large day (rent) doesn't wash out the rest
  const spendDays = days.map((d) => d.total).filter((v) => v > 0).sort((a, b) => a - b)
  const q = (p) => spendDays[Math.min(spendDays.length - 1, Math.floor(p * spendDays.length))] ?? max
  const cuts = [q(0.25), q(0.5), q(0.75)]
  const level = (v) => (v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4)
  const months = []
  cells.forEach((c, i) => {
    if (c && parse(c.date).getDate() === 1) months.push({ x: left + Math.floor(i / 7) * (S + G), label: parse(c.date).toLocaleString('en-IN', { month: 'short' }) })
  })
  const total = days.reduce((s, d) => s + d.total, 0)
  const active = days.filter((d) => d.total > 0).length

  return (
    <>
      <div className="year-wrap">
        <svg viewBox={`0 0 ${left + weeks * (S + G)} ${top + 7 * (S + G)}`} className="year" role="img" aria-label="Spending per day over the last year">
          {months.map((m) => <text key={m.x} x={m.x} y={10} className="ym">{m.label}</text>)}
          {['Mon', 'Wed', 'Fri'].map((d, i) => <text key={d} x={0} y={top + (i * 2) * (S + G) + 10} className="ym">{d}</text>)}
          {cells.map((c, i) =>
            c ? (
              <rect
                key={c.date}
                x={left + Math.floor(i / 7) * (S + G)}
                y={top + (i % 7) * (S + G)}
                width={S}
                height={S}
                rx="2"
                className={`yl l${level(c.total)}`}
                {...hoverable(
                  tooltip,
                  () => <Tip title={parse(c.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} rows={[{ label: 'Spent', value: fmt(c.total) }]} hint={c.total > 0 ? 'Click to see that day’s expenses' : 'Nothing spent'} />,
                  c.total > 0 ? () => navigate(expensesLink({ from: c.date, to: c.date })) : undefined,
                )}
              />
            ) : null,
          )}
        </svg>
      </div>
      <div className="year-foot">
        <span className="muted">{fmt0(total)} over the year, with spending on {active} of {days.length} days</span>
        <span className="year-key muted">Less {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`yl l${l}`} />)} More</span>
      </div>
    </>
  )
}
