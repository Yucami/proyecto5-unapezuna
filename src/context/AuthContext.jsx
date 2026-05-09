import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'

// ─── Configuración Cognito ───────────────────────────────────────────────────
// Los valores vienen de .env.local (NUNCA hardcodear IDs de Cognito en producción)
const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
}

const userPool = new CognitoUserPool(poolData)

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)   // usuario autenticado
  const [isAdmin, setIsAdmin] = useState(false)  // pertenece al grupo Admins de Cognito
  const [loading, setLoading] = useState(true)
  const cognitoUserRef = useRef(null)
  // Comprueba si hay sesión activa al cargar la app
  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser()
    if (!cognitoUser) {
      setLoading(false)
      return
    }

    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        setLoading(false)
        return
      }
      cognitoUserRef.current = cognitoUser


      // Leemos email, nombre y grupos desde el payload del ID token
      const payload = session.getIdToken().decodePayload()
      const groups = payload['cognito:groups'] || []

      setUser({
        email: payload.email,
        name: payload.name || payload.email,
        sub: payload.sub,
        token: session.getIdToken().getJwtToken(),
      })
      setIsAdmin(groups.includes('Admins'))
      setLoading(false)
    })
  }, [])

  // ─── Registro ──────────────────────────────────────────────────────────────
  // Crea el usuario en Cognito. Devuelve { needsConfirmation: true } → el usuario
  // debe verificar su email antes de poder hacer login
  const register = ({ email, password, name, phone }) => {
    return new Promise((resolve, reject) => {
      const attributes = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'name', Value: name }),
      ]

      if (phone) {
        // Cognito requiere formato E.164 (+34612345678)
        const formatted = phone.startsWith('+') ? phone : `+34${phone.replace(/\s/g, '')}`
        attributes.push(new CognitoUserAttribute({ Name: 'phone_number', Value: formatted }))
      }

      userPool.signUp(email, password, attributes, null, (err, result) => {
        if (err) { reject(translateError(err)); return }
        resolve({ needsConfirmation: true, email })
      })
    })
  }

  // ─── Confirmar código de verificación ──────────────────────────────────────
  // Cognito envía un código de 6 dígitos al email del usuario tras el registro
  const confirmCode = ({ email, code }) => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) { reject(translateError(err)); return }
        resolve()
      })
    })
  }

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = ({ email, password }) => {
    return new Promise((resolve, reject) => {
      const authDetails = new AuthenticationDetails({ Username: email, Password: password })
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          cognitoUserRef.current = cognitoUser
          const payload = session.getIdToken().decodePayload()
          const groups = payload['cognito:groups'] || []

          const userData = {
            email: payload.email,
            name: payload.name || payload.email,
            sub: payload.sub,
            token: session.getIdToken().getJwtToken(),
          }

          setUser(userData)
          setIsAdmin(groups.includes('Admins'))
          resolve(userData)
        },
        onFailure: (err) => reject(translateError(err)),
      })
    })
  }

  // ─── Obtener token fresco ───────────────────────────────────────────────────
  // Cognito refresca el token automáticamente si ha caducado. Siempre usar esto
  // en lugar de user.token para evitar 401s en sesiones largas.
  const getToken = () => {
    return new Promise((resolve, reject) => {
      const cognitoUser = cognitoUserRef.current
      if (!cognitoUser) { reject(new Error('Sin sesión')); return }
      cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) { reject(new Error('Sesión inválida')); return }
        resolve(session.getIdToken().getJwtToken())
      })
    })
  }

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    const cognitoUser = userPool.getCurrentUser()
    if (cognitoUser) cognitoUser.signOut()
    cognitoUserRef.current = null
    setUser(null)
    setIsAdmin(false)
  }

  // ─── Reenviar código de verificación ───────────────────────────────────────
  const resendCode = (email) => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })
      cognitoUser.resendConfirmationCode((err) => {
        if (err) { reject(translateError(err)); return }
        resolve()
      })
    })
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout, register, confirmCode, resendCode, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para consumir el contexto desde cualquier componente
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

// ─── Traducción de errores de Cognito al español ─────────────────────────────
function translateError(err) {
  const map = {
    'User already exists': 'Ya existe una cuenta con ese email.',
    'UsernameExistsException': 'Ya existe una cuenta con ese email.',
    'InvalidPasswordException': 'La contraseña no cumple los requisitos mínimos.',
    'NotAuthorizedException': 'Email o contraseña incorrectos.',
    'UserNotFoundException': 'No existe ninguna cuenta con ese email.',
    'CodeMismatchException': 'El código de verificación es incorrecto.',
    'ExpiredCodeException': 'El código ha caducado. Solicita uno nuevo.',
    'LimitExceededException': 'Demasiados intentos. Espera unos minutos.',
    'InvalidParameterException': 'Revisa los datos introducidos.',
    'UserNotConfirmedException': 'Debes verificar tu email antes de entrar.',
  }

  const message = map[err.code] || map[err.message] || err.message || 'Error desconocido.'
  return new Error(message)
}