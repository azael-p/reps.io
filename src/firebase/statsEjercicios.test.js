vi.mock('./config', () => ({ db: {} }))

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockSetDoc = vi.fn()
const mockBatchSet = vi.fn()
const mockBatchCommit = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  collection: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  writeBatch: () => ({ set: mockBatchSet, commit: mockBatchCommit }),
}))

vi.mock('./sesiones', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getSesionesConResumen: vi.fn() }
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { statsDocId, mergeSesionEnStats, aplicarSesionAStats, rebuildStatsEjercicios, getStatsEjerciciosConFallback } from './statsEjercicios'
import { getSesionesConResumen } from './sesiones'

const FECHA1 = new Date(2026, 5, 10).getTime()
const FECHA2 = new Date(2026, 6, 15).getTime()

beforeEach(() => { vi.clearAllMocks() })

// ---------------------------------------------------------------------------

describe('statsDocId', () => {
  it('usa el catalogoId cuando existe', () => {
    expect(statsDocId({ catalogoId: 'press-banca', nombre: 'Otro' })).toBe('press-banca')
  })

  it('slugifica el nombre para ejercicios custom (acentos incluidos)', () => {
    expect(statsDocId({ catalogoId: null, nombre: 'Extensión de tríceps' })).toBe('n_extension-de-triceps')
  })
})

// ---------------------------------------------------------------------------

describe('mergeSesionEnStats', () => {
  const EJ = {
    ejercicioId: 'ej1', catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho',
    series: [
      { numeroSerie: 1, pesoUsado: 80, repsHechas: 10 },
      { numeroSerie: 2, pesoUsado: 100, repsHechas: 3 },
    ],
  }

  it('crea el doc con pr, ultimaVez y punto en la primera sesión', () => {
    const r = mergeSesionEnStats(null, EJ, FECHA1, 's1')
    expect(r.pr).toEqual({ maxPeso: 100, fecha: FECHA1, sesionId: 's1', series: EJ.series })
    expect(r.ultimaVez.sesionId).toBe('s1')
    expect(r.puntos).toHaveLength(1)
    // Máximos POR SERIE: 1RM gana 100×3 (110) sobre 80×10 (107); volumen gana 80×10 (800)
    expect(r.puntos[0].pesoMax).toBe(100)
    expect(r.puntos[0].oneRm).toBe(Math.round(100 * (1 + 3 / 30)))
    expect(r.puntos[0].volSerie).toBe(800)
  })

  it('una sesión posterior con menos peso actualiza ultimaVez pero conserva el PR', () => {
    const base = mergeSesionEnStats(null, EJ, FECHA1, 's1')
    const liviana = { ...EJ, series: [{ numeroSerie: 1, pesoUsado: 60, repsHechas: 10 }] }
    const r = mergeSesionEnStats(base, liviana, FECHA2, 's2')
    expect(r.pr.maxPeso).toBe(100)
    expect(r.pr.sesionId).toBe('s1')
    expect(r.ultimaVez.sesionId).toBe('s2')
    expect(r.puntos.map(p => p.sesionId)).toEqual(['s1', 's2'])
  })

  it('re-aplicar la misma sesión reemplaza su punto (idempotencia por sesionId)', () => {
    const base = mergeSesionEnStats(null, EJ, FECHA1, 's1')
    const editada = { ...EJ, series: [{ numeroSerie: 1, pesoUsado: 90, repsHechas: 8 }] }
    const r = mergeSesionEnStats(base, editada, FECHA1, 's1')
    expect(r.puntos).toHaveLength(1)
    expect(r.puntos[0].pesoMax).toBe(90)
  })
})

// ---------------------------------------------------------------------------

describe('aplicarSesionAStats', () => {
  it('escribe un doc por ejercicio de la sesión en un batch', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    const resumen = {
      ejercicios: [
        { ejercicioId: 'a', catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho', series: [{ numeroSerie: 1, pesoUsado: 80, repsHechas: 8 }] },
        { ejercicioId: 'b', catalogoId: null, nombre: 'Curl raro', grupoMuscular: 'Bíceps', series: [{ numeroSerie: 1, pesoUsado: 20, repsHechas: 12 }] },
      ],
    }
    await aplicarSesionAStats('user1', { sesionId: 's1', fecha: new Date(FECHA1), resumen })
    expect(mockBatchSet).toHaveBeenCalledTimes(2)
    const paths = mockBatchSet.mock.calls.map(c => c[0].path)
    expect(paths).toContain('usuarios/user1/statsEjercicios/press')
    expect(paths).toContain('usuarios/user1/statsEjercicios/n_curl-raro')
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('sin ejercicios no escribe nada', async () => {
    await aplicarSesionAStats('user1', { sesionId: 's1', fecha: new Date(), resumen: { ejercicios: [] } })
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('rebuildStatsEjercicios', () => {
  it('reconstruye desde el historial: una edición que bajó el peso baja el PR', async () => {
    getSesionesConResumen.mockResolvedValue([
      {
        id: 's1', fecha: new Date(FECHA1),
        resumen: { ejercicios: [{ ejercicioId: 'a', catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho', series: [{ numeroSerie: 1, pesoUsado: 85, repsHechas: 5 }] }] },
      },
    ])
    await rebuildStatsEjercicios('user1', [{ catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho' }])
    const escrito = mockBatchSet.mock.calls[0][1]
    expect(escrito.pr.maxPeso).toBe(85)
  })

  it('si el ejercicio ya no aparece en ninguna sesión, escribe el doc vacío', async () => {
    getSesionesConResumen.mockResolvedValue([])
    await rebuildStatsEjercicios('user1', [{ catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho' }])
    const escrito = mockBatchSet.mock.calls[0][1]
    expect(escrito.pr).toBeNull()
    expect(escrito.puntos).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('getStatsEjerciciosConFallback', () => {
  it('devuelve los docs existentes sin reconstruir', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'press', data: () => ({ nombre: 'Press' }) }] })
    const r = await getStatsEjerciciosConFallback('user1')
    expect(r).toEqual([{ id: 'press', nombre: 'Press' }])
    expect(getSesionesConResumen).not.toHaveBeenCalled()
  })

  it('si la colección está vacía, construye desde el historial y persiste (self-healing)', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    getSesionesConResumen.mockResolvedValue([
      {
        id: 's1', fecha: new Date(FECHA1),
        resumen: { ejercicios: [{ ejercicioId: 'a', catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho', series: [{ numeroSerie: 1, pesoUsado: 80, repsHechas: 8 }] }] },
      },
    ])
    const r = await getStatsEjerciciosConFallback('user1')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('press')
    expect(r[0].pr.maxPeso).toBe(80)
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('sin historial devuelve vacío sin escribir', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    getSesionesConResumen.mockResolvedValue([])
    expect(await getStatsEjerciciosConFallback('user1')).toEqual([])
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })
})
