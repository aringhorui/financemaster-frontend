import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { categoryColor, fmt, fmt0 } from '../../format'
import { useAction } from '../../useAsync'

import { Tip, hoverable, useTooltip } from '../../components/Tooltip'
import { ArrowUpRight, BarChart3, Gauge, Receipt, Sparkles, Tag, Target, TrendingDown, Wallet } from 'lucide-react'
import { KPICard } from '../../components/KPI'
import Alerts from './Alerts'
import HealthScore from './HealthScore'
import MoneyFlow from './MoneyFlow'
import { STATUS, cycleName, cycleOf, dayIndex, expensesLink, monthRange, parseIso, sameCycle } from './shared'


export default function ThisMonth({ month, onOpenWrapped }) {
  const { busy, error, run } = useAction()
  const [summary, setSummary] = useState(null)
  const [recent, setRecent] = useState([])
  const [insights, setInsights] = useState([])
  const [health, setHealth] = useState(null)
  const [income, setIncome] = useState(0)


  useEffect(() => {
    run(async () => {
      const { from, to, ym } = monthRange(month)
      const [s, latest, ins, h, sv] = await Promise.all([
        api.analytics.summary(from, to),
        api.expenses.list({ startDate: `${from}T00:00:00`, endDate: `${to}T23:59:59`, page: 0, pageSize: 6 }),
        api.analytics.insights(from, to),
        api.analytics.health(ym),
        api.analytics.savings(ym, 1),
      ])
      setSummary(s)
      setRecent(latest.expenses || [])
      setInsights(ins.insights || [])
      setHealth(h)
      setIncome(sv.months?.[0]?.income || 0)
    })
  }, [run, month])

  const isCurrent = sameCycle(month, cycleOf())
  const todayIndex = isCurrent ? dayIndex(monthRange(month).from) : -1

  const s = summary
  const colorOf = Object.fromEntries((s?.categories || []).map((c) => [c.categoryId, categoryColor(c.categoryName)]))
  const projectedGap = s ? s.projectedTotal - s.totalBudget : 0
  const daysLeft = s ? s.daysInPeriod - s.daysElapsed : 0
  const vsPrev = s ? s.totalSpent - s.previousSpentToDate : 0
  const prevLabel = s ? cycleName(s.previousFrom) : ''
  const moneyLeft = s ? (income > 0 ? income : s.totalBudget) - s.totalSpent : 0
  const topCategory = s?.categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)[0]

  return (
    <>

      {error && <div className="error">{error}</div>}
      {!s && busy && <div className="panel muted">Loading this month…</div>}

      {s && (
        <>
          {isCurrent && s.daysElapsed <= 7 && s.previousTotal > 0 && (
            <div className="wrap-banner">
              <Sparkles size={26} />
              <div>
                <strong>Your {prevLabel} cycle is wrapped</strong>
                <span>Where it went, your signature buy, your spending personality and more.</span>
              </div>
              <button onClick={() => onOpenWrapped(month.m === 0 ? { y: month.y - 1, m: 11 } : { y: month.y, m: month.m - 1 })}>See it</button>
            </div>
          )}

          <section className="kpi-grid" aria-label="Key figures">
            <KPICard
              label="Total spent"
              value={s.totalSpent}
              format={fmt0}
              icon={TrendingDown}
              color="#f97316"
              context={s.daysElapsed > 0 && s.previousSpentToDate > 0
                ? `${vsPrev > 0 ? '+' : '−'}${fmt0(Math.abs(vsPrev))} vs ${prevLabel} by day ${s.daysElapsed}`
                : 'This salary cycle'}
              contextTone={s.daysElapsed > 0 && s.previousSpentToDate > 0 ? (vsPrev > 0 ? 'up' : 'down') : ''}
            />
            <KPICard
              label="Money left"
              value={Math.abs(moneyLeft)}
              format={fmt0}
              icon={Wallet}
              color={moneyLeft >= 0 ? '#22c55e' : '#ef4444'}
              context={moneyLeft < 0 ? `Over ${income > 0 ? 'income' : 'budget'}` : income > 0 ? `of ${fmt0(income)} income` : s.totalBudget > 0 ? `of ${fmt0(s.totalBudget)} budget` : 'Add income or budgets'}
              contextTone={moneyLeft < 0 ? 'up' : ''}
            />
            <KPICard label="Daily average" value={s.daysElapsed ? s.totalSpent / s.daysElapsed : 0} format={fmt0} icon={BarChart3} color="#fb923c" context="Per day so far" />
            <KPICard
              label="Daily budget left"
              value={daysLeft > 0 ? Math.max(0, moneyLeft) / daysLeft : 0}
              format={fmt0}
              icon={Target}
              color={moneyLeft >= 0 ? '#22c55e' : '#ef4444'}
              context={daysLeft > 0 ? (moneyLeft >= 0 ? `Per day for ${daysLeft} days left` : 'Already over') : 'Cycle finished'}
            />
            <KPICard
              label={daysLeft > 0 ? 'Projected cycle end' : 'Cycle total'}
              value={s.projectedTotal}
              format={fmt0}
              icon={Gauge}
              color={projectedGap > 0 && s.totalBudget > 0 ? '#ef4444' : '#ea580c'}
              context={s.totalBudget > 0 ? (projectedGap > 0 ? `${fmt0(projectedGap)} over budget` : `${fmt0(-projectedGap)} under budget`) : 'No budget set'}
              contextTone={s.totalBudget > 0 ? (projectedGap > 0 ? 'up' : 'down') : ''}
            />
            <KPICard
              label="Transactions"
              value={s.transactionCount}
              format={(v) => Math.round(v).toLocaleString('en-IN')}
              icon={Receipt}
              color="#fdba74"
              context={s.transactionCount ? `Avg ${fmt0(s.totalSpent / s.transactionCount)} each` : 'None yet'}
            />
            <KPICard
              label="Biggest expense"
              value={s.largestExpense ? s.largestExpense.amount : '—'}
              format={fmt0}
              icon={ArrowUpRight}
              color="#ef4444"
              context={s.largestExpense ? s.largestExpense.name : 'No expenses yet'}
              title={s.largestExpense ? `${s.largestExpense.name} on ${s.largestExpense.date}` : undefined}
            />
            <KPICard
              label="Top category"
              value={topCategory ? topCategory.categoryName : '—'}
              icon={Tag}
              color={topCategory ? categoryColor(topCategory.categoryName) : '#d97706'}
              context={topCategory ? `${fmt0(topCategory.spent)} · ${Math.round((topCategory.spent / s.totalSpent) * 100)}% of spending` : ''}
            />
          </section>

          <Alerts insights={insights} />

          <EnvelopeStrip summary={s} />

          <div className="flow-grid">
            <HealthScore health={health} />
            <MoneyFlow summary={s} income={income} />
          </div>

          <div className="ov-grid">
            <section className="panel">
              <div className="panel-head">
                <h3>Spending through the month</h3>
                <ChartKey />
              </div>
              <CumulativeChart summary={s} />
            </section>

            <section className="panel">
              <div className="panel-head"><h3>By payment method</h3></div>
              <Breakdown rows={s.paymentMethods} total={s.totalSpent} />
              {s.recurring.length > 0 && (
                <>
                  <div className="panel-head" style={{ marginTop: 20 }}><h3>Recurring</h3></div>
                  {s.recurring.map((r) => (
                    <div key={r.subcategoryId} className="recurring">
                      <span>{r.subcategoryName}</span>
                      <span className={`chip ${r.paidThisPeriod ? 'ok' : 'warn'}`}>{r.paidThisPeriod ? 'Paid' : 'Due'}</span>
                      <span className="fig-sm">{fmt0(r.typicalAmount)}</span>
                    </div>
                  ))}
                  <p className="hint">Found from a single similar payment in each of the last two months.</p>
                </>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>Daily spending</h3>
                <span className="muted">
                  Avg {fmt0(s.daysElapsed ? s.totalSpent / s.daysElapsed : 0)} per day, {s.transactionCount} expenses
                </span>
              </div>
              <DailyChart summary={s} colorOf={colorOf} todayIndex={todayIndex} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>Latest expenses</h3>
                <Link to="/expenses">View all</Link>
              </div>
              {recent.map((e) => (
                <div key={e.transactionId} className="recent">
                  <span className="dot" style={{ background: categoryColor(e.categoryName) }} />
                  <div className="recent-main">
                    <div>{e.notes || e.subCategoryName}</div>
                    <div className="muted">
                      {new Date(e.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {e.paymentMethodName}
                    </div>
                  </div>
                  <span className="fig-sm">{fmt(e.amount)}</span>
                </div>
              ))}
              {!recent.length && <p className="muted">No expenses this month. <Link to="/expenses">Add one</Link>.</p>}
            </section>

            <section className="panel span-2">
              <div className="panel-head">
                <h3>Where it went</h3>
                <Link to="/categories">Edit budgets</Link>
              </div>
              <WhereItWent summary={s} prevLabel={prevLabel} />
            </section>
          </div>
        </>
      )}
    </>
  )
}

function EnvelopeStrip({ summary }) {
  const tooltip = useTooltip()
  const navigate = useNavigate()
  const cats = summary.categories.filter((c) => c.budget > 0)
  if (!cats.length) return null
  const pacePct = (summary.daysElapsed / summary.daysInPeriod) * 100
  const showPace = summary.daysElapsed > 0 && summary.daysElapsed < summary.daysInPeriod
  const open = (c) => navigate(expensesLink(summary, { categoryId: c.categoryId }))

  return (
    <section className="envelope" aria-label="Budget used per category">
      <div className="envelope-bar">
        {cats.map((c) => {
          const pct = (c.spent / c.budget) * 100
          const st = STATUS[c.paceStatus] || STATUS.ON_TRACK
          return (
            <div
              key={c.categoryId}
              className={`env-seg${pct > 100 ? ' over' : ''}`}
              style={{ flexGrow: c.budget, '--c': categoryColor(c.categoryName) }}
              aria-label={`${c.categoryName}: ${Math.round(pct)}% of budget used`}
              {...hoverable(
                tooltip,
                () => (
                  <Tip
                    title={`${c.categoryName} · ${st.label}`}
                    rows={[
                      { color: categoryColor(c.categoryName), label: 'Spent', value: fmt0(c.spent) },
                      { label: 'Budget', value: fmt0(c.budget) },
                      ...(showPace ? [{ label: 'Even pace by today', value: fmt0(c.expectedByNow) }] : []),
                      ...(showPace ? [{ label: 'Projected', value: fmt0(c.projected) }] : []),
                      { label: c.budget >= c.spent ? 'Left' : 'Over', value: fmt0(Math.abs(c.budget - c.spent)), strong: true },
                    ]}
                    hint="Click to see these expenses"
                  />
                ),
                () => open(c),
              )}
            >
              <div className="env-fill" style={{ width: `${Math.min(100, pct)}%` }} />
              {showPace && <div className="env-pace" style={{ left: `${pacePct}%` }} />}
            </div>
          )
        })}
      </div>
      <div className="envelope-legend">
        {cats.map((c) => {
          const left = c.budget - c.spent
          const st = STATUS[c.paceStatus] || STATUS.ON_TRACK
          return (
            <div key={c.categoryId} style={{ flexGrow: c.budget }}>
              <button className="env-name linkish" onClick={() => open(c)}>
                <span className="dot" style={{ background: categoryColor(c.categoryName) }} />
                {c.categoryName}
                <span className="fig-sm">{Math.round((c.spent / c.budget) * 100)}%</span>
              </button>
              <div>{left >= 0 ? `${fmt0(left)} left` : <span className="neg">{fmt0(-left)} over</span>}</div>
              <span className={`chip ${st.tone}`}>{st.label}</span>
            </div>
          )
        })}
      </div>
      {showPace && <p className="hint">The thin line in each bar marks an even daily pace for today. <span className="pointer-hint">Hover a bar for details, click to see its expenses.</span><span className="touch-hint">Tap a bar to see its expenses.</span></p>}
    </section>
  )
}

function ChartKey() {
  return (
    <span className="chart-key">
      <span><i className="k-actual" />This cycle</span>
      <span><i className="k-proj" />Projected</span>
      <span><i className="k-prev" />Last cycle</span>
      <span><i className="k-budget" />Budget</span>
    </span>
  )
}

const dayLabel = (iso) => parseIso(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const dayNum = (iso) => Number(iso.slice(8, 10))

function CumulativeChart({ summary }) {
  const tooltip = useTooltip()
  const navigate = useNavigate()
  const [hover, setHover] = useState(null)
  const W = 640
  const H = 220
  const padL = 4
  const padB = 20
  const n = summary.daysInPeriod

  const actual = []
  let acc = 0
  summary.daily.forEach((d, i) => {
    acc += d.total
    if (i < summary.daysElapsed) actual.push(acc)
  })
  const prev = []
  let pacc = 0
  summary.previousDailyTotals.forEach((v) => prev.push((pacc += v)))

  const max = Math.max(summary.totalBudget, summary.projectedTotal, ...prev, acc, 1) * 1.08
  const x = (i) => padL + ((W - padL * 2) * (i + 0.5)) / n
  const y = (v) => (H - padB) * (1 - v / max)
  const line = (pts) => pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  const last = actual.length - 1
  const showProjection = last >= 0 && summary.daysElapsed < n
  const projectedAt = (i) => (i <= last ? actual[i] : actual[last] + ((summary.projectedTotal - actual[last]) * (i - last)) / (n - 1 - last))

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * W
    return Math.max(0, Math.min(n - 1, Math.round(((vx - padL) * n) / (W - padL * 2) - 0.5)))
  }
  const onMove = (e) => {
    const i = pick(e)
    setHover(i)
    const day = summary.daily[i]
    const rows = []
    if (i <= last) rows.push({ color: 'var(--accent)', label: 'This cycle so far', value: fmt0(actual[i]), strong: false })
    else if (showProjection) rows.push({ color: 'var(--accent)', label: 'Projected by then', value: fmt0(projectedAt(i)) })
    if (prev[i] != null) rows.push({ color: 'var(--line-strong)', label: 'Last cycle by then', value: fmt0(prev[i]) })
    if (summary.totalBudget > 0) rows.push({ color: 'var(--danger)', label: 'Even pace of budget', value: fmt0((summary.totalBudget * (i + 1)) / n) })
    if (day.total > 0) rows.push({ label: 'Spent that day', value: fmt0(day.total), strong: true })
    tooltip.show(e, <Tip title={`Day ${i + 1} · ${dayLabel(day.date)}`} rows={rows} hint={i <= last ? 'Click to see that day’s expenses' : undefined} />)
  }

  return (
    <svg
      className="cumulative interactive"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Cumulative spending this cycle against budget, last cycle and projection"
      onMouseMove={onMove}
      onMouseLeave={() => { setHover(null); tooltip.hide() }}
      onClick={(e) => {
        const i = pick(e)
        if (i <= last) { tooltip.hide(); navigate(expensesLink(summary, { from: summary.daily[i].date, to: summary.daily[i].date })) }
      }}
    >
      {summary.totalBudget > 0 && (
        <>
          <line x1={0} x2={W} y1={y(summary.totalBudget)} y2={y(summary.totalBudget)} className="budget" />
          <text x={8} y={y(summary.totalBudget) - 6} className="lbl">Budget {fmt0(summary.totalBudget)}</text>
        </>
      )}
      <path d={line(prev)} className="prev" />
      {actual.length > 0 && (
        <path d={`${line(actual)} L${x(last).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z`} className="area" />
      )}
      <path d={line(actual)} className="actual" />
      {showProjection && (
        <>
          <path d={`M${x(last)} ${y(actual[last])} L${x(n - 1)} ${y(summary.projectedTotal)}`} className="proj" />
          <circle cx={x(n - 1)} cy={y(summary.projectedTotal)} r={4} className="proj-dot" />
          <text x={x(n - 1) - 8} y={y(summary.projectedTotal) + (summary.projectedTotal > summary.totalBudget ? -10 : 16)} textAnchor="end" className="lbl strong">
            {fmt0(summary.projectedTotal)}
          </text>
        </>
      )}
      {last >= 0 && <circle cx={x(last)} cy={y(actual[last])} r={4} className="now-dot" />}
      {hover != null && (
        <g className="crosshair">
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={H - padB} />
          {prev[hover] != null && <circle cx={x(hover)} cy={y(prev[hover])} r={3.5} className="ch-prev" />}
          {(hover <= last || showProjection) && <circle cx={x(hover)} cy={y(projectedAt(hover))} r={4.5} className="ch-actual" />}
        </g>
      )}
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} className="axis" />
      {summary.daily.map((d, i) =>
        i === 0 || (i + 1) % 5 === 0 ? (
          <text key={d.date} x={x(i)} y={H - 5} textAnchor="middle" className="tick">{dayNum(d.date)}</text>
        ) : null,
      )}
    </svg>
  )
}

function DailyChart({ summary, colorOf, todayIndex }) {
  const tooltip = useTooltip()
  const navigate = useNavigate()
  const W = 640
  const H = 180
  const padB = 20
  const days = summary.daily
  const perDay = summary.totalBudget / summary.daysInPeriod
  const totals = days.map((d) => d.total)
  // Cap the scale so one large day (e.g. rent) doesn't flatten the rest; clipped bars get a break mark
  const max = Math.max(1, perDay * 1.25, Math.min(Math.max(...totals), perDay * 3))
  const bw = W / days.length
  const y = (v) => (H - padB) * (1 - v / max)

  return (
    <svg className="daily interactive" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spending per day, stacked by category">
      {days.map((day, i) => {
        let acc = 0
        const rows = summary.categories
          .filter((c) => day.byCategory[c.categoryId])
          .map((c) => ({ color: colorOf[c.categoryId], label: c.categoryName, value: fmt0(day.byCategory[c.categoryId]) }))
        return (
          <g
            key={day.date}
            className="day-col"
            {...hoverable(
              tooltip,
              () => (
                <Tip
                  title={dayLabel(day.date)}
                  rows={[...rows, { label: 'Total', value: fmt0(day.total), strong: true }, ...(perDay > 0 ? [{ label: 'Even daily budget', value: fmt0(perDay) }] : [])]}
                  hint={day.total > 0 ? 'Click to see that day’s expenses' : 'Nothing spent'}
                />
              ),
              day.total > 0 ? () => navigate(expensesLink(summary, { from: day.date, to: day.date })) : undefined,
            )}
          >
            <rect x={i * bw} y={0} width={bw} height={H - padB} className="hit" />
            {summary.categories.map((c) => {
              const v = day.byCategory[c.categoryId]
              if (!v) return null
              const top = Math.max(0, y(acc + v))
              const h = Math.max(0, y(acc) - top)
              acc += v
              return <rect key={c.categoryId} x={i * bw + 2} y={top} width={bw - 4} height={Math.max(h, 1)} fill={colorOf[c.categoryId]} />
            })}
            {day.total > max && <path d={`M${i * bw + 1} 9 l${bw - 2} -5 M${i * bw + 1} 14 l${bw - 2} -5`} className="clip" />}
            {(i === 0 || (i + 1) % 5 === 0 || i === todayIndex) && (
              <text x={i * bw + bw / 2} y={H - 5} textAnchor="middle" className={i === todayIndex ? 'today' : ''}>{dayNum(day.date)}</text>
            )}
          </g>
        )
      })}
      {todayIndex >= 0 && <line x1={todayIndex * bw + bw / 2} x2={todayIndex * bw + bw / 2} y1={0} y2={H - padB} className="today-line" />}
      {perDay > 0 && <line x1={0} x2={W} y1={y(perDay)} y2={y(perDay)} className="pace" />}
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} className="axis" />
    </svg>
  )
}

function WhereItWent({ summary, prevLabel }) {
  if (!summary.categories.length) return <p className="muted">Add categories to see your budget split.</p>
  return (
    <div className="where-grid">
      {summary.categories.map((c) => {
        const delta = c.spent - c.previousSpentToDate
        const st = STATUS[c.paceStatus] || STATUS.ON_TRACK
        return (
          <div key={c.categoryId} className="where">
            <div className="where-cat">
              <span className="dot" style={{ background: categoryColor(c.categoryName) }} />
              <Link to={expensesLink(summary, { categoryId: c.categoryId })} className="where-name"><strong>{c.categoryName}</strong></Link>
              <span className="fig-sm">{fmt0(c.spent)}</span>
              <span className="muted"> / {fmt0(c.budget)}</span>
            </div>
            <div className="where-meta">
              <span className={`chip ${st.tone}`}>{st.label}</span>
              {summary.daysElapsed < summary.daysInPeriod && c.budget > 0 && <span className="muted">On pace for {fmt0(c.projected)}</span>}
              {summary.daysElapsed > 0 && (
                <span className={delta > 0 ? 'neg' : 'pos'}>
                  {delta === 0 ? `Same as ${prevLabel}` : `${delta > 0 ? '+' : '−'}${fmt0(Math.abs(delta))} vs ${prevLabel}`}
                </span>
              )}
            </div>
            {c.subcategories.map((sc) => {
              const pct = sc.budget > 0 ? (sc.spent / sc.budget) * 100 : sc.spent > 0 ? 100 : 0
              return (
                <Link
                  key={sc.subcategoryId}
                  to={expensesLink(summary, { subCategoryId: sc.subcategoryId })}
                  className="where-sub linkrow"
                  title={sc.budget > 0 ? `${Math.round(pct)}% of ${fmt(sc.budget)} budget. Click to see these expenses.` : 'Click to see these expenses.'}
                >
                  <span>{sc.subcategoryName}</span>
                  <div className="mini-meter">
                    <span style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? 'var(--danger)' : categoryColor(c.categoryName) }} />
                  </div>
                  <span className="fig-sm">{fmt0(sc.spent)}</span>
                </Link>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function Breakdown({ rows, total }) {
  if (!rows.length) return <p className="muted">Nothing spent yet this month.</p>
  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div key={r.name} className="bd-row">
          <div className="bd-top">
            <span>{r.name}</span>
            <span className="fig-sm">{fmt0(r.amount)}</span>
          </div>
          <div className="mini-meter"><span style={{ width: `${(r.amount / total) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}
