import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { crearSesion } from '../firebase/sesiones'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/Toast'

// Encapsula crear la sesión + puntero en localStorage + navegar, sin esperar
// el ACK del servidor (con persistentLocalCache el id ya es usable de
// inmediato). Un fallo eventual se avisa por toast, sin bloquear la
// navegación. Compartido entre Entrenar.jsx y el atajo de Home.jsx.
export function useIniciarSesion() {
  const navigate = useNavigate()
  const { show } = useToast()
  const { usuario } = useUser()

  return useCallback((diaId) => {
    const { id: sesionId, listo } = crearSesion(usuario.id, diaId)
    localStorage.setItem(`sesion_activa_${usuario.id}`, sesionId)
    listo.catch(e => {
      console.error(e)
      show({ message: 'La sesión se guardará cuando vuelva la conexión.', variant: 'warning' })
    })
    navigate(`/sesion/${sesionId}`)
  }, [usuario, navigate, show])
}
