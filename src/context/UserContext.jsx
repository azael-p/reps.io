import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { handleFirstLogin, signOutUser } from '../firebase/auth'
import { limpiarEliminadosDefinitivamente } from '../firebase/limpieza'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUsuario(null)
        setLoading(false)
        return
      }

      try {
        const { usuario } = await handleFirstLogin(firebaseUser)
        setUsuario(usuario)
        limpiarEliminadosDefinitivamente(usuario.id).catch(e => console.error('limpieza de eliminados falló:', e))
      } catch (e) {
        console.error('handleFirstLogin falló:', e)
        setUsuario(null)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  async function logout() {
    await signOutUser()
    setUsuario(null)
  }

  const value = useMemo(() => ({ usuario, loading, logout }), [usuario, loading])
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  return useContext(UserContext)
}
