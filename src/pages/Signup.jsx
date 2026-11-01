import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { AuthShell } from '../components/Layout'
import { useAction } from '../useAsync'

export default function Signup() {
  const { saveToken } = useAuth()
  const { busy, error, run } = useAction()
  const [step, setStep] = useState('details')
  const [info, setInfo] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [otp, setOtp] = useState('')

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const initiate = (e) => {
    e.preventDefault()
    run(async () => {
      const res = await api.auth.signupInitiate(form)
      setInfo(res.message)
      setStep('otp')
    })
  }

  const verify = (e) => {
    e.preventDefault()
    run(async () => {
      const res = await api.auth.signupVerify(form.email, otp)
      saveToken(res.token)
    })
  }

  const resend = () =>
    run(async () => {
      const res = await api.auth.signupResend(form.email)
      setInfo(res.message)
    })

  return (
    <AuthShell>
        <h1>Create your account</h1>
        {step === 'details' ? (
          <>
            <p className="sub">We'll email you a 6-digit code to verify your address.</p>
            <form className="stack" onSubmit={initiate}>
              <label>First name<input required value={form.firstName} onChange={set('firstName')} /></label>
              <label>Last name<input required value={form.lastName} onChange={set('lastName')} /></label>
              <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
              <label>Password<input type="password" required minLength={6} value={form.password} onChange={set('password')} /></label>
              {error && <div className="error">{error}</div>}
              <button disabled={busy}>{busy ? 'Sending code…' : 'Continue'}</button>
            </form>
          </>
        ) : (
          <>
            <p className="sub">Enter the code sent to {form.email}</p>
            <form className="stack" onSubmit={verify}>
              <label>OTP<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} /></label>
              {info && <div className="success">{info}</div>}
              {error && <div className="error">{error}</div>}
              <button disabled={busy}>{busy ? 'Verifying…' : 'Verify & sign up'}</button>
              <button type="button" className="secondary" disabled={busy} onClick={resend}>Resend code</button>
            </form>
          </>
        )}
        <div className="auth-links">
          <span className="muted">Have an account?</span>
          <Link to="/login">Sign in</Link>
        </div>
    </AuthShell>
  )
}
