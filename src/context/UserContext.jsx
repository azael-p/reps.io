import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { handleFirstLogin, signOutUser } from '../firebase/auth'

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
      } catch {
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

  return (
    <UserContext.Provider value={{ usuario, loading, logout }}>
      {children}
    </UserContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  return useContext(UserContext)
}
