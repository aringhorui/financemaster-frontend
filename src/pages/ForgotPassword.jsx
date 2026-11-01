import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { AuthShell } from '../components/Layout'
import { useAction } from '../useAsync'

export default function ForgotPassword() {
  const { busy, error, run } = useAction()
  const [step, setStep] = useState('email')
  const [info, setInfo] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')

  const sendOtp = (e) => {
    e.preventDefault()
    run(async () => {
      const res = await api.auth.forgotPassword(email)
      setInfo(res.message)
      setStep('otp')
    })
  }

  const verifyOtp = (e) => {
    e.preventDefault()
    run(async () => {
      const res = await api.auth.forgotVerify(email, otp)
      setInfo(res.message)
      setStep('reset')
    })
  }

  const reset = (e) => {
    e.preventDefault()
    run(async () => {
      await api.auth.resetPassword(email, password)
      setInfo('Password reset. You can sign in now.')
      setStep('done')
    })
  }

  return (
    <AuthShell>
        <h1>Reset password</h1>
        {step === 'email' && (
          <form className="stack" onSubmit={sendOtp}>
            <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {error && <div className="error">{error}</div>}
            <button disabled={busy}>Send code</button>
          </form>
        )}
        {step === 'otp' && (
          <form className="stack" onSubmit={verifyOtp}>
            <label>OTP<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} /></label>
            {info && <div className="success">{info}</div>}
            {error && <div className="error">{error}</div>}
            <button disabled={busy}>Verify code</button>
          </form>
        )}
        {step === 'reset' && (
          <form className="stack" onSubmit={reset}>
            <label>New password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {info && <div className="success">{info}</div>}
            {error && <div className="error">{error}</div>}
            <button disabled={busy}>Reset password</button>
          </form>
        )}
        {step === 'done' && <div className="success">{info}</div>}
        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
    </AuthShell>
  )
}
