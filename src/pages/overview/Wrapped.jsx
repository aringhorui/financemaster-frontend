import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, CalendarDays, Coffee, Crown, Download, Flame, Gem, HeartPulse, PartyPopper, PiggyBank, RotateCcw, Share2, ShoppingBag, Sparkles,
  Target, Wallet, X,
} from 'lucide-react'
import { api } from '../../api'
import { CountUp } from '../../components/KPI'
import { categoryColor, fmt0 } from '../../format'
import { cycleDates, monthRange, parseIso } from './shared'

const SLIDE_MS = 6500
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const PERIODS = [
  { label: 'mornings', hours: [6, 7, 8, 9, 10, 11] },
  { label: 'afternoons', hours: [12, 13, 14, 15, 16] },
  { label: 'evenings', hours: [17, 18, 19, 20] },
  { label: 'late nights', hours: [21, 22, 23, 0, 1, 2, 3, 4, 5] },
]
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const pct = (v) => `${Math.round(v * 100)}%`
const dayName = (iso) => parseIso(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })

/** Picks one spending personality from the cycle, most telling first. */
function personality({ rate, weekendAvg, weekdayAvg, smallShare, smallTotal, largestShare }) {
  if (rate != null && rate >= 0.3) {
    return { name: 'The Saver', icon: PiggyBank, line: `You kept ${pct(rate)} of your income. Future you says thanks.`, tip: 'Move your savings out on payday, before spending starts.' }
  }
  if (weekendAvg > 0 && weekendAvg > weekdayAvg * 1.4) {
    return { name: 'The Weekend Spender', icon: PartyPopper, line: `A weekend day cost ${fmt0(weekendAvg)}, against ${fmt0(weekdayAvg)} on a weekday.`, tip: 'Plan one low-cost weekend outing each week.' }
  }
  if (smallShare >= 0.25) {
    return { name: 'The Snacker', icon: Coffee, line: `Spends under ₹500 added up to ${fmt0(smallTotal)}, ${pct(smallShare)} of the cycle.`, tip: 'Set a weekly cap for small buys and track it.' }
  }
  if (largestShare >= 0.35) {
    return { name: 'The Big-Ticket Buyer', icon: Gem, line: `One expense was ${pct(largestShare)} of everything you spent.`, tip: 'Plan big purchases a cycle ahead so they don’t surprise the budget.' }
  }
  return { name: 'The Steady Planner', icon: Target, line: 'No big swings. Your spending stayed close to plan.', tip: 'Nudge your savings target up by 5% next cycle.' }
}

