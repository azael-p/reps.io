vi.mock('../firebase/config', () => ({ db: {}, auth: {} }))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calcular1RM, frecuenciaSemanal } from './Progreso'

const ts = (y, m, d) => {
  const date = new Date(y, m - 1, d)
  return { toDate: () => date, toMillis: () => date.getTime() }
}

// ---------------------------------------------------------------------------

describe('calcular1RM', () => {
  it('calcula el 1RM con la fórmula de Epley', () => {
    expect(calcular1RM(100, 8)).toBe(127) // 100 * (1 + 8/30) = 126.67 → 127
  })

  it('redondea al entero más cercano', () => {
    expect(calcular1RM(80, 10)).toBe(107) // 80 * 1.333 = 106.67 → 107
  })

  it('con reps = 1 devuelve el peso sin modificar (no hay estimación posible)', () => {
    expect(calcular1RM(100, 1)).toBe(100)
  })

  it('con reps = 0 devuelve el peso sin modificar', () => {
    expect(calcular1RM(100, 0)).toBe(100)
  })

  it('con peso = 0 devuelve 0 (falsy short-circuit)', () => {
    expect(calcular1RM(0, 8)).toBe(0)
  })

  it('con peso null/undefined devuelve el valor tal cual', () => {
    expect(calcular1RM(null, 8)).toBeNull()
    expect(calcular1RM(undefined, 8)).toBeUndefined()
  })

  it('con reps negativas devuelve el peso sin modificar', () => {
    expect(calcular1RM(100, -1)).toBe(100)
  })
})

// ---------------------------------------------------------------------------

describe('frecuenciaSemanal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Martes 26 de mayo de 2026 → la semana actual empieza el lunes 25/5
    vi.setSystemTime(new Date(2026, 4, 26, 10, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('devuelve array vacío para sesiones vacías', () => {
    expect(frecuenciaSemanal([])).toEqual([])
  })

  it('ignora sesiones sin fecha', () => {
    expect(frecuenciaSemanal([{ fecha: null }])).toEqual([])
  })

  it('agrupa varias sesiones de la misma semana (lunes a domingo)', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 25) }, // lunes
      { fecha: ts(2026, 5, 27) }, // miércoles
      { fecha: ts(2026, 5, 26) }, // martes
    ]
    const result = frecuenciaSemanal(sesiones)
    expect(result).toHaveLength(1)
    expect(result[0].dias).toBe(3)
  })

  it('etiqueta la semana que contiene "hoy" como "Esta sem."', () => {
    const result = frecuenciaSemanal([{ fecha: ts(2026, 5, 26) }])
    expect(result[0].semana).toBe('Esta sem.')
  })

  it('etiqueta semanas pasadas con el rango de fechas lunes–domingo', () => {
    const result = frecuenciaSemanal([{ fecha: ts(2026, 5, 18) }]) // lunes de la semana anterior
    expect(result[0].semana).not.toBe('Esta sem.')
    expect(result[0].semana).toMatch(/–/)
  })

  it('separa correctamente sesiones de semanas distintas', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 18) }, // semana anterior
      { fecha: ts(2026, 5, 26) }, // semana actual
    ]
    const result = frecuenciaSemanal(sesiones)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.dias)).toEqual([1, 1])
  })

  it('una sesión el domingo cuenta para la semana que termina ese día, no la siguiente', () => {
    // Domingo 31/5 pertenece a la semana que empieza el lunes 25/5 (semana actual)
    const result = frecuenciaSemanal([{ fecha: ts(2026, 5, 31) }])
    expect(result).toHaveLength(1)
    expect(result[0].semana).toBe('Esta sem.')
  })

  it('devuelve como máximo las últimas 8 semanas, ordenadas de más antigua a más reciente', () => {
    // 10 sesiones en 10 semanas distintas, espaciadas 7 días entre sí
    const sesiones = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(2026, 4, 26 - i * 7)
      return { fecha: { toDate: () => d, toMillis: () => d.getTime() } }
    })
    const result = frecuenciaSemanal(sesiones)
    expect(result.length).toBeLessThanOrEqual(8)
    expect(result[result.length - 1].semana).toBe('Esta sem.')
  })

  it('las sesiones sin fecha no rompen el conteo de las que sí la tienen', () => {
    const sesiones = [
      { fecha: null },
      { fecha: ts(2026, 5, 26) },
    ]
    const result = frecuenciaSemanal(sesiones)
    expect(result).toHaveLength(1)
    expect(result[0].dias).toBe(1)
  })
})
