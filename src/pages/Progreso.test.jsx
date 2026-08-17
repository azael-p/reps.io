vi.mock('../firebase/config', () => ({ db: {}, auth: {} }))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calcular1RM, frecuenciaSemanal, parsePeso } from '../utils/stats'

const ts = (y, m, d) => {
  const date = new Date(y, m - 1, d)
  return { toDate: () => date, toMillis: () => date.getTime() }
}

// ---------------------------------------------------------------------------

describe('parsePeso', () => {
  it('acepta punto decimal', () => {
    expect(parsePeso('78.5')).toBe(78.5)
  })

  it('acepta coma decimal (lo que sale del teclado es-UY)', () => {
    expect(parsePeso('78,5')).toBe(78.5)
  })

  it('acepta enteros', () => {
    expect(parsePeso('78')).toBe(78)
  })

  it('devuelve NaN para texto no numérico', () => {
    expect(parsePeso('abc')).toBeNaN()
  })
})

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
    // Martes 26 de mayo de 2026 → la semana actual empieza el lunes 25/5,
    // así que siempre es el índice 7 (el último) del array de 8 semanas.
    vi.setSystemTime(new Date(2026, 4, 26, 10, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('siempre devuelve 8 semanas contiguas, incluso sin sesiones', () => {
    const result = frecuenciaSemanal([])
    expect(result).toHaveLength(8)
    expect(result.every(w => w.dias === 0)).toBe(true)
    expect(result[7].semana).toBe('Esta sem.')
  })

  it('ignora sesiones sin fecha', () => {
    const result = frecuenciaSemanal([{ fecha: null }])
    expect(result).toHaveLength(8)
    expect(result.every(w => w.dias === 0)).toBe(true)
  })

  it('agrupa varias sesiones de la misma semana (lunes a domingo)', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 25) }, // lunes
      { fecha: ts(2026, 5, 27) }, // miércoles
      { fecha: ts(2026, 5, 26) }, // martes
    ]
    const result = frecuenciaSemanal(sesiones)
    expect(result[7].dias).toBe(3)
    expect(result.slice(0, 7).every(w => w.dias === 0)).toBe(true)
  })

  it('dos sesiones el mismo día cuentan como 1 solo día, no 2', () => {
    const result = frecuenciaSemanal([{ fecha: ts(2026, 5, 26) }, { fecha: ts(2026, 5, 26) }])
    expect(result[7].dias).toBe(1)
  })

  it('etiqueta la semana que contiene "hoy" como "Esta sem."', () => {
    const result = frecuenciaSemanal([{ fecha: ts(2026, 5, 26) }])
    expect(result[7].semana).toBe('Esta sem.')
  })

  it('etiqueta semanas pasadas con el rango de fechas lunes–domingo', () => {
    const result = frecuenciaSemanal([{ fecha: ts(2026, 5, 18) }]) // lunes de la semana anterior
    expect(result[6].semana).not.toBe('Esta sem.')
    expect(result[6].semana).toMatch(/–/)
    expect(result[6].dias).toBe(1)
  })

  it('separa sesiones de semanas distintas, dejando en 0 las semanas intermedias sin entrenar', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 4) },  // lunes de hace 3 semanas
      { fecha: ts(2026, 5, 26) }, // semana actual
    ]
    const result = frecuenciaSemanal(sesiones)
    expect(result).toHaveLength(8)
    expect(result[4].dias).toBe(1) // semana del 4/5
    expect(result[7].dias).toBe(1) // semana actual
    expect(result[5].dias).toBe(0) // semanas intermedias, antes "pegadas" al no rellenarse
    expect(result[6].dias).toBe(0)
  })

  it('una sesión el domingo cuenta para la semana que termina ese día, no la siguiente', () => {
    // Domingo 31/5 pertenece a la semana que empieza el lunes 25/5 (semana actual)
    const result = frecuenciaSemanal([{ fecha: ts(2026, 5, 31) }])
    expect(result[7].semana).toBe('Esta sem.')
    expect(result[7].dias).toBe(1)
  })

  it('siempre devuelve exactamente 8 semanas, aunque haya sesiones más viejas que la ventana', () => {
    // 10 sesiones en 10 semanas distintas, espaciadas 7 días entre sí; las
    // 2 más viejas caen fuera de la ventana de 8 semanas desde hoy.
    const sesiones = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(2026, 4, 26 - i * 7)
      return { fecha: { toDate: () => d, toMillis: () => d.getTime() } }
    })
    const result = frecuenciaSemanal(sesiones)
    expect(result).toHaveLength(8)
    expect(result[7].semana).toBe('Esta sem.')
    expect(result[7].dias).toBe(1)
  })

  it('las sesiones sin fecha no rompen el conteo de las que sí la tienen', () => {
    const sesiones = [
      { fecha: null },
      { fecha: ts(2026, 5, 26) },
    ]
    const result = frecuenciaSemanal(sesiones)
    expect(result).toHaveLength(8)
    expect(result[7].dias).toBe(1)
  })
})
