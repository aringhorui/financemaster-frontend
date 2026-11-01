import { useEffect, useRef, useState } from 'react'

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Counts up to a number when it changes; non-numeric values render as-is. */
export function CountUp({ value, format }) {
  const [shown, setShown] = useState(() => (typeof value === 'number' && !reduceMotion() ? 0 : value))
  const prev = useRef(typeof value === 'number' ? 0 : value)

  useEffect(() => {
    if (typeof value !== 'number' || reduceMotion()) {
      setShown(value)
      prev.current = value
      return undefined
    }
    const from = typeof prev.current === 'number' ? prev.current : 0
    prev.current = value
    const start = performance.now()
    let frame
    const step = (now) => {
      const t = Math.min((now - start) / 600, 1)
      setShown(from + (value - from) * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return typeof shown === 'number' && format ? format(shown) : shown
}

export function KPICard({ label, value, format, context, contextTone, icon: Icon, color = 'var(--accent)', title }) {
  return (
    <div className="card kpi" style={{ '--kc': color }} title={title}>
      <span className="kpi-bar" aria-hidden="true" />
      <div className="kpi-body">
        <div className="kpi-top">
          <span className="kpi-label">{label}</span>
          {Icon && <span className="kpi-icon" aria-hidden="true"><Icon size={14} /></span>}
        </div>
        <div className="kpi-value"><CountUp value={value} format={format} /></div>
        {context && <div className={`kpi-context${contextTone ? ` ${contextTone}` : ''}`}>{context}</div>}
      </div>
    </div>
  )
}
