vi.mock('./config', () => ({ db: {}, auth: { currentUser: { uid: 'test-uid' } } }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}))

import { describe, it, expect } from 'vitest'
import { getUltimaVezEjercicioLocal } from './registros'

const ts = (dateStr) => {
  const d = new Date(dateStr)
  return { toDate: () => d, toMillis: () => d.getTime() }
}

const sesiones = [
  {
    id: 's3',
    fecha: ts('2026-05-26'),
    resumen: { ejercicios: [
      { ejercicioId: 'e1', nombre: 'Press Banca', series: [
        { numeroSerie: 1, pesoUsado: 90, repsHechas: 8 },
        { numeroSerie: 2, pesoUsado: 90, repsHechas: 7 },
      ]},
    ]},
  },
  {
    id: 's2',
    fecha: ts('2026-05-25'),
    resumen: { ejercicios: [
      { ejercicioId: 'e1', nombre: 'Press Banca', series: [
        { numeroSerie: 1, pesoUsado: 85, repsHechas: 10 },
      ]},
    ]},
  },
  {
    id: 's1',
    fecha: ts('2026-05-24'),
    resumen: { ejercicios: [
      { ejercicioId: 'e2', nombre: 'Sentadilla', series: [
        { numeroSerie: 1, pesoUsado: 100, repsHechas: 5 },
      ]},
    ]},
  },
]

describe('getUltimaVezEjercicioLocal', () => {
  it('returns null when exercise not found in any session', () => {
    expect(getUltimaVezEjercicioLocal(sesiones, 'e99')).toBeNull()
  })

  it('returns null for empty sessions list', () => {
    expect(getUltimaVezEjercicioLocal([], 'e1')).toBeNull()
  })

  it('returns data from the first session that has the exercise (most recent first)', () => {
    const result = getUltimaVezEjercicioLocal(sesiones, 'e1')
    expect(result).not.toBeNull()
    expect(result.series[0].pesoUsado).toBe(90)
  })

  it('skips the current session when sesionIdActual is provided', () => {
    const result = getUltimaVezEjercicioLocal(sesiones, 'e1', 's3')
    expect(result.series[0].pesoUsado).toBe(85)
  })

  it('returns null when the only matching session is the current one', () => {
    expect(getUltimaVezEjercicioLocal(sesiones, 'e2', 's1')).toBeNull()
  })

  it('returns the fecha of the matching session', () => {
    const result = getUltimaVezEjercicioLocal(sesiones, 'e1')
    expect(result.fecha).toBeDefined()
    expect(result.fecha.toMillis()).toBe(new Date('2026-05-26').getTime())
  })
})
