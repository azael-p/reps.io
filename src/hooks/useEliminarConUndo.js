import { useCallback } from 'react'
import { useToast } from '../components/Toast'

// Encapsula el patrón repetido en Programas/Dias/EjerciciosDia: soft-delete
// optimista + toast con "Deshacer" (restaura) + borrado definitivo si no se
// deshace a tiempo. `marcar`/`desmarcar`/`eliminarDefinitivo` reciben el id.
export function useEliminarConUndo({ marcar, desmarcar, eliminarDefinitivo }) {
  const { show } = useToast()

  return useCallback(async (item, { mensaje, onOptimista, onRecargar }) => {
    try {
      await marcar(item.id)
    } catch (e) {
      console.error(e)
      show({ message: 'No se pudo eliminar. Intentá de nuevo.', variant: 'error' })
      return
    }
    onOptimista?.()
    show({
      message: mensaje,
      action: {
        label: 'Deshacer',
        onClick: async () => {
          try {
            await desmarcar(item.id)
          } catch (e) {
            console.error(e)
            show({ message: 'No se pudo restaurar. Intentá de nuevo.', variant: 'error' })
          }
          onRecargar?.()
        },
      },
      duration: 5000,
      onTimeout: () => eliminarDefinitivo(item.id),
    })
  }, [marcar, desmarcar, eliminarDefinitivo, show])
}