function buildStory({ month, s, h, p, health, sv }) {
  const label = new Date(month.y, month.m, 1).toLocaleString('en-IN', { month: 'long' })
  const total = s.totalSpent
  const prevDelta = s.previousTotal > 0 ? (total - s.previousTotal) / s.previousTotal : null
  const cats = s.categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
  const signature = h.repeatItems[0]
  const biggestDay = s.daily.reduce((m, d) => (d.total > (m?.total ?? 0) ? d : m), null)
  const dowAvg = p.byDayOfWeek.map((d) => (d.occurrences ? d.total / d.occurrences : 0))
  const peakDow = dowAvg.indexOf(Math.max(...dowAvg))
  const periods = PERIODS.map((x) => ({ ...x, amount: p.heatmap.reduce((t, row) => t + x.hours.reduce((a, hr) => a + row[hr], 0), 0) }))
  const peakPeriod = periods.reduce((m, x) => (x.amount > m.amount ? x : m), periods[0])
  const weekdayAvg = p.weekdayDays ? p.weekdayTotal / p.weekdayDays : 0
  const weekendAvg = p.weekendDays ? p.weekendTotal / p.weekendDays : 0
  const income = sv?.income || 0
  const rate = sv?.savingsRate ?? null
  const st = h.streaks
  const persona = personality({
    rate, weekendAvg, weekdayAvg, smallShare: h.smallSpendShare, smallTotal: h.smallSpendTotal,
    largestShare: total > 0 && s.largestExpense ? s.largestExpense.amount / total : 0,
  })

  const slides = []
  slides.push({
    key: 'intro', tone: 'ember',
    body: (
      <>
        <Sparkles className="wr-icon" />
        <p className="wr-kicker">Your salary cycle, wrapped</p>
        <h2 className="wr-huge">{label}</h2>
        <p className="wr-sub">{cycleDates(month)} · {s.daysInPeriod} days · {s.transactionCount} expenses</p>
      </>
    ),
  })
  slides.push({
    key: 'total', tone: 'amber',
    body: (
      <>
        <Wallet className="wr-icon" />
        <p className="wr-kicker">This cycle you spent</p>
        <h2 className="wr-huge"><CountUp value={total} format={fmt0} /></h2>
        {prevDelta != null && (
          <p className="wr-sub">
            That’s <strong>{pct(Math.abs(prevDelta))} {prevDelta > 0 ? 'more' : 'less'}</strong> than the cycle before.
          </p>
        )}
        {s.transactionCount > 0 && <p className="wr-sub">About {fmt0(total / s.transactionCount)} per expense.</p>}
      </>
    ),
  })
  if (cats.length) {
    slides.push({
      key: 'cats', tone: 'ember',
      body: (
        <>
          <Crown className="wr-icon" />
          <p className="wr-kicker">Most of it went to</p>
          <h2 className="wr-big">{cats[0].categoryName}</h2>
          <div className="wr-bars">
            {cats.slice(0, 3).map((c, i) => (
              <div key={c.categoryId} className="wr-bar" style={{ '--c': categoryColor(c.categoryName), '--w': `${(c.spent / total) * 100}%`, '--d': `${i * 120}ms` }}>
                <span>{c.categoryName}</span>
                <b>{fmt0(c.spent)} · {pct(c.spent / total)}</b>
              </div>
            ))}
          </div>
        </>
      ),
    })
  }
  if (signature) {
    slides.push({
      key: 'signature', tone: 'rose',
      body: (
        <>
          <ShoppingBag className="wr-icon" />
          <p className="wr-kicker">Your signature buy</p>
          <h2 className="wr-big">“{signature.name}”</h2>
          <p className="wr-stat"><CountUp value={signature.count} format={(v) => `${Math.round(v)} times`} /></p>
          <p className="wr-sub">{fmt0(signature.total)} in all, about {fmt0(signature.average)} each.</p>
        </>
      ),
    })
  }
  if (biggestDay?.total > 0) {
    slides.push({
      key: 'day', tone: 'amber',
      body: (
        <>
          <CalendarDays className="wr-icon" />
          <p className="wr-kicker">Your biggest day</p>
          <h2 className="wr-big">{dayName(biggestDay.date)}</h2>
          <p className="wr-stat"><CountUp value={biggestDay.total} format={fmt0} /></p>
          {s.largestExpense && <p className="wr-sub">Including “{s.largestExpense.name}” for {fmt0(s.largestExpense.amount)}.</p>}
        </>
      ),
    })
  }
  if (total > 0) {
    slides.push({
      key: 'when', tone: 'violet',
      body: (
        <>
          <Activity className="wr-icon" />
          <p className="wr-kicker">You spend the most on</p>
          <h2 className="wr-big">{DAYS[peakDow]}s</h2>
          <p className="wr-sub">especially {peakPeriod.label}, which took {pct(peakPeriod.amount / total)} of the cycle.</p>
          <p className="wr-sub">A weekend day averaged {fmt0(weekendAvg)}; a weekday {fmt0(weekdayAvg)}.</p>
        </>
      ),
    })
  }
  slides.push({
    key: 'streaks', tone: 'green',
    body: (
      <>
        <Flame className="wr-icon" />
        <p className="wr-kicker">Days you spent nothing</p>
        <h2 className="wr-huge"><CountUp value={st.noSpendDays} format={(v) => Math.round(v)} /></h2>
        <p className="wr-sub">Longest run: <strong>{st.longestNoSpendStreak} {st.longestNoSpendStreak === 1 ? 'day' : 'days'}</strong>.</p>
        {st.dailyBudget != null && <p className="wr-sub">You stayed within {fmt0(st.dailyBudget)} a day on {st.daysUnderDailyBudget} of {st.daysCounted} days.</p>}
      </>
    ),
  })
  if (income > 0) {
    slides.push({
      key: 'saved', tone: 'green',
      body: (
        <>
          <PiggyBank className="wr-icon" />
          <p className="wr-kicker">From {fmt0(income)} of income you kept</p>
          <h2 className="wr-huge"><CountUp value={Math.max(0, sv.savedAndInvested)} format={fmt0} /></h2>
          <p className="wr-sub">A savings rate of <strong>{rate == null ? '—' : pct(rate)}</strong>{rate != null && rate >= 0.2 ? ', above the 20% rule of thumb.' : '. The 20% rule of thumb is the next milestone.'}</p>
        </>
      ),
    })
  }
  if (health?.score != null) {
    slides.push({
      key: 'health', tone: 'ember',
      body: (
        <>
          <HeartPulse className="wr-icon" />
          <p className="wr-kicker">Money health score</p>
          <h2 className="wr-huge"><CountUp value={health.score} format={(v) => Math.round(v)} /><span className="wr-of">/100</span></h2>
          <p className="wr-sub">{health.components.filter((c) => c.points != null).sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints)[0]?.detail}</p>
        </>
      ),
    })
  }
  slides.push({
    key: 'persona', tone: 'rose',
    body: (
      <>
        <persona.icon className="wr-icon big" />
        <p className="wr-kicker">Your spending personality</p>
        <h2 className="wr-big">{persona.name}</h2>
        <p className="wr-sub">{persona.line}</p>
        <p className="wr-tip">Next cycle: {persona.tip}</p>
      </>
    ),
  })

  const summary = {
    title: `My ${label} cycle`,
    dates: cycleDates(month),
    rows: [
      ['Spent', fmt0(total)],
      ...(income > 0 ? [['Kept', `${fmt0(Math.max(0, sv.savedAndInvested))}${rate != null ? ` (${pct(rate)})` : ''}`]] : []),
      ...(cats.length ? [['Top category', cats[0].categoryName]] : []),
      ...(signature ? [['Signature buy', `${signature.name} ×${signature.count}`]] : []),
      ['No-spend days', String(st.noSpendDays)],
      ...(health?.score != null ? [['Health score', `${health.score}/100`]] : []),
    ],
    persona: persona.name,
  }
  slides.push({ key: 'summary', tone: 'ember', summary })
  return { slides, summary }
}

