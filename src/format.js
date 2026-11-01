const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const moneyRound = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export const fmt = (n) => money.format(n ?? 0)
export const fmt0 = (n) => moneyRound.format(n ?? 0)

// Backend expects "yyyy-MM-dd'T'HH:mm:ss"; <input type="datetime-local"> gives "yyyy-MM-ddTHH:mm"
export const toBackendDateTime = (local) => (local.length === 16 ? `${local}:00` : local)
export const toLocalInput = (iso) => (iso ? iso.slice(0, 16) : '')

export const nowLocalInput = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

// One fixed colour per category so it reads the same on every screen.
// Orange-first palette from the reference dashboard; savings stay green because kept money is good news.
const DEFAULT_COLORS = { Needs: '#f97316', Wants: '#fbbf24', 'Investment/Savings': '#22c55e' }
const EXTRA_COLORS = ['#fb7185', '#38bdf8', '#a78bfa', '#2dd4bf', '#fdba74']

export const categoryColor = (name = '') => {
  if (DEFAULT_COLORS[name]) return DEFAULT_COLORS[name]
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return EXTRA_COLORS[h % EXTRA_COLORS.length]
}
