import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, Sun, Sunrise, Sunset } from 'lucide-react'
import { api } from '../../api'
import { Tip, hoverable, useTooltip } from '../../components/Tooltip'
import { categoryColor, fmt, fmt0 } from '../../format'
import { useAction } from '../../useAsync'
import { change, cycleName, expensesLink, monthRange } from './shared'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const hourLabel = (h) => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`)

export default function Patterns({ month }) {
  const { busy, error, run } = useAction()
  const [data, setData] = useState(null)
  const { from, to } = monthRange(month)

  useEffect(() => {
    run(async () => setData(await api.analytics.patterns(from, to)))
  }, [run, from, to])

  if (error) return <div className="error">{error}</div>
  if (!data) return busy ? <div className="panel muted">Loading patterns…</div> : null

  const total = data.weekdayTotal + data.weekendTotal
  if (!total) return <div className="panel empty">No expenses this month, so there are no patterns to show yet.</div>

  const peak = findPeak(data)
  const weekdayAvg = data.weekdayDays ? data.weekdayTotal / data.weekdayDays : 0
  const weekendAvg = data.weekendDays ? data.weekendTotal / data.weekendDays : 0
  const prevLabel = cycleName(data.previousFrom, 'short')

  return (
    <>
      <p className="insight">
        Spending peaks on <strong>{DAYS[peak.day]}s</strong> around <strong>{hourLabel(peak.hour)}</strong>.{' '}
        {weekendAvg > 0 && weekdayAvg > 0 && (
          <>
            A weekend day costs <strong>{fmt0(weekendAvg)}</strong> on average against <strong>{fmt0(weekdayAvg)}</strong> on a weekday.
          </>
        )}
      </p>

      <div className="ov-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Calendar</h3>
            <span className="muted">Darker days cost more</span>
          </div>
          <Calendar days={data.daily} />
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Weekdays and weekends</h3></div>
          <div className="split">
            <div className="split-bar">
              <span style={{ flexGrow: data.weekdayTotal, background: 'var(--accent)' }} />
              <span style={{ flexGrow: data.weekendTotal, background: 'var(--accent-2)' }} />
            </div>
            <div className="split-rows">
              <div><i style={{ background: 'var(--accent)' }} />Weekdays<span className="fig-sm">{fmt0(data.weekdayTotal)}</span><span className="muted">{fmt0(weekdayAvg)}/day</span></div>
              <div><i style={{ background: 'var(--accent-2)' }} />Weekends<span className="fig-sm">{fmt0(data.weekendTotal)}</span><span className="muted">{fmt0(weekendAvg)}/day</span></div>
            </div>
          </div>
          <div className="panel-head" style={{ marginTop: 20 }}><h3>Average per day of week</h3></div>
          <DayOfWeekBars stats={data.byDayOfWeek} />
        </section>

        <section className="panel span-2">
          <div className="panel-head">
            <h3>Time of day</h3>
            <span className="muted">Share of this cycle's spending</span>
          </div>
          <TimeOfDay heatmap={data.heatmap} counts={data.heatmapCounts} total={total} />
        </section>

        <section className="panel span-2">
          <div className="panel-head">
            <h3>When you spend</h3>
            <span className="muted">Day of week by hour</span>
          </div>
          <HourHeatmap data={data} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Top subcategories</h3>
            <span className="muted">vs {prevLabel}</span>
          </div>
          {data.topSubcategories.map((s) => {
            const c = change(s.spent, s.previousSpent, fmt0)
            return (
              <div key={s.subcategoryId} className="top-row">
                <span className="dot" style={{ background: categoryColor(s.categoryName) }} />
                <div className="recent-main">
                  <div>{s.subcategoryName}</div>
                  <div className="muted">{s.categoryName}</div>
                </div>
                <span className="fig-sm">{fmt0(s.spent)}</span>
                <span className={`delta ${c.dir}`}>{c.dir === 'flat' ? '—' : c.text}</span>
              </div>
            )
          })}
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Largest expenses</h3></div>
          {data.largest.map((e) => (
            <div key={e.transactionId} className="recent">
              <span className="dot" style={{ background: categoryColor(e.categoryName) }} />
              <div className="recent-main">
                <div>{e.notes || e.subcategoryName}</div>
                <div className="muted">
                  {new Date(e.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {e.paymentMethodName}
                </div>
              </div>
              <span className="fig-sm">{fmt(e.amount)}</span>
            </div>
          ))}
          <div className="panel-head" style={{ marginTop: 20 }}><h3>By bank account</h3></div>
          <div className="breakdown">
            {data.bankAccounts.map((b) => (
              <div key={b.name} className="bd-row">
                <div className="bd-top"><span className={b.name === 'No account' ? 'muted' : ''}>{b.name}</span><span className="fig-sm">{fmt0(b.amount)}</span></div>
                <div className="mini-meter"><span style={{ width: `${(b.amount / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function findPeak(data) {
  let best = { day: 0, hour: 0, v: -1 }
  data.heatmap.forEach((row, d) => row.forEach((v, h) => { if (v > best.v) best = { day: d, hour: h, v } }))
  return best
}

const shade = (v, max) => (v <= 0 ? 'var(--paper)' : `color-mix(in srgb, var(--accent) ${Math.round(18 + (v / max) * 82)}%, var(--surface))`)

function Calendar({ days }) {
  const tooltip = useTooltip()
  const navigate = useNavigate()
  const max = Math.max(...days.map((d) => d.total), 1)
  const [y, m, d0] = days[0].date.split('-').map(Number)
  const first = new Date(y, m - 1, d0)
  const lead = (first.getDay() + 6) % 7 // Monday-first offset
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return (
    <div className="calendar">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="cal-h">{d}</div>)}
      {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} />)}
      {days.map((d) => {
        const future = d.date > today && !d.total
        const dark = d.total / max > 0.55
        return (
          <div
            key={d.date}
            className={`cal-d${future ? ' future' : ''}${dark ? ' dark' : ''}`}
            style={{ background: future ? undefined : shade(d.total, max) }}
            {...hoverable(
              tooltip,
              () => <Tip title={new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} rows={[{ label: 'Spent', value: fmt(d.total) }, { label: 'Expenses', value: String(d.count) }]} hint={d.total > 0 ? 'Click to see them' : undefined} />,
              d.total > 0 ? () => navigate(expensesLink({ from: d.date, to: d.date })) : undefined,
            )}
          >
            <span>{Number(d.date.slice(8))}</span>
            {d.total > 0 && <small>{fmt0(d.total).replace('₹', '')}</small>}
          </div>
        )
      })}
    </div>
  )
}

