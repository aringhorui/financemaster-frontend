import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { AuthShell } from '../components/Layout'
import { useAction } from '../useAsync'

export default function Login() {
  const { login } = useAuth()
  const { busy, error, run } = useAction()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e) => {
    e.preventDefault()
    run(() => login(email, password))
  }

  return (
    <AuthShell>
        <h1>Sign in</h1>
        <p className="sub">Use your FinanceMaster account.</p>
        <form className="stack" onSubmit={submit}>
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <div className="error">{error}</div>}
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/signup">Create account</Link>
        </div>
    </AuthShell>
  )
}
