import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { categoryColor, fmt0 } from '../../format'
import { expensesLink } from './shared'

const TAU = Math.PI * 2
const SIZE = 320
const C = SIZE / 2
const HOLE = 66
const INNER = [68, 112] // categories
const OUTER = [115, 156] // subcategories
const ZOOM_MS = 450

const polar = (r, a) => [C + r * Math.sin(a), C - r * Math.cos(a)]

/** Ring segment from angle a0 to a1 (radians, clockwise from 12 o'clock). */
function arcPath(r0, r1, a0, a1) {
  if (a1 - a0 >= TAU - 1e-4) {
    return `M${C} ${C - r1}A${r1} ${r1} 0 1 1 ${C} ${C + r1}A${r1} ${r1} 0 1 1 ${C} ${C - r1}Z`
      + `M${C} ${C - r0}A${r0} ${r0} 0 1 0 ${C} ${C + r0}A${r0} ${r0} 0 1 0 ${C} ${C - r0}Z`
  }
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = polar(r1, a0)
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r0, a1)
  const [x3, y3] = polar(r0, a0)
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const clip = (s, n) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const isTouch = () => window.matchMedia?.('(hover: none)').matches

/** Categories (and "Not spent") with their subcategories, each given its share of the circle. */
function buildTree(summary, income) {
  const cats = summary.categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
  const spent = cats.reduce((s, c) => s + c.spent, 0)
  const unspent = income > spent ? income - spent : 0
  const unit = TAU / (spent + unspent || 1)
  let at = 0
  const nodes = cats.map((c) => {
    const color = categoryColor(c.categoryName)
    const node = { id: c.categoryId, label: c.categoryName, value: c.spent, color, start: at, end: at + c.spent * unit, link: { categoryId: c.categoryId }, children: [] }
    const subs = c.subcategories.filter((s) => s.spent > 0).sort((a, b) => b.spent - a.spent)
    const rest = c.spent - subs.reduce((s, x) => s + x.spent, 0)
    const parts = [
      ...subs.map((s) => ({ id: s.subcategoryId, label: s.subcategoryName, value: s.spent, link: { categoryId: c.categoryId, subCategoryId: s.subcategoryId } })),
      ...(rest > 0.5 ? [{ id: `${c.categoryId}-rest`, label: 'No subcategory', value: rest, link: { categoryId: c.categoryId }, faint: true }] : []),
    ]
    let sub = at
    node.children = parts.map((p, i) => {
      const shade = p.faint ? 45 : Math.max(48, 100 - i * 13)
      const child = { ...p, parent: node, color: `color-mix(in srgb, ${color} ${shade}%, var(--surface))`, start: sub, end: sub + p.value * unit }
      sub = child.end
      return child
    })
    at = node.end
    return node
  })
  if (unspent) nodes.push({ id: 'unspent', label: 'Not spent', value: unspent, color: 'var(--line-strong)', start: at, end: TAU, children: [] })
  return { nodes, spent, unspent }
}