const escapeXml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

/** Draws the summary as a 1080×1350 PNG (Instagram portrait). */
async function summaryPng(summary) {
  const W = 1080
  const H = 1350
  const font = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
  const rows = summary.rows
    .map(([k, v], i) => {
      const y = 520 + i * 104
      return `<text x="90" y="${y}" fill="#a3a3a3" font-size="34" font-family="${font}">${escapeXml(k)}</text>
        <text x="990" y="${y}" fill="#fafafa" font-size="40" font-weight="700" text-anchor="end" font-family="${font}">${escapeXml(v)}</text>
        <line x1="90" x2="990" y1="${y + 34}" y2="${y + 34}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="g" cx="25%" cy="20%" r="80%"><stop offset="0" stop-color="#7c2d12"/><stop offset="0.55" stop-color="#1c0a02"/><stop offset="1" stop-color="#0a0a0a"/></radialGradient>
      <linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="#ea580c"/><stop offset="0.5" stop-color="#fb923c"/><stop offset="1" stop-color="#ea580c"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="10" fill="url(#l)"/>
    <text x="90" y="170" fill="#fb923c" font-size="34" font-weight="700" letter-spacing="6" font-family="${font}">WRAPPED</text>
    <text x="90" y="270" fill="#fafafa" font-size="84" font-weight="800" font-family="${font}">${escapeXml(summary.title)}</text>
    <text x="90" y="335" fill="#a3a3a3" font-size="36" font-family="${font}">${escapeXml(summary.dates)}</text>
    ${rows}
    <rect x="90" y="${H - 250}" width="900" height="120" rx="28" fill="#f97316" fill-opacity="0.14" stroke="#f97316" stroke-opacity="0.4" stroke-width="2"/>
    <text x="130" y="${H - 175}" fill="#fdba74" font-size="40" font-weight="800" font-family="${font}">${escapeXml(summary.persona)}</text>
    <text x="90" y="${H - 60}" fill="#737373" font-size="28" font-family="${font}">FinanceMaster</text>
  </svg>`
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  canvas.getContext('2d').drawImage(img, 0, 0)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export default function Wrapped({ month, onClose }) {
  const [story, setStory] = useState(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [note, setNote] = useState('')
  const pressRef = useRef(null)
  const progressRef = useRef(0)

  useEffect(() => {
    const { from, to, ym } = monthRange(month)
    let alive = true
    Promise.all([
      api.analytics.summary(from, to),
      api.analytics.habits(from, to),
      api.analytics.patterns(from, to),
      api.analytics.health(ym).catch(() => null),
      api.analytics.savings(ym, 1).catch(() => null),
    ])
      .then(([s, h, p, health, sav]) => {
        if (!alive) return
        if (!s.transactionCount) {
          setError('There are no expenses in this cycle yet, so there’s nothing to wrap.')
          return
        }
        setStory(buildStory({ month, s, h, p, health, sv: sav?.months?.[0] }))
      })
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [month])

  const count = story?.slides.length ?? 0
  const last = index === count - 1
  const go = useCallback((d) => {
    setIndex((i) => Math.max(0, Math.min(count - 1, i + d)))
    progressRef.current = 0
    setProgress(0)
  }, [count])

  // Auto-advance, paused while held and off when the user prefers reduced motion
  useEffect(() => {
    if (!story || paused || last || reduceMotion()) return undefined
    let frame
    let prev = performance.now()
    const tick = (now) => {
      const next = progressRef.current + (now - prev) / SLIDE_MS
      prev = now
      if (next >= 1) {
        progressRef.current = 0
        setProgress(0)
        setIndex((i) => Math.min(count - 1, i + 1))
        return
      }
      progressRef.current = next
      setProgress(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [story, paused, last, count, index])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [go, onClose])

  // Tap the left third to go back, elsewhere to go forward; press and hold to pause
  const onPointerDown = (e) => {
    if (e.target.closest('button')) return
    pressRef.current = { t: performance.now(), x: e.clientX, w: e.currentTarget.clientWidth }
    setPaused(true)
  }
  const onPointerUp = () => {
    const p = pressRef.current
    pressRef.current = null
    setPaused(false)
    if (p && performance.now() - p.t < 300) go(p.x < p.w / 3 ? -1 : 1)
  }

  const save = async () => {
    const blob = await summaryPng(story.summary)
    const file = new File([blob], `financemaster-${month.y}-${String(month.m + 1).padStart(2, '0')}-wrapped.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: story.summary.title })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
    setNote('Image saved to your downloads.')
  }

  const slide = story?.slides[index]

  return (
    <div className={`wrapped tone-${slide?.tone ?? 'ember'}`} role="dialog" aria-modal="true" aria-label="Cycle wrapped">
      <div className="wr-progress" aria-hidden="true">
        {story?.slides.map((sl, i) => (
          <span key={sl.key}><i style={{ width: `${i < index ? 100 : i === index ? (last ? 100 : progress * 100) : 0}%` }} /></span>
        ))}
      </div>
      <button className="wr-close" onClick={onClose} aria-label="Close wrapped"><X size={22} /></button>

      <div className="wr-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={() => pressRef.current && onPointerUp()}>
        {!story && !error && <p className="wr-sub">Wrapping your cycle…</p>}
        {error && <p className="wr-sub">{error}</p>}
        {slide && !slide.summary && <div key={slide.key} className="wr-slide">{slide.body}</div>}
        {slide?.summary && (
          <div key="summary" className="wr-slide">
            <div className="wr-card">
              <p className="wr-kicker">Wrapped</p>
              <h2 className="wr-big">{slide.summary.title}</h2>
              <p className="wr-sub">{slide.summary.dates}</p>
              <dl>
                {slide.summary.rows.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              <div className="wr-persona">{slide.summary.persona}</div>
            </div>
            <div className="wr-actions">
              <button onClick={save}>
                {navigator.share ? <Share2 size={16} /> : <Download size={16} />}
                {navigator.share ? 'Share image' : 'Save image'}
              </button>
              <button className="secondary" onClick={() => { setIndex(0); progressRef.current = 0; setProgress(0) }}><RotateCcw size={16} />Replay</button>
            </div>
            {note && <p className="wr-sub" role="status">{note}</p>}
          </div>
        )}
      </div>
      {story && <p className="wr-hint">{index + 1} / {count} · tap to continue · hold to pause</p>}
    </div>
  )
}
