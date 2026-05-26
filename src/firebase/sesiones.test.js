vi.mock('./config', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getEjerciciosUsadosConGrupoLocal,
  getVolumenPorSesionLocal,
  getRegistrosPorEjercicioLocal,
  getStreaksLocal,
} from './sesiones'

// Use local dates (y, m, d) to avoid UTC vs local timezone mismatches.
// The functions under test use getDate()/getMonth()/getFullYear() (local), so
// the test data must also be local to stay consistent.
const ts = (y, m, d) => {
  const date = new Date(y, m - 1, d)
  return { toDate: () => date, toMillis: () => date.getTime() }
}

const mkSesion = (y, m, d, ejercicios = []) => ({
  id: `s-${y}-${m}-${d}`,
  fecha: ts(y, m, d),
  resumen: {
    volumenTotal: ejercicios.reduce(
      (sum, e) => sum + e.series.reduce((s2, s) => s2 + s.pesoUsado * s.repsHechas, 0),
      0
    ),
    ejercicios,
  },
})

// ---------------------------------------------------------------------------

describe('getEjerciciosUsadosConGrupoLocal', () => {
  it('returns empty array when sessions have no resumen', () => {
    expect(getEjerciciosUsadosConGrupoLocal([{ id: '1', resumen: null }])).toEqual([])
  })

  it('returns empty array for empty sessions list', () => {
    expect(getEjerciciosUsadosConGrupoLocal([])).toEqual([])
  })

  it('extracts exercises sorted alphabetically', () => {
    const sesiones = [
      mkSesion(2026, 5, 24, [
        { nombre: 'Sentadilla', grupoMuscular: 'Piernas', series: [] },
        { nombre: 'Press Banca', grupoMuscular: 'Pecho', series: [] },
      ]),
    ]
    const result = getEjerciciosUsadosConGrupoLocal(sesiones)
    expect(result).toEqual([
      { nombre: 'Press Banca', grupoMuscular: 'Pecho' },
      { nombre: 'Sentadilla', grupoMuscular: 'Piernas' },
    ])
  })

  it('deduplicates exercises that appear in multiple sessions', () => {
    const sesiones = [
      mkSesion(2026, 5, 24, [{ nombre: 'Press Banca', grupoMuscular: 'Pecho', series: [] }]),
      mkSesion(2026, 5, 25, [
        { nombre: 'Press Banca', grupoMuscular: 'Pecho', series: [] },
        { nombre: 'Curl Bíceps', grupoMuscular: 'Bíceps', series: [] },
      ]),
    ]
    const result = getEjerciciosUsadosConGrupoLocal(sesiones)
    expect(result).toHaveLength(2)
    expect(result.map(e => e.nombre)).toEqual(['Curl Bíceps', 'Press Banca'])
  })
})

// ---------------------------------------------------------------------------

describe('getVolumenPorSesionLocal', () => {
  it('returns empty array when all sessions have 0 volume', () => {
    expect(getVolumenPorSesionLocal([mkSesion(2026, 5, 24, [])])).toEqual([])
  })

  it('filters out sessions with zero volume', () => {
    const sesiones = [
      { id: 's1', fecha: ts(2026, 5, 24), resumen: { volumenTotal: 0 } },
      { id: 's2', fecha: ts(2026, 5, 25), resumen: { volumenTotal: 1500 } },
    ]
    const result = getVolumenPorSesionLocal(sesiones)
    expect(result).toHaveLength(1)
    expect(result[0].sesionId).toBe('s2')
  })

  it('returns results sorted oldest first (ascending)', () => {
    const sesiones = [
      { id: 's2', fecha: ts(2026, 5, 25), resumen: { volumenTotal: 1500 } },
      { id: 's1', fecha: ts(2026, 5, 24), resumen: { volumenTotal: 1000 } },
    ]
    const result = getVolumenPorSesionLocal(sesiones)
    expect(result[0].sesionId).toBe('s1')
    expect(result[1].sesionId).toBe('s2')
  })

  it('maps volumen and sesionId correctly', () => {
    const sesiones = [{ id: 'abc', fecha: ts(2026, 5, 24), resumen: { volumenTotal: 2400 } }]
    const result = getVolumenPorSesionLocal(sesiones)
    expect(result[0].volumen).toBe(2400)
    expect(result[0].sesionId).toBe('abc')
  })
})

