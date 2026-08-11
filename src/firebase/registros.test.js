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

import { describe, it, expect, vi } from 'vitest'
import { addDoc } from 'firebase/firestore'
import { getUltimaVezEjercicioLocal, agregarRegistro } from './registros'

const ej = (nombre, catalogoId = null) => ({ nombre, catalogoId })

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
    expect(getUltimaVezEjercicioLocal(sesiones, ej('No existe'))).toBeNull()
  })

  it('returns null for empty sessions list', () => {
    expect(getUltimaVezEjercicioLocal([], ej('Press Banca'))).toBeNull()
  })

  it('returns data from the first session that has the exercise (most recent first)', () => {
    const result = getUltimaVezEjercicioLocal(sesiones, ej('Press Banca'))
    expect(result).not.toBeNull()
    expect(result.series[0].pesoUsado).toBe(90)
  })

  it('skips the current session when sesionIdActual is provided', () => {
    const result = getUltimaVezEjercicioLocal(sesiones, ej('Press Banca'), 's3')
    expect(result.series[0].pesoUsado).toBe(85)
  })

  it('returns null when the only matching session is the current one', () => {
    expect(getUltimaVezEjercicioLocal(sesiones, ej('Sentadilla'), 's1')).toBeNull()
  })

  it('returns the fecha of the matching session', () => {
    const result = getUltimaVezEjercicioLocal(sesiones, ej('Press Banca'))
    expect(result.fecha).toBeDefined()
    expect(result.fecha.toMillis()).toBe(new Date('2026-05-26').getTime())
  })

  it('matchea por catalogoId aunque el ejercicioId y el nombre difieran (mismo ejercicio en otro día)', () => {
    const sesionesConCatalogo = [
      {
        id: 's2', fecha: ts('2026-05-25'),
        resumen: { ejercicios: [
          { ejercicioId: 'ed-pecho1', catalogoId: 'press-banca-plano', nombre: 'Press de banca plano', series: [
            { numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
          ]},
        ]},
      },
    ]
    const result = getUltimaVezEjercicioLocal(sesionesConCatalogo, ej('Press de banca plano (pecho 2)', 'press-banca-plano'))
    expect(result).not.toBeNull()
    expect(result.series[0].pesoUsado).toBe(80)
  })

  it('no matchea si el catalogoId difiere, aunque casualmente el nombre coincida', () => {
    const sesionesConCatalogo = [
      {
        id: 's2', fecha: ts('2026-05-25'),
        resumen: { ejercicios: [
          { ejercicioId: 'ed-1', catalogoId: 'press-militar', nombre: 'Press', series: [
            { numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
          ]},
        ]},
      },
    ]
    const result = getUltimaVezEjercicioLocal(sesionesConCatalogo, ej('Press', 'press-banca-plano'))
    expect(result).toBeNull()
  })
})

describe('agregarRegistro', () => {
  it('incluye catalogoId en el documento (null si no se pasa)', async () => {
    addDoc.mockResolvedValue({ id: 'r1' })
    await agregarRegistro({
      sesionId: 's1', ejercicioId: 'ed1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho',
      numeroSerie: 1, repsEsperadas: 8, repsHechas: 8, pesoUsado: 80, nota: '',
    })
    expect(addDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({ catalogoId: null }))
  })

  it('escribe el catalogoId recibido', async () => {
    addDoc.mockResolvedValue({ id: 'r2' })
    await agregarRegistro({
      sesionId: 's1', ejercicioId: 'ed1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho',
      catalogoId: 'press-banca-plano',
      numeroSerie: 1, repsEsperadas: 8, repsHechas: 8, pesoUsado: 80, nota: '',
    })
    expect(addDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({ catalogoId: 'press-banca-plano' }))
  })
})
