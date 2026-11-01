import { useEffect } from 'react'
import { Activity } from 'lucide-react'

const icon = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

// eslint-disable-next-line react-refresh/only-export-components
export const Icons = {
  overview: icon(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
  income: icon(<><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /><path d="M4 21h16" /></>),
  expenses: icon(<><path d="M4 5h16v14H4z" /><path d="M4 10h16" /><path d="M8 15h3" /></>),
  categories: icon(<><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></>),
  payments: icon(<><circle cx="12" cy="12" r="8" /><path d="M9.5 9.5c.4-1 1.3-1.5 2.5-1.5 1.5 0 2.5.8 2.5 1.8 0 2.2-5 1.4-5 3.9 0 1 1 1.8 2.5 1.8 1.2 0 2.1-.5 2.5-1.5" /></>),
  banks: icon(<><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 20h18" /></>),
  logo: icon(<><path d="M4 18l5-6 4 3 7-9" /><path d="M15 6h5v5" /></>),
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Drawer({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="secondary small" onClick={onClose}>Close</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  )
}

export function AuthShell({ children }) {
  return (
    <div className="auth">
      <div className="auth-brand">
        <div className="brand">
          <span className="brand-mark"><Activity /></span>
          FinanceMaster
        </div>
        <div>
          <h2>Every expense, against its budget.</h2>
          <p>Record spending by category, payment method and account, and see where each budget stands.</p>
        </div>
        <span className="muted" style={{ color: 'var(--ink-text)' }}>Your data stays tied to your account.</span>
      </div>
      <div className="auth-panel">
        <div className="auth-form">{children}</div>
      </div>
    </div>
  )
}
