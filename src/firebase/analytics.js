import { getAnalytics, logEvent } from 'firebase/analytics'
import { app } from './config'

let analytics = null
try {
  analytics = getAnalytics(app)
} catch {
  // measurementId no configurado — analytics desactivado
}

// Normaliza rutas dinámicas para evitar alta cardinalidad en GA
function normalizarRuta(pathname) {
  return pathname
    .replace(/\/programas\/[^/]+\/[^/]+/, '/programas/:programaId/:diaId')
    .replace(/\/programas\/[^/]+/, '/programas/:programaId')
    .replace(/\/sesion\/[^/]+\/resumen/, '/sesion/:sesionId/resumen')
    .replace(/\/sesion\/[^/]+/, '/sesion/:sesionId')
}

export function logPaginaVista(pathname) {
  if (!analytics) return
  logEvent(analytics, 'page_view', { page_path: normalizarRuta(pathname) })
}

export function logEvento(nombre, params = {}) {
  if (!analytics) return
  logEvent(analytics, nombre, params)
}
