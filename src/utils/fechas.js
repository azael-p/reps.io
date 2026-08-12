// Normaliza fechas que pueden venir como Timestamp de Firestore,
// Date, string o número de época. Devuelve null si no hay valor.
export function toDate(x) {
  if (!x) return null
  return typeof x.toDate === 'function' ? x.toDate() : new Date(x)
}
