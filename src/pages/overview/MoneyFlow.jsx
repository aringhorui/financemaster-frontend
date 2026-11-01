import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tip, hoverable, useTooltip } from '../../components/Tooltip'
import { categoryColor, fmt0 } from '../../format'
import { expensesLink } from './shared'

const SUBS_PER_CATEGORY = 3
const W = 760
const H = 340
const NODE_W = 12
const GAP = 8
const X = [0, 300, 548]

/**
 * Sankey of where the month's money went: income (or total spent) → categories → top subcategories.
 */
export default function MoneyFlow({ summary, income }) {
  const tooltip = useTooltip()
  const navigate = useNavigate()
  const [active, setActive] = useState(null)
  const cats = summary.categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
  const spent = cats.reduce((s, c) => s + c.spent, 0)
  if (!spent) {
    return (
      <section className="panel flow">
        <div className="panel-head"><h3>Where the money went</h3></div>
        <p className="muted">Nothing spent yet this month.</p>
      </section>
    )
  }

  const unspent = income > spent ? income - spent : 0
  const overspend = income > 0 && spent > income ? spent - income : 0
  const total = Math.max(income, spent)

  // ── Columns of nodes: { id, label, value, color } ──
  const col0 = income > 0
    ? [{ id: 'income', label: 'Income', value: income, color: 'var(--ok)' }, ...(overspend ? [{ id: 'savings', label: 'From savings', value: overspend, color: 'var(--danger)' }] : [])]
    : [{ id: 'spent', label: 'Spent', value: spent, color: 'var(--chart-ink)' }]
  const col1 = [
    ...cats.map((c) => ({ id: c.categoryId, label: c.categoryName, value: c.spent, color: categoryColor(c.categoryName), link: { categoryId: c.categoryId } })),
    ...(unspent ? [{ id: 'unspent', label: 'Not spent', value: unspent, color: 'var(--line-strong)' }] : []),
  ]
  const col2 = []
  const subLinks = []
  cats.forEach((c) => {
    const subs = c.subcategories.filter((s) => s.spent > 0).sort((a, b) => b.spent - a.spent)
    const top = subs.slice(0, SUBS_PER_CATEGORY)
    const rest = c.spent - top.reduce((s, x) => s + x.spent, 0)
    top.forEach((s) => {
      col2.push({ id: s.subcategoryId, label: s.subcategoryName, value: s.spent, color: categoryColor(c.categoryName), link: { subCategoryId: s.subcategoryId }, parent: c.categoryId })
      subLinks.push({ from: c.categoryId, to: s.subcategoryId, value: s.spent })
    })
    if (rest > 0.5) {
      const id = `${c.categoryId}-rest`
      col2.push({ id, label: `Other ${c.categoryName}`, value: rest, color: categoryColor(c.categoryName), link: { categoryId: c.categoryId }, parent: c.categoryId })
      subLinks.push({ from: c.categoryId, to: id, value: rest })
    }
  })

  const maxNodes = Math.max(col0.length, col1.length, col2.length)
  const scale = (H - GAP * (maxNodes - 1)) / total
  const place = (col, x) => {
    const height = col.reduce((s, n) => s + n.value * scale, 0) + GAP * (col.length - 1)
    let y = (H - height) / 2
    return col.map((n) => {
      const node = { ...n, x, y, h: Math.max(1, n.value * scale), outY: y, inY: y }
      y += node.h + GAP
      return node
    })
  }
  const n0 = place(col0, X[0])
  const n1 = place(col1, X[1])
  const n2 = place(col2, X[2])
  const byId = Object.fromEntries([...n0, ...n1, ...n2].map((n) => [n.id, n]))

  // First-stage links: spread each source across the categories in order
  const links = []
  const targets = [...n1]
  let src = 0
  let srcLeft = n0[0].value
  targets.forEach((t) => {
    let need = t.value
    while (need > 0.001 && src < n0.length) {
      const take = Math.min(need, srcLeft)
      links.push({ from: n0[src].id, to: t.id, value: take, color: t.color })
      need -= take
      srcLeft -= take
      if (srcLeft <= 0.001) {
        src++
        srcLeft = n0[src]?.value ?? 0
      }
    }
  })
  subLinks.forEach((l) => links.push({ ...l, color: byId[l.to].color }))

  const paths = links.map((l, i) => {
    const a = byId[l.from]
    const b = byId[l.to]
    const h = l.value * scale
    const x0 = a.x + NODE_W
    const x1 = b.x
    const y0 = a.outY
    const y1 = b.inY
    a.outY += h
    b.inY += h
    const xm = (x0 + x1) / 2
    const d = `M${x0} ${y0} C${xm} ${y0} ${xm} ${y1} ${x1} ${y1} L${x1} ${y1 + h} C${xm} ${y1 + h} ${xm} ${y0 + h} ${x0} ${y0 + h} Z`
    // Highlight everything connected to the hovered node: its own links plus, for a category, its income link and subcategory links
    const on = active == null || l.from === active || l.to === active || byId[l.to]?.parent === active || byId[active]?.parent === l.to
    return (
      <path
        key={i}
        d={d}
        fill={l.color}
        className={`flow-link${active != null ? (on ? ' on' : ' off') : ''}`}
        {...hoverable(tooltip, () => <Tip title={`${a.label} → ${b.label}`} rows={[{ color: l.color, label: 'Amount', value: fmt0(l.value) }, ...(income > 0 ? [{ label: 'Share of income', value: `${Math.round((l.value / income) * 100)}%` }] : [])]} />)}
      />
    )
  })

  const label = (n, side) => (
    <text
      key={`l-${n.id}`}
      x={side === 'left' ? n.x - 6 : n.x + NODE_W + 6}
      y={n.y + n.h / 2}
      textAnchor={side === 'left' ? 'end' : 'start'}
      dominantBaseline="middle"
      className="flow-label"
    >
      {n.label} <tspan className="flow-amt">{fmt0(n.value)}</tspan>
    </text>
  )

  return (
    <section className="panel flow">
      <div className="panel-head">
        <h3>Where the money went</h3>
        <span className="muted">{income > 0 ? 'Income through categories to subcategories' : 'Add income to see what was kept'}</span>
      </div>
      <svg viewBox={`-90 0 ${W + 90} ${H}`} className="flow-svg" role="img" aria-label="Money flow from income to categories and subcategories">
        {paths}
        {[...n0, ...n1, ...n2].map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width={NODE_W}
            height={n.h}
            fill={n.color}
            rx="2"
            className="flow-node"
            onMouseOver={() => setActive(n.id)}
            onMouseOut={() => setActive(null)}
            {...hoverable(
              tooltip,
              () => (
                <Tip
                  title={n.label}
                  rows={[
                    { color: n.color, label: 'Amount', value: fmt0(n.value) },
                    ...(income > 0 ? [{ label: 'Share of income', value: `${Math.round((n.value / income) * 100)}%` }] : []),
                  ]}
                  hint={n.link ? 'Click to see these expenses' : undefined}
                />
              ),
              n.link ? () => navigate(expensesLink(summary, n.link)) : undefined,
            )}
          />
        ))}
        {n0.map((n) => label(n, 'left'))}
        {n1.map((n) => label(n, 'right'))}
        {n2.filter((n) => n.h >= 9).map((n) => label(n, 'right'))}
      </svg>
    </section>
  )
}
