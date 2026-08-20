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
    expect(statsDocId({ catalogoId: null, nombre: 'Extensión de tríceps' })).toMatch(/^n_extension-de-triceps_/)
  })

  it('es determinístico: el mismo nombre da siempre el mismo id', () => {
    const a = statsDocId({ catalogoId: null, nombre: 'Sentadilla búlgara' })
    const b = statsDocId({ catalogoId: null, nombre: 'Sentadilla búlgara' })
    expect(a).toBe(b)
  })

  it('no colisiona entre nombres que slugifican igual (acentos/mayúsculas)', () => {
    const conAcento = statsDocId({ catalogoId: null, nombre: 'Sentadilla búlgara' })
    const sinAcento = statsDocId({ catalogoId: null, nombre: 'sentadilla bulgara' })
    expect(conAcento).not.toBe(sinAcento)
  })

  it('no colisiona entre nombres cuyo slug queda vacío (sin caracteres ASCII)', () => {
    const rayo = statsDocId({ catalogoId: null, nombre: '⚡' })
    const fuego = statsDocId({ catalogoId: null, nombre: '🔥' })
    expect(rayo).not.toBe(fuego)
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
    // prVolumen es un récord independiente del pr de peso máximo: la serie
    // de mayor volumen (80×10=800) no es la del pr (100×3).
    expect(r.prVolumen).toEqual({ volumen: 800, pesoUsado: 80, repsHechas: 10, fecha: FECHA1, sesionId: 's1' })
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

  it('una serie con más volumen (aunque no supere el pr de peso) genera un nuevo récord de volumen', () => {
    const base = mergeSesionEnStats(null, EJ, FECHA1, 's1') // mejor volumen previo: 800 (80×10)
    const masVolumen = { ...EJ, series: [{ numeroSerie: 1, pesoUsado: 90, repsHechas: 10 }] } // 900, y no supera el pr de 100
    const r = mergeSesionEnStats(base, masVolumen, FECHA2, 's2')
    expect(r.prVolumen).toEqual({ volumen: 900, pesoUsado: 90, repsHechas: 10, fecha: FECHA2, sesionId: 's2' })
    expect(r.pr.maxPeso).toBe(100) // el pr de peso no se tocó
  })

  it('una sesión con menos volumen conserva el récord de volumen anterior', () => {
    const base = mergeSesionEnStats(null, EJ, FECHA1, 's1') // 800
    const menosVolumen = { ...EJ, series: [{ numeroSerie: 1, pesoUsado: 50, repsHechas: 5 }] } // 250
    const r = mergeSesionEnStats(base, menosVolumen, FECHA2, 's2')
    expect(r.prVolumen).toEqual(base.prVolumen)
  })

  it('sin peso (series de solo reps, ej. dominadas a cuerpo libre) no genera récord de volumen', () => {
    const sinPeso = { ...EJ, series: [{ numeroSerie: 1, pesoUsado: 0, repsHechas: 12 }] }
    const r = mergeSesionEnStats(null, sinPeso, FECHA1, 's1')
    expect(r.prVolumen).toBeNull()
  })

  it('un doc previo a este campo (sin la clave prVolumen) + una serie a 0kg da prVolumen null, no undefined', () => {
    // Simula un statsEjercicios real escrito antes de que prVolumen existiera:
    // la clave ni está presente en el doc, no es que valga null.
    const docPrevioSinCampo = { nombre: 'Dominadas', grupoMuscular: 'Espalda', catalogoId: 'dominadas', pr: null, ultimaVez: null, puntos: [] }
    const sinPeso = { ...EJ, nombre: 'Dominadas', series: [{ numeroSerie: 1, pesoUsado: 0, repsHechas: 12 }] }
    const r = mergeSesionEnStats(docPrevioSinCampo, sinPeso, FECHA1, 's1')
    // undefined haría que Firestore rechace el set() del doc entero (batch
    // roto): la clave debe existir con valor null, no faltar.
    expect(r.prVolumen).toBeNull()
    expect('prVolumen' in r).toBe(true)
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
    expect(paths).toContain(`usuarios/user1/statsEjercicios/${statsDocId({ catalogoId: null, nombre: 'Curl raro' })}`)
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('sin ejercicios no escribe nada', async () => {
    await aplicarSesionAStats('user1', { sesionId: 's1', fecha: new Date(), resumen: { ejercicios: [] } })
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })

  it('si recibe un batch externo, agrega al batch pero no comitea (el caller es responsable)', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    const resumen = {
      ejercicios: [{ ejercicioId: 'a', catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho', series: [{ numeroSerie: 1, pesoUsado: 80, repsHechas: 8 }] }],
    }
    const batchExterno = { set: mockBatchSet, commit: mockBatchCommit }
    await aplicarSesionAStats('user1', { sesionId: 's1', fecha: new Date(FECHA1), resumen }, batchExterno)
    expect(mockBatchSet).toHaveBeenCalledTimes(1)
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

  it('sin batch externo, comitea el batch propio', async () => {
    getSesionesConResumen.mockResolvedValue([])
    await rebuildStatsEjercicios('user1', [{ catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho' }])
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('con batch externo, agrega al batch pero no comitea', async () => {
    getSesionesConResumen.mockResolvedValue([])
    const batchExterno = { set: mockBatchSet, commit: mockBatchCommit }
    await rebuildStatsEjercicios('user1', [{ catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho' }], batchExterno)
    expect(mockBatchSet).toHaveBeenCalledTimes(1)
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })

  it('excluirSesionId saca esa sesión del historial usado para reconstruir', async () => {
    getSesionesConResumen.mockResolvedValue([
      {
        id: 's-vieja', fecha: new Date(FECHA1),
        resumen: { ejercicios: [{ ejercicioId: 'a', catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho', series: [{ numeroSerie: 1, pesoUsado: 60, repsHechas: 5 }] }] },
      },
      {
        // Esta es la sesión que se está borrando: si no se excluye, su peso
        // más alto (85) ganaría el PR en vez del de la sesión vieja (60).
        id: 's-borrando', fecha: new Date(FECHA1 + 1000),
        resumen: { ejercicios: [{ ejercicioId: 'a', catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho', series: [{ numeroSerie: 1, pesoUsado: 85, repsHechas: 5 }] }] },
      },
    ])
    await rebuildStatsEjercicios(
      'user1',
      [{ catalogoId: 'press', nombre: 'Press', grupoMuscular: 'Pecho' }],
      null,
      { excluirSesionId: 's-borrando' },
    )
    const escrito = mockBatchSet.mock.calls[0][1]
    expect(escrito.pr.maxPeso).toBe(60)
    expect(escrito.pr.sesionId).toBe('s-vieja')
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

  it('un doc previo al campo prVolumen (clave ausente, no null) se reconstruye desde el historial', async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [{
          id: 'press',
          data: () => ({
            nombre: 'Press de banca plano', catalogoId: 'press',
            pr: { maxPeso: 65, fecha: FECHA1, sesionId: 's1', series: [] },
            ultimaVez: { fecha: FECHA1, sesionId: 's1', series: [] },
            puntos: [],
            // sin prVolumen: doc escrito antes de que existiera el campo
          }),
        }],
      })
      .mockResolvedValueOnce({
        docs: [{
          id: 'press',
          data: () => ({
            nombre: 'Press de banca plano', catalogoId: 'press',
            pr: { maxPeso: 65, fecha: FECHA1, sesionId: 's1', series: [] },
            prVolumen: { volumen: 390, pesoUsado: 65, repsHechas: 6, fecha: FECHA1, sesionId: 's1' },
            ultimaVez: { fecha: FECHA1, sesionId: 's1', series: [] },
            puntos: [],
          }),
        }],
      })
    getSesionesConResumen.mockResolvedValue([
      {
        id: 's1', fecha: new Date(FECHA1),
        resumen: { ejercicios: [{ ejercicioId: 'a', catalogoId: 'press', nombre: 'Press de banca plano', grupoMuscular: 'Pecho', series: [{ numeroSerie: 1, pesoUsado: 65, repsHechas: 6 }] }] },
      },
    ])
    const r = await getStatsEjerciciosConFallback('user1')
    expect(getSesionesConResumen).toHaveBeenCalledOnce()
    expect(mockBatchCommit).toHaveBeenCalledOnce()
    expect(r[0].prVolumen.volumen).toBe(390)
  })

  it('un doc con prVolumen: null legítimo (ej. ejercicio a cuerpo libre) no dispara una reconstrucción', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{
        id: 'dominadas',
        data: () => ({
          nombre: 'Dominadas', pr: null, prVolumen: null,
          ultimaVez: { fecha: FECHA1, sesionId: 's1', series: [] },
          puntos: [],
        }),
      }],
    })
    const r = await getStatsEjerciciosConFallback('user1')
    expect(getSesionesConResumen).not.toHaveBeenCalled()
    expect(mockBatchCommit).not.toHaveBeenCalled()
    expect(r[0].prVolumen).toBeNull()
  })
})
