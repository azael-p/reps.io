import { describe, it, expect, afterEach, vi } from 'vitest'
import { toDate, tiempoRelativo } from './fechas'

// Miércoles 12 de agosto de 2026, 09:00 local.
const AHORA = new Date(2026, 7, 12, 9, 0, 0)

function enElMomento(fn) {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
  return fn()
}

afterEach(() => vi.useRealTimers())

describe('toDate', () => {
  it('devuelve null sin valor', () => {
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
  })

  it('desenvuelve un Timestamp de Firestore', () => {
    const d = new Date(2026, 7, 10)
    expect(toDate({ toDate: () => d })).toBe(d)
  })

  it('acepta epoch millis y Date', () => {
    const d = new Date(2026, 7, 10)
    expect(toDate(d.getTime()).getTime()).toBe(d.getTime())
    expect(toDate(d).getTime()).toBe(d.getTime())
  })
})

describe('tiempoRelativo — días de calendario, no milisegundos', () => {
  it('sin timestamp devuelve cadena vacía', () => {
    expect(tiempoRelativo(null)).toBe('')
  })

  it('el mismo día, aunque hayan pasado horas, es "hoy"', () => {
    enElMomento(() => {
      expect(tiempoRelativo(new Date(2026, 7, 12, 1, 0))).toBe('hoy')
    })
  })

  it('ayer a la noche es "ayer", no "hoy" (13 h de diferencia)', () => {
    enElMomento(() => {
      expect(tiempoRelativo(new Date(2026, 7, 11, 20, 0))).toBe('ayer')
    })
  })

  it('anteayer temprano es "hace 2 días", no "hace 3"', () => {
    enElMomento(() => {
      expect(tiempoRelativo(new Date(2026, 7, 10, 6, 0))).toBe('hace 2 días')
    })
  })

  it('escalas mayores: semanas y meses', () => {
    enElMomento(() => {
      expect(tiempoRelativo(new Date(2026, 7, 1, 18, 0))).toBe('hace 1 sem')
      expect(tiempoRelativo(new Date(2026, 5, 12, 18, 0))).toBe('hace 2 mes')
    })
  })
})
