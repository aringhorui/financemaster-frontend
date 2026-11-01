export const pad = (n) => String(n).padStart(2, '0')

export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseIso = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// A "month" is a salary cycle: salary lands on the last day of a month, so the cycle named after
// a month runs from the previous month's last day to the day before its own last day
// (November = 31 Oct to 29 Nov). Matches SalaryCycle on the backend.
export const cycleOf = (date = new Date()) => {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const d = date.getDate() === lastDay ? new Date(date.getFullYear(), date.getMonth() + 1, 1) : date
  return { y: d.getFullYear(), m: d.getMonth() }
}

export const sameCycle = (a, b) => a.y === b.y && a.m === b.m

/** Name of the cycle a period starting on fromIso belongs to, e.g. "October". */
export const cycleName = (fromIso, month = 'long') => {
  const c = cycleOf(parseIso(fromIso))
  return new Date(c.y, c.m, 1).toLocaleString('en-IN', { month })
}

export const monthRange = ({ y, m }) => {
  const start = new Date(y, m, 0)
  const end = new Date(y, m + 1, 0)
  end.setDate(end.getDate() - 1)
  return {
    from: isoDate(start),
    to: isoDate(end),
    ym: `${y}-${pad(m + 1)}`,
    days: Math.round((end - start) / 86400000) + 1,
  }
}

const short = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const cycleDates = (month) => {
  const { from, to } = monthRange(month)
  return `${short(parseIso(from))} – ${short(parseIso(to))}`
}

/** Position of a date within the cycle starting at fromIso (0-based). */
export const dayIndex = (fromIso, date = new Date()) =>
  Math.round((parseIso(isoDate(date)) - parseIso(fromIso)) / 86400000)

export const shortMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short' })
}

export const STATUS = {
  ON_TRACK: { label: 'On track', tone: 'ok' },
  AHEAD_OF_PACE: { label: 'Ahead of pace', tone: 'warn' },
  AT_RISK: { label: 'Likely to overspend', tone: 'warn' },
  OVER_BUDGET: { label: 'Over budget', tone: 'bad' },
  NO_BUDGET: { label: 'No budget', tone: 'muted' },
}

// Signed change vs a previous value, e.g. "+₹1,200 (+18%)"; pct omitted when previous is 0
export const change = (now, before, format) => {
  const d = now - before
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const pct = before > 0 ? ` (${sign}${Math.round((Math.abs(d) / before) * 100)}%)` : ''
  return { text: `${sign}${format(Math.abs(d))}${pct}`, dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' }
}

/** Link to the Expenses list for a date range (default: the summary's cycle) and optionally a category or subcategory. */
export const expensesLink = (range, { from = range.from, to = range.to, categoryId, subCategoryId } = {}) => {
  const p = new URLSearchParams({ from, to })
  if (categoryId) p.set('categoryId', categoryId)
  if (subCategoryId) p.set('subCategoryId', subCategoryId)
  return `/expenses?${p}`
}