/** Animates the visible angle window [from, to] towards target; the whole circle is [0, TAU]. */
function useZoom(target0, target1) {
  const [view, setView] = useState([target0, target1])
  const current = useRef(view)
  useEffect(() => {
    const from = current.current
    const ms = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : ZOOM_MS
    const t0 = performance.now()
    let raf
    const step = (now) => {
      const p = ms ? Math.min(1, (now - t0) / ms) : 1
      const e = ease(p)
      const v = [from[0] + (target0 - from[0]) * e, from[1] + (target1 - from[1]) * e]
      current.current = v
      setView(v)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target0, target1])
  return view
}

/**
 * Sunburst of where the cycle's money went: categories on the inner ring, their subcategories outside.
 * Click a category to zoom into it; click a subcategory to open those expenses.
 */
export default function MoneyFlow({ summary, income }) {
  const navigate = useNavigate()
  const [focusId, setFocusId] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const { nodes, spent, unspent } = buildTree(summary, income)
  const focus = nodes.find((n) => n.id === focusId && n.children.length) ?? null
  const view = useZoom(focus ? focus.start : 0, focus ? focus.end : TAU)

  useEffect(() => {
    if (!focus) return
    const onKey = (e) => e.key === 'Escape' && setFocusId(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus])

  if (!spent) {
    return (
      <section className="panel flow">
        <div className="panel-head"><h3>Where the money went</h3></div>
        <p className="muted">Nothing spent yet this cycle.</p>
      </section>
    )
  }

  const all = nodes.flatMap((n) => [n, ...n.children])
  const hovered = all.find((n) => n.id === hoverId) ?? null
  const span = view[1] - view[0]
  const map = (a) => Math.min(TAU, Math.max(0, ((a - view[0]) / span) * TAU))

  const zoomTo = (n) => {
    setHoverId(null)
    setFocusId(n && n.children.length ? n.id : null)
  }
  const open = (n) => navigate(expensesLink(summary, n.link))
  // On touch screens the first tap on a subcategory shows its numbers; the second opens it
  const pickSub = (n) => (isTouch() && hoverId !== n.id ? setHoverId(n.id) : open(n))

  const related = (n) => !hovered || n === hovered || n === hovered.parent || n.parent === hovered
  const arcs = []
  const labels = []
  const addArc = (n, [r0, r1], onClick) => {
    const a0 = map(n.start)
    const a1 = map(n.end)
    if (a1 - a0 < 0.002) return
    arcs.push(
      <path
        key={n.id}
        d={arcPath(r0, r1, a0, a1)}
        fillRule="evenodd"
        style={{ fill: n.color }}
        className={`sb-arc${onClick ? '' : ' static'}${related(n) ? '' : ' dim'}`}
        onMouseEnter={() => setHoverId(n.id)}
        onMouseLeave={() => setHoverId(null)}
        onClick={onClick}
      />,
    )
    // Name along the arc when there's room for a few letters
    const mid = (a0 + a1) / 2
    const r = (r0 + r1) / 2
    const room = Math.floor(((a1 - a0) * r) / 6.6)
    if (a1 - a0 < TAU - 1e-4 && room >= 4) {
      const [x, y] = polar(r, mid)
      const deg = (mid * 180) / Math.PI + (mid > Math.PI / 2 && mid < Math.PI * 1.5 ? 180 : 0)
      labels.push(
        <text key={`t-${n.id}`} x={x} y={y} transform={`rotate(${deg} ${x} ${y})`} className={`sb-label${n.parent ? ' sub' : n.id === 'unspent' ? ' light' : ''}${related(n) ? '' : ' dim'}`} textAnchor="middle" dominantBaseline="central">
          {clip(n.label, room)}
        </text>,
      )
    }
  }
  nodes.forEach((n) => {
    addArc(n, INNER, n.children.length ? () => zoomTo(focus ? null : n) : undefined)
    n.children.forEach((s) => addArc(s, OUTER, () => pickSub(s)))
  })

  // What the middle of the ring shows: the hovered piece, else the zoomed category, else the total
  // Shares match the legend: categories are a share of income when some was left over, else of spending
  const shown = hovered ?? focus
  let center
  if (shown) {
    const of = shown.parent ? `of ${shown.parent.label}` : unspent ? 'of income' : 'of spending'
    const whole = shown.parent ? shown.parent.value : spent + unspent
    center = { label: shown.label, value: shown.value, note: `${pct(shown.value, whole)}% ${of}` }
  } else if (income > 0) {
    center = spent > income
      ? { label: 'Spent', value: spent, note: `${fmt0(spent - income)} over income`, bad: true }
      : { label: 'Spent', value: spent, note: `${pct(spent, income)}% of ${fmt0(income)} income` }
  } else {
    center = { label: 'Spent', value: spent, note: `across ${nodes.length} categories` }
  }

  const items = focus ? focus.children : nodes
  const whole = focus ? focus.value : spent + unspent

  return (
    <section className="panel flow">
      <div className="panel-head">
        <h3>Where the money went</h3>
        <span className="muted">
          {focus
            ? <><span className="pointer-hint">Click a subcategory to see its expenses</span><span className="touch-hint">Tap a subcategory twice to see its expenses</span></>
            : <><span className="pointer-hint">Click a category to break it down</span><span className="touch-hint">Tap a category to break it down</span></>}
        </span>
      </div>

      <div className="sunburst">
        <div className="sb-chart">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Spending by category and subcategory${focus ? `, zoomed into ${focus.label}` : ''}`}>
            {arcs}
            {labels}
            <circle
              cx={C}
              cy={C}
              r={HOLE}
              className={`sb-hole${focus ? ' back' : ''}`}
              onClick={focus ? () => zoomTo(null) : undefined}
            />
            <g className="sb-center" pointerEvents="none">
              <text x={C} y={C - 24} textAnchor="middle" className="sb-c-label">{clip(center.label, 18)}</text>
              <text x={C} y={C + 4} textAnchor="middle" className="sb-c-value">{fmt0(center.value)}</text>
              <text x={C} y={C + 24} textAnchor="middle" className={`sb-c-note${center.bad ? ' bad' : ''}`}>{center.note}</text>
              {focus && !hovered && <text x={C} y={C + 44} textAnchor="middle" className="sb-c-back">Back to all</text>}
            </g>
          </svg>
        </div>

        <div className="sb-side">
          {focus && (
            <div className="sb-crumb">
              <button className="secondary small" onClick={() => zoomTo(null)}>
                <ChevronLeft size={15} /> All categories
              </button>
              <Link className="sb-open" to={expensesLink(summary, focus.link)}>
                See all {focus.label} expenses <ExternalLink size={13} />
              </Link>
            </div>
          )}
          <ul className="sb-legend">
            {items.map((n) => {
              const clickable = focus || n.children.length
              const body = (
                <>
                  <i style={{ background: n.color }} />
                  <span className="sb-name">{n.label}</span>
                  <b>{fmt0(n.value)}</b>
                  <small>{pct(n.value, whole)}%</small>
                  <span className="sb-bar"><span style={{ width: `${pct(n.value, whole)}%`, background: n.color }} /></span>
                </>
              )
              const hover = { onMouseEnter: () => setHoverId(n.id), onMouseLeave: () => setHoverId(null), onFocus: () => setHoverId(n.id), onBlur: () => setHoverId(null) }
              return (
                <li key={n.id}>
                  {clickable ? (
                    <button
                      className={`sb-item${hoverId === n.id ? ' on' : ''}`}
                      onClick={() => (focus ? open(n) : zoomTo(n))}
                      aria-label={focus ? `See ${n.label} expenses` : `Break down ${n.label}`}
                      {...hover}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={`sb-item${hoverId === n.id ? ' on' : ''}`} {...hover}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
