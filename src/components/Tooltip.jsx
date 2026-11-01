import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const TooltipContext = createContext(null)

/** One floating tooltip for the whole app; charts call show(event, content) on hover. */
export function TooltipProvider({ children }) {
  const [tip, setTip] = useState(null)

  const show = useCallback((e, content) => setTip({ x: e.clientX, y: e.clientY, content }), [])
  const move = useCallback((e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t)), [])
  const hide = useCallback(() => setTip(null), [])
  const value = useMemo(() => ({ show, move, hide }), [show, move, hide])

  const flipX = tip && tip.x > window.innerWidth - 280
  const flipY = tip && tip.y > window.innerHeight - 200

  return (
    <TooltipContext.Provider value={value}>
      {children}
      {tip && (
        <div
          className="tooltip"
          role="tooltip"
          style={{
            left: tip.x + (flipX ? -14 : 14),
            top: tip.y + (flipY ? -14 : 14),
            transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
          }}
        >
          {tip.content}
        </div>
      )}
    </TooltipContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTooltip = () => useContext(TooltipContext)

/** Standard tooltip body: a title, optional rows of colour / label / value, and an optional hint. */
export function Tip({ title, rows = [], hint }) {
  return (
    <>
      <div className="tip-title">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className={`tip-row${r.strong ? ' strong' : ''}`}>
          {r.color && <i style={{ background: r.color }} />}
          <span>{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
      {hint && <div className="tip-hint">{hint}</div>}
    </>
  )
}

/**
 * Props for an SVG/HTML element that shows a tooltip on hover and runs onClick on click or Enter.
 * Usage: <rect {...hoverable(tooltip, () => <Tip .../>, () => navigate(...))} />
 */
// eslint-disable-next-line react-refresh/only-export-components
export const hoverable = (tooltip, content, onClick) => ({
  onMouseEnter: (e) => tooltip.show(e, content()),
  onMouseMove: tooltip.move,
  onMouseLeave: tooltip.hide,
  ...(onClick
    ? {
        onClick: () => {
          tooltip.hide()
          onClick()
        },
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            tooltip.hide()
            onClick()
          }
        },
        tabIndex: 0,
        role: 'button',
      }
    : {}),
})
