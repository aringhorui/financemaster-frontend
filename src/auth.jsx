import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setUser(null)
  }, [])

  const saveToken = useCallback((newToken) => {
    setToken(newToken)
    setTokenState(newToken)
  }, [])

  useEffect(() => {
    const onLogout = () => logout()
    window.addEventListener('fm:logout', onLogout)
    return () => window.removeEventListener('fm:logout', onLogout)
  }, [logout])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.auth
      .me()
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false))
  }, [token, logout])

  const login = async (email, password) => {
    const res = await api.auth.login(email, password)
    saveToken(res.token)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, saveToken }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
