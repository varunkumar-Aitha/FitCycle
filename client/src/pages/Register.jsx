import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

// ─── Step 1: Registration form ───────────────
const RegistrationForm = ({ onOtpSent }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match')
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters')
    }

    setLoading(true)
    try {
      await authService.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password
      })
      onOtpSent({ name: form.name.trim(), email: form.email.trim().toLowerCase() })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Create Account</h2>
      <p className="auth-subtitle">Begin your fitness journey today</p>

      <div className="form-group">
        <label htmlFor="name">Full Name</label>
        <input
          id="name" type="text" name="name"
          value={form.name} onChange={handleChange}
          placeholder="John Doe" required autoComplete="name"
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email" type="email" name="email"
          value={form.email} onChange={handleChange}
          placeholder="you@example.com" required autoComplete="email"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password" type="password" name="password"
          value={form.password} onChange={handleChange}
          placeholder="Min. 6 characters" required autoComplete="new-password"
        />
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword" type="password" name="confirmPassword"
          value={form.confirmPassword} onChange={handleChange}
          placeholder="Repeat password" required autoComplete="new-password"
        />
      </div>

      <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
        {loading ? (
          <span className="btn-loading">
            <span className="btn-spinner" /> Sending OTP...
          </span>
        ) : 'Send Verification Code'}
      </button>

      <p className="auth-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </form>
  )
}

// ─── Step 2: OTP verification ─────────────────
const OTP_LENGTH = 6

const OtpForm = ({ email, name, onVerified }) => {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60) // seconds until resend allowed
  const inputRefs = useRef([])
  const toast = useToast()

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleDigitChange = (index, value) => {
    // Only accept a single digit
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)

    // Auto-advance
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all filled
    if (digit && index === OTP_LENGTH - 1) {
      const allFilled = next.every(d => d !== '')
      if (allFilled) submitOtp(next.join(''))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        // Clear current
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        // Go back
        inputRefs.current[index - 1]?.focus()
        const next = [...digits]
        next[index - 1] = ''
        setDigits(next)
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  // Handle paste (e.g. paste "123456" from clipboard)
  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setDigits(next)
    const lastFilledIdx = Math.min(pasted.length - 1, OTP_LENGTH - 1)
    inputRefs.current[lastFilledIdx]?.focus()
    if (pasted.length === OTP_LENGTH) submitOtp(pasted)
  }

  const submitOtp = async (otp) => {
    setLoading(true)
    try {
      const res = await authService.verifyOtp({ email, otp })
      onVerified(res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed. Please try again.')
      // Clear inputs on error
      setDigits(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const otp = digits.join('')
    if (otp.length < OTP_LENGTH) {
      return toast.error('Please enter all 6 digits')
    }
    submitOtp(otp)
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setResending(true)
    try {
      await authService.resendOtp({ email })
      toast.success('A new OTP has been sent to your email.')
      setCountdown(60)
      setDigits(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP.')
    } finally {
      setResending(false)
    }
  }

  const maskedEmail = email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + '*'.repeat(b.length))

  return (
    <form onSubmit={handleSubmit} className="auth-form otp-form">
      <div className="otp-header">
        <div className="otp-icon-circle">📧</div>
        <h2>Verify Your Email</h2>
        <p className="auth-subtitle">
          We sent a 6-digit code to<br />
          <strong className="otp-email">{maskedEmail}</strong>
        </p>
      </div>

      {/* OTP digit inputs */}
      <div className="otp-inputs" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={el => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={digit}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`otp-digit ${digit ? 'otp-digit-filled' : ''}`}
            disabled={loading}
            autoComplete="one-time-code"
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-full"
        disabled={loading || digits.join('').length < OTP_LENGTH}
      >
        {loading ? (
          <span className="btn-loading">
            <span className="btn-spinner" /> Verifying...
          </span>
        ) : 'Verify & Create Account'}
      </button>

      {/* Resend row */}
      <div className="otp-resend-row">
        <span className="otp-resend-text">Didn't receive the code?</span>
        {countdown > 0 ? (
          <span className="otp-countdown">Resend in {countdown}s</span>
        ) : (
          <button
            type="button"
            className="otp-resend-btn"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? 'Sending...' : 'Resend OTP'}
          </button>
        )}
      </div>

      <div className="otp-expiry-note">Code expires in 15 minutes</div>

      {/* Back link */}
      <p className="auth-link" style={{ marginTop: '12px' }}>
        Wrong email? <Link to="/register" onClick={() => window.location.reload()}>Go back</Link>
      </p>
    </form>
  )
}

// ─── Root component ───────────────────────────
const Register = () => {
  const [step, setStep] = useState('form') // 'form' | 'otp'
  const [userData, setUserData] = useState(null)
  const { updateUser } = useAuth()
  const navigate = useNavigate()

  const handleOtpSent = ({ name, email }) => {
    setUserData({ name, email })
    setStep('otp')
  }

  const handleVerified = (data) => {
    // verifyOtp returns { token, user } — store token, hydrate context, navigate cleanly
    localStorage.setItem('token', data.token)
    updateUser(data.user)
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="FitCycle" className="auth-logo-img" />
          <h1>FitCycle</h1>
          <p>Start your 3-month transformation</p>
        </div>

        {/* Step indicator */}
        <div className="auth-steps">
          <div className={`auth-step ${step === 'form' ? 'auth-step-active' : 'auth-step-done'}`}>
            <div className="auth-step-dot">{step === 'otp' ? '✓' : '1'}</div>
            <span>Details</span>
          </div>
          <div className="auth-step-line" />
          <div className={`auth-step ${step === 'otp' ? 'auth-step-active' : ''}`}>
            <div className="auth-step-dot">2</div>
            <span>Verify</span>
          </div>
        </div>

        {step === 'form' && <RegistrationForm onOtpSent={handleOtpSent} />}
        {step === 'otp' && (
          <OtpForm
            email={userData.email}
            name={userData.name}
            onVerified={handleVerified}
          />
        )}
      </div>
    </div>
  )
}

export default Register