// ---------------------------------------------------------------------------

describe('getRegistrosPorEjercicioLocal', () => {
  const sesiones = [
    {
      id: 's1', fecha: ts(2026, 5, 24),
      resumen: { ejercicios: [
        { nombre: 'Press Banca', grupoMuscular: 'Pecho', series: [
          { numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
          { numeroSerie: 2, pesoUsado: 80, repsHechas: 7 },
        ]},
      ]},
    },
    {
      id: 's2', fecha: ts(2026, 5, 25),
      resumen: { ejercicios: [
        { nombre: 'Press Banca', grupoMuscular: 'Pecho', series: [
          { numeroSerie: 1, pesoUsado: 85, repsHechas: 8 },
        ]},
        { nombre: 'Sentadilla', grupoMuscular: 'Piernas', series: [
          { numeroSerie: 1, pesoUsado: 100, repsHechas: 5 },
        ]},
      ]},
    },
  ]

  it('returns empty array when exercise not found in any session', () => {
    expect(getRegistrosPorEjercicioLocal(sesiones, 'Curl Bíceps')).toEqual([])
  })

  it('returns all series for a given exercise sorted by date (oldest first)', () => {
    const result = getRegistrosPorEjercicioLocal(sesiones, 'Press Banca')
    expect(result).toHaveLength(3)
    expect(result[0].sesionId).toBe('s1')
    expect(result[2].pesoUsado).toBe(85)
  })

  it('includes correct fields in each record', () => {
    const result = getRegistrosPorEjercicioLocal(sesiones, 'Sentadilla')
    expect(result[0]).toMatchObject({ sesionId: 's2', pesoUsado: 100, repsHechas: 5, numeroSerie: 1 })
  })
})

// ---------------------------------------------------------------------------

describe('getStreaksLocal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Use local date constructor to avoid UTC offset issues
    vi.setSystemTime(new Date(2026, 4, 26, 10, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('returns zeros for empty sessions list', () => {
    expect(getStreaksLocal([])).toEqual({ actual: 0, maxima: 0 })
  })

  it('returns streak of 1 for a single session today', () => {
    expect(getStreaksLocal([{ fecha: ts(2026, 5, 26) }])).toEqual({ actual: 1, maxima: 1 })
  })

  it('counts consecutive days ending today', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 26) },
      { fecha: ts(2026, 5, 25) },
      { fecha: ts(2026, 5, 24) },
    ]
    expect(getStreaksLocal(sesiones)).toEqual({ actual: 3, maxima: 3 })
  })

  it('counts consecutive days ending yesterday', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 25) },
      { fecha: ts(2026, 5, 24) },
    ]
    expect(getStreaksLocal(sesiones)).toEqual({ actual: 2, maxima: 2 })
  })

  it('returns actual=0 when last session was more than 1 day ago', () => {
    const result = getStreaksLocal([{ fecha: ts(2026, 5, 20) }])
    expect(result.actual).toBe(0)
    expect(result.maxima).toBe(1)
  })

  it('differentiates current streak from historical max streak', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 26) },
      { fecha: ts(2026, 5, 25) },
      // gap
      { fecha: ts(2026, 5, 18) },
      { fecha: ts(2026, 5, 17) },
      { fecha: ts(2026, 5, 16) },
      { fecha: ts(2026, 5, 15) },
      { fecha: ts(2026, 5, 14) },
    ]
    const result = getStreaksLocal(sesiones)
    expect(result.actual).toBe(2)
    expect(result.maxima).toBe(5)
  })

  it('deduplicates multiple sessions on the same day', () => {
    const sesiones = [
      { fecha: ts(2026, 5, 26) },
      { fecha: ts(2026, 5, 26) },
      { fecha: ts(2026, 5, 25) },
    ]
    expect(getStreaksLocal(sesiones)).toEqual({ actual: 2, maxima: 2 })
  })
})
