import { toDate } from '../../utils/fechas'

export function formatFecha(ts) {
  if (!ts) return ''
  return toDate(ts).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}

export function formatFechaCorta(ts) {
  if (!ts) return ''
  return toDate(ts).toLocaleDateString('es-UY', { day: 'numeric', month: 'numeric' })
}