function DayOfWeekBars({ stats }) {
  const avgs = stats.map((s) => (s.occurrences ? s.total / s.occurrences : 0))
  const max = Math.max(...avgs, 1)
  return (
    <div className="dow">
      {stats.map((s, i) => (
        <div key={s.dayOfWeek} className="dow-col" title={`${DAYS[i]}: ${fmt0(avgs[i])} on average, ${s.count} expenses`}>
          <div className="dow-bar"><span style={{ height: `${(avgs[i] / max) * 100}%`, background: i >= 5 ? 'var(--accent-2)' : 'var(--accent)' }} /></div>
          <small>{DAYS[i].slice(0, 3)}</small>
        </div>
      ))}
    </div>
  )
}

function HourHeatmap({ data }) {
  const tooltip = useTooltip()
  const max = Math.max(...data.heatmap.flat(), 1)
  return (
    <div className="hour-heat" role="img" aria-label="Spending by day of week and hour of day">
      <div />
      {Array.from({ length: 24 }, (_, h) => <div key={h} className="hh-h">{h % 3 === 0 ? hourLabel(h).replace(' ', '') : ''}</div>)}
      {data.heatmap.map((row, d) => (
        <div key={d} style={{ display: 'contents' }}>
          <div className="hh-day">{DAYS[d].slice(0, 3)}</div>
          {row.map((v, h) => (
            <div
              key={h}
              className="hh-cell"
              style={{ background: shade(v, max) }}
              {...hoverable(tooltip, () => <Tip title={`${DAYS[d]}s, ${hourLabel(h)}`} rows={[{ label: 'Spent', value: fmt(v) }, { label: 'Expenses', value: String(data.heatmapCounts[d][h]) }]} />)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const PERIODS = [
  { label: 'Morning', range: '6 am – 12 pm', hours: [6, 7, 8, 9, 10, 11], icon: Sunrise, color: '#fbbf24' },
  { label: 'Afternoon', range: '12 – 5 pm', hours: [12, 13, 14, 15, 16], icon: Sun, color: '#f97316' },
  { label: 'Evening', range: '5 – 9 pm', hours: [17, 18, 19, 20], icon: Sunset, color: '#ea580c' },
  { label: 'Night', range: '9 pm – 6 am', hours: [21, 22, 23, 0, 1, 2, 3, 4, 5], icon: Moon, color: '#a78bfa' },
]

function TimeOfDay({ heatmap, counts, total }) {
  const periods = PERIODS.map((p) => ({
    ...p,
    amount: heatmap.reduce((s, row) => s + p.hours.reduce((a, h) => a + row[h], 0), 0),
    count: counts.reduce((s, row) => s + p.hours.reduce((a, h) => a + row[h], 0), 0),
  }))
  const peak = periods.reduce((m, p) => (p.amount > m.amount ? p : m), periods[0])
  return (
    <div className="tod-grid">
      {periods.map((p) => (
        <div key={p.label} className={`tod${p === peak && p.amount > 0 ? ' peak' : ''}`} style={{ '--tc': p.color }}>
          <div className="tod-top"><p.icon size={15} />{p.label}</div>
          <span className="fig">{fmt0(p.amount)}</span>
          <small>{p.range} · {p.count} expenses</small>
          <div className="tod-bar"><span style={{ width: `${total ? (p.amount / total) * 100 : 0}%` }} /></div>
        </div>
      ))}
    </div>
  )
}
