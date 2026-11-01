import { useCallback, useState } from 'react'

// Wraps an async action with busy/error state so pages don't repeat try/catch boilerplate.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async (fn) => {
    setBusy(true)
    setError('')
    try {
      return await fn()
    } catch (e) {
      setError(e.message)
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, setError, run }
}
