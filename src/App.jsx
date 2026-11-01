import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import {
  Activity, ArrowDownToLine, CreditCard, Landmark, LayoutDashboard, LogOut, Monitor, Moon, MoreHorizontal, Receipt, Sun, Tags, Upload,
} from 'lucide-react'
import { AuthProvider, useAuth } from './auth'
import { useTheme } from './theme'
import { TooltipProvider } from './components/Tooltip'
import Chatbot from './components/Chatbot'
import { cycleDates, cycleOf, dayIndex, monthRange, parseIso } from './pages/overview/shared'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Overview from './pages/overview/Overview'
import Expenses from './pages/Expenses'
import Income from './pages/Income'
import Import from './pages/Import'
import Categories from './pages/Categories'
import PaymentMethods from './pages/PaymentMethods'
import BankAccounts from './pages/BankAccounts'

const NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/income', label: 'Income', icon: ArrowDownToLine },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/bank-accounts', label: 'Bank accounts', icon: Landmark },
]
// The phone tab bar shows the first four; the rest live in the More sheet
const PHONE_TABS = NAV.slice(0, 4)
const MORE = [...NAV.slice(4), { to: '/expenses/import', label: 'Import expenses', icon: Upload }]

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Auto', icon: Monitor },
]

function ThemeSwitch({ theme, setTheme }) {
  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {THEMES.map(({ id, label }) => (
        <button key={id} className={theme === id ? 'on' : ''} aria-pressed={theme === id} onClick={() => setTheme(id)}>{label}</button>
      ))}
    </div>
  )
}

function Brand({ sub = true }) {
  return (
    <div className="brand">
      <span className="brand-mark"><Activity /></span>
      <span>
        FinanceMaster
        {sub && <small>Salary-cycle finance</small>}
      </span>
    </div>
  )
}

function ProtectedLayout() {
  const { token, user, loading, logout } = useAuth()
  const [theme, setTheme] = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMoreOpen(false), [location.pathname])

  if (!token) return <Navigate to="/login" replace />
  if (loading) return <div className="center">Loading…</div>

  const nextTheme = THEMES[(THEMES.findIndex((t) => t.id === theme) + 1) % THEMES.length]
  const ThemeIcon = THEMES.find((t) => t.id === theme)?.icon ?? Moon

  return (
    <div className="shell">
      {/* Desktop sidebar; becomes an icon rail on iPad */}
      <aside className="sidebar">
        <Brand />
        <PaydayCard />
        <nav aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} title={n.label}><n.icon size={18} /><span>{n.label}</span></NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          {user && (
            <div className="who">
              {user.firstName} {user.lastName}
              <small>{user.email}</small>
            </div>
          )}
          <ThemeSwitch theme={theme} setTheme={setTheme} />
          <button className="icon-btn rail-only" onClick={() => setTheme(nextTheme.id)} title={`Theme: ${theme}. Switch to ${nextTheme.label}`} aria-label={`Switch theme to ${nextTheme.label}`}>
            <ThemeIcon size={16} />
          </button>
          <button className="small secondary" onClick={logout} title="Sign out">
            <LogOut size={14} className="rail-only" />
            <span className="rail-hide">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="mobile-top">
        <Brand sub={false} />
        <PaydayChip />
        <button className="icon-btn" onClick={() => setTheme(nextTheme.id)} aria-label={`Switch theme to ${nextTheme.label}`}>
          <ThemeIcon size={16} />
        </button>
      </header>

      <main className="content">
        <Outlet />
      </main>

      {/* Phone tab bar */}
      <nav className="bottom-nav" aria-label="Main">
        {PHONE_TABS.map((n) => (
          <NavLink key={n.to} to={n.to}><n.icon size={20} /><span>{n.label}</span></NavLink>
        ))}
        <button className="nav-btn" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}>
          <MoreHorizontal size={20} /><span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="sheet-scrim" onClick={() => setMoreOpen(false)} />
          <div className="more-sheet" role="dialog" aria-label="More">
            <div className="grabber" />
            {MORE.map((n) => (
              <NavLink key={n.to} to={n.to}><n.icon size={18} />{n.label}</NavLink>
            ))}
            <ThemeSwitch theme={theme} setTheme={setTheme} />
            {user && <div className="who">Signed in as {user.email}</div>}
            <button className="sheet-item" onClick={logout}><LogOut size={18} />Sign out</button>
          </div>
        </>
      )}

      <Chatbot />
    </div>
  )
}

function usePayday() {
  const cycle = cycleOf()
  const { from, to, days } = monthRange(cycle)
  const payday = parseIso(to)
  payday.setDate(payday.getDate() + 1)
  const elapsed = dayIndex(from) + 1
  return { cycle, days, payday, elapsed, left: days - elapsed + 1 }
}

function PaydayCard() {
  const { cycle, days, payday, elapsed, left } = usePayday()
  return (
    <div className="payday" title={`Salary cycle ${cycleDates(cycle)}`}>
      <div className="payday-top">
        <span>{left <= 1 ? 'Payday tomorrow' : `Payday in ${left} days`}</span>
        <small>{payday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>
      </div>
      <div className="payday-bar" role="img" aria-label={`Day ${elapsed} of ${days} in this salary cycle`}>
        <span style={{ width: `${(elapsed / days) * 100}%` }} />
      </div>
      <small>Day {elapsed} of {days} · {cycleDates(cycle)}</small>
    </div>
  )
}

function PaydayChip() {
  const { left } = usePayday()
  return <span className="payday-chip">{left <= 1 ? 'Payday tomorrow' : `Payday in ${left}d`}</span>
}

function PublicOnly({ children }) {
  const { token } = useAuth()
  return token ? <Navigate to="/overview" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
            <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
            <Route element={<ProtectedLayout />}>
              <Route path="/overview" element={<Overview />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/expenses/import" element={<Import />} />
              <Route path="/income" element={<Income />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/payment-methods" element={<PaymentMethods />} />
              <Route path="/bank-accounts" element={<BankAccounts />} />
            </Route>
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  )
}
