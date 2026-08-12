// Cálculos puros de estadísticas de entrenamiento (sin React ni Firestore).
import { toDate } from './fechas'

export function calcular1RM(peso, reps) {
  if (!peso || !reps || reps <= 1) return peso
  return Math.round(peso * (1 + reps / 30))
}

// Rachas (actual y máxima) a partir de epochs de días entrenados (00:00 local).
export function calcularStreaks(epochsDias) {
  if (!epochsDias || epochsDias.length === 0) return { actual: 0, maxima: 0 }

  const unicas = [...new Set(epochsDias)].sort((a, b) => b - a).map(t => new Date(t))

  let actual = 1
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diffHoy = Math.round((hoy - unicas[0]) / 86400000)
  if (diffHoy > 1) {
    actual = 0
  } else {
    for (let i = 1; i < unicas.length; i++) {
      const diff = Math.round((unicas[i - 1] - unicas[i]) / 86400000)
      if (diff === 1) actual++
      else break
    }
  }

  let maxima = 1
  let temp = 1
  for (let i = 1; i < unicas.length; i++) {
    const diff = Math.round((unicas[i - 1] - unicas[i]) / 86400000)
    if (diff === 1) { temp++; if (temp > maxima) maxima = temp }
    else { temp = 1 }
  }

  return { actual, maxima }
}

export function frecuenciaSemanal(sesiones) {
  const semanas = {}
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const lunesHoy = new Date(hoy)
  lunesHoy.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))

  for (const s of sesiones) {
    if (!s.fecha) continue
    const d = toDate(s.fecha)
    const lunes = new Date(d)
    lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    lunes.setHours(0, 0, 0, 0)
    const key = lunes.getTime()
    if (!semanas[key]) semanas[key] = { fecha: lunes, dias: 0 }
    semanas[key].dias += 1
  }
  return Object.values(semanas)
    .sort((a, b) => a.fecha - b.fecha)
    .map(({ fecha, dias }) => {
      const esActual = fecha.getTime() === lunesHoy.getTime()
      const domingo = new Date(fecha); domingo.setDate(fecha.getDate() + 6)
      const fmtDia = d => d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' }).replace('.', '')
      const semana = esActual ? 'Esta sem.' : `${fmtDia(fecha)}–${fmtDia(domingo)}`
      return { semana, dias }
    })
    .slice(-8)
}
