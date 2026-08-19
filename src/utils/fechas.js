// Normaliza fechas que pueden venir como Timestamp de Firestore,
// Date, string o número de época. Devuelve null si no hay valor.
export function toDate(x) {
  if (!x) return null
  return typeof x.toDate === 'function' ? x.toDate() : new Date(x)
}

// "hoy" / "ayer" / "hace N días" / "hace N sem" / "hace N mes".
export function tiempoRelativo(timestamp) {
  if (!timestamp) return ''
  const fecha = toDate(timestamp)
  const dias = Math.floor((Date.now() - fecha.getTime()) / 86400000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem`
  return `hace ${Math.floor(dias / 30)} mes`
}
