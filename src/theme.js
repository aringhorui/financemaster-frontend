import { useEffect, useState } from 'react'

// Theme preference: 'light', 'dark' or 'system'. The resolved theme is set as data-theme on <html>;
// index.html applies it before React loads so the page doesn't flash.
const KEY = 'fm_theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

const read = () => {
  try {
    return localStorage.getItem(KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

const apply = (pref) => {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function useTheme() {
  const [pref, setPref] = useState(read)

  useEffect(() => {
    apply(pref)
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      // storage unavailable; the choice still applies for this visit
    }
    if (pref !== 'system') return undefined
    const onChange = () => apply('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [pref])

  return [pref, setPref]
}
