import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import styles from './AuthModal.module.css'

// Pasos del flujo de autenticación
const STEP = {
  LOGIN:    'login',
  REGISTER: 'register',
  CONFIRM:  'confirm',
}

export default function AuthModal({ onClose, onSuccess }) {
  const [step, setStep]               = useState(STEP.LOGIN)
  const [pendingEmail, setPendingEmail] = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const { login, register, confirmCode, resendCode } = useAuth()

  const clearError = () => setError('')

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { email, password } = e.target.elements

    try {
      await login({ email: email.value, password: password.value })
      onSuccess?.()
      onClose()
    } catch (err) {
      // Si el usuario existe pero no ha verificado el email, lo llevamos al paso de confirmación
      if (err.message.includes('verificar')) {
        setPendingEmail(email.value)
        setStep(STEP.CONFIRM)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { name, email, phone, password, password2 } = e.target.elements

    if (password.value !== password2.value) {
      setError('Las contraseñas no coinciden.')
      setLoading(false)
      return
    }

    // Cognito requiere mínimo 8 caracteres (configurado en el User Pool)
    if (password.value.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      setLoading(false)
      return
    }

    try {
      await register({
        email:    email.value,
        password: password.value,
        name:     name.value,
        phone:    phone.value,
      })
      setPendingEmail(email.value)
      setStep(STEP.CONFIRM)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { code } = e.target.elements

    try {
      await confirmCode({ email: pendingEmail, code: code.value })
      // Tras verificar, el usuario debe hacer login explícitamente
      setStep(STEP.LOGIN)
      // Usamos el campo de error para mostrar el mensaje de éxito (reutilizamos el estado)
      setTimeout(() => setError('✅ Cuenta verificada. Ya puedes entrar.'), 100)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      await resendCode(pendingEmail)
      setError('Código reenviado. Revisa tu email.')
    } catch (err) {
      setError(err.message)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    // Click fuera del modal (sobre el overlay) lo cierra
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>

        <div className={styles.topDecor}>
          <span className={styles.logoUna}>UÑA</span>
          <span className={styles.logoPezuna}>Pezuña</span>
        </div>

        {/* ── LOGIN ── */}
        {step === STEP.LOGIN && (
          <>
            <h2 className={styles.title}>Bienvenida</h2>
            <p className={styles.subtitle}>Entra para reservar tu cita</p>

            <form onSubmit={handleLogin} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="tu@email.com"
                  onChange={clearError}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  onChange={clearError}
                />
              </div>

              {/* Reutilizamos el mismo elemento para errores y mensajes de éxito (✅) */}
              {error && <p className={`${styles.error} ${error.startsWith('✅') ? styles.success : ''}`}>{error}</p>}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? <span className={styles.spinner} /> : 'ENTRAR'}
              </button>
            </form>

            <p className={styles.switchText}>
              ¿No tienes cuenta?{' '}
              <button onClick={() => { setStep(STEP.REGISTER); clearError() }}>
                Regístrate
              </button>
            </p>
          </>
        )}

        {/* ── REGISTRO ── */}
        {step === STEP.REGISTER && (
          <>
            <h2 className={styles.title}>Crear cuenta</h2>
            <p className={styles.subtitle}>Es rápido y gratuito</p>

            <form onSubmit={handleRegister} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="name">Nombre</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Tu nombre"
                  onChange={clearError}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="tu@email.com"
                  onChange={clearError}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="phone">
                  Teléfono <span className={styles.optional}>(opcional)</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="612 345 678"
                  onChange={clearError}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  onChange={clearError}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password2">Repite la contraseña</label>
                <input
                  id="password2"
                  name="password2"
                  type="password"
                  required
                  placeholder="••••••••"
                  onChange={clearError}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? <span className={styles.spinner} /> : 'CREAR CUENTA'}
              </button>
            </form>

            <p className={styles.switchText}>
              ¿Ya tienes cuenta?{' '}
              <button onClick={() => { setStep(STEP.LOGIN); clearError() }}>
                Entrar
              </button>
            </p>
          </>
        )}

        {/* ── CONFIRMAR EMAIL ── */}
        {step === STEP.CONFIRM && (
          <>
            <h2 className={styles.title}>Verifica tu email</h2>
            <p className={styles.subtitle}>
              Hemos enviado un código a<br />
              <strong>{pendingEmail}</strong>
            </p>

            <form onSubmit={handleConfirm} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="code">Código de verificación</label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  required
                  placeholder="123456"
                  maxLength={6}
                  onChange={clearError}
                  className={styles.codeInput}
                />
              </div>

              {error && <p className={`${styles.error} ${error.startsWith('✅') ? styles.success : ''}`}>{error}</p>}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? <span className={styles.spinner} /> : 'VERIFICAR'}
              </button>
            </form>

            <p className={styles.switchText}>
              ¿No te llegó el código?{' '}
              <button onClick={handleResend}>Reenviar</button>
            </p>
          </>
        )}

      </div>
    </div>
  )
}