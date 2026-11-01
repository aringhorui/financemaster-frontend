import { lazy, Suspense, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import ThisMonth from './ThisMonth'
import Trends from './Trends'
import Patterns from './Patterns'
import Cards from './Cards'
import Savings from './Savings'
import Habits from './Habits'
import { cycleDates, cycleOf, sameCycle } from './shared'

const Wrapped = lazy(() => import('./Wrapped'))

const TABS = [
  { id: 'month', label: 'This month' },
  { id: 'trends', label: 'Trends' },
  { id: 'savings', label: 'Savings' },
  { id: 'habits', label: 'Habits' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'cards', label: 'Credit cards' },
]

export default function Overview() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'month'
  const [month, setMonth] = useState(() => cycleOf())
  const [wrapped, setWrapped] = useState(null)
  const isCurrent = sameCycle(month, cycleOf())
  const label = new Date(month.y, month.m, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const shift = (delta) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  return (
    <div className="overview">
      <header className="ov-head">
        <div className="ov-title">
          <h2>
            {tab === 'cards' ? 'Current billing cycle' : label}
          </h2>
          <div className="tabs" role="tablist" aria-label="Overview views">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setParams(t.id === 'month' ? {} : { tab: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="month-switch" hidden={tab === 'cards'}>
          <button className="secondary small wrapped-btn" onClick={() => setWrapped(month)} title="See this cycle as a story">
            <Sparkles size={14} /> Wrapped
          </button>
          <button className="secondary small" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button
            className="secondary small cycle-range"
            onClick={() => !isCurrent && setMonth(cycleOf())}
            aria-disabled={isCurrent}
            title={isCurrent ? 'Current salary cycle' : 'Back to the current cycle'}
          >
            {cycleDates(month)}
          </button>
          <button className="secondary small" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </header>

      {tab === 'month' && <ThisMonth month={month} onOpenWrapped={setWrapped} />}
      {tab === 'trends' && <Trends month={month} onSelectMonth={setMonth} />}
      {tab === 'savings' && <Savings month={month} onSelectMonth={setMonth} />}
      {tab === 'habits' && <Habits month={month} />}
      {tab === 'patterns' && <Patterns month={month} />}
      {tab === 'cards' && <Cards />}
      {wrapped && (
        <Suspense fallback={null}>
          <Wrapped month={wrapped} onClose={() => setWrapped(null)} />
        </Suspense>
      )}
    </div>
  )
}
