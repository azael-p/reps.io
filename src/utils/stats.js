// Cálculos puros de estadísticas de entrenamiento (sin React ni Firestore).
import { toDate } from './fechas'

// Acepta coma decimal: en teclados es-UY es lo que sale naturalmente, y
// Number('78,5') es NaN.
export function parsePeso(input) {
  return Number(String(input).replace(',', '.'))
}

// Lo que se deja tipear en un campo de peso. Los campos usan type="text" en vez
// de type="number" justamente para no perder la coma: con type="number" el
// navegador descarta "82," y el estado queda vacío, así que la serie terminaba
// guardándose con 0 kg sin ningún aviso. Acá filtramos a mano: dígitos y un
// solo separador decimal.
export function sanitizarPeso(input) {
  const limpio = String(input).replace(/[^\d.,]/g, '')
  const partes = limpio.split(/[.,]/)
  if (partes.length <= 1) return limpio
  const separador = limpio.match(/[.,]/)[0]
  return `${partes[0]}${separador}${partes.slice(1).join('')}`
}

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

const lunesDeSemana = (d) => {
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

// Últimas 8 semanas (lunes a domingo) contiguas hasta la actual, sin saltos
// aunque haya semanas sin entrenar. Cuenta días únicos, no sesiones: dos
// sesiones el mismo día suman 1 solo día.
export function frecuenciaSemanal(sesiones) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const lunesHoy = lunesDeSemana(hoy)

  const diasUnicos = new Set()
  for (const s of sesiones) {
    if (!s.fecha) continue
    const d = toDate(s.fecha)
    diasUnicos.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
  }

  const diasPorSemana = {}
  for (const epoch of diasUnicos) {
    const key = lunesDeSemana(new Date(epoch)).getTime()
    diasPorSemana[key] = (diasPorSemana[key] ?? 0) + 1
  }

  const fmtDia = d => d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' }).replace('.', '')
  const semanas = []
  for (let i = 7; i >= 0; i--) {
    const lunes = new Date(lunesHoy)
    lunes.setDate(lunesHoy.getDate() - i * 7)
    const esActual = i === 0
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
    const semana = esActual ? 'Esta sem.' : `${fmtDia(lunes)}–${fmtDia(domingo)}`
    semanas.push({ semana, dias: diasPorSemana[lunes.getTime()] ?? 0 })
  }
  return semanas
}
