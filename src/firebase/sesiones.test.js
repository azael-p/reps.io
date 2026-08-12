vi.mock('./config', () => ({ db: {}, auth: { currentUser: { uid: 'test-uid' } } }))
const mockGetDocs = vi.fn()
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn((col, ...restricciones) => ({ col, restricciones })),
  where: vi.fn((...args) => ({ type: 'where', args })),
  orderBy: vi.fn((...args) => ({ type: 'orderBy', args })),
  limit: vi.fn((n) => ({ type: 'limit', n })),
  startAfter: vi.fn((doc) => ({ type: 'startAfter', doc })),
  getDocs: (...args) => mockGetDocs(...args),
}))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getEjerciciosUsadosConGrupoLocal,
  getVolumenPorSesionLocal,
  getRegistrosPorEjercicioLocal,
  getStreaksLocal,
  esMismoEjercicio,
  getSesionesPaginadas,
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
      { nombre: 'Press Banca', grupoMuscular: 'Pecho', catalogoId: null },
      { nombre: 'Sentadilla', grupoMuscular: 'Piernas', catalogoId: null },
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

  it('deduplicates by catalogoId aunque el ejercicioId y el nombre difieran entre días', () => {
    const sesiones = [
      mkSesion(2026, 5, 24, [
        { ejercicioId: 'ed-pecho1', catalogoId: 'press-banca-plano', nombre: 'Press de banca plano', grupoMuscular: 'Pecho', series: [] },
      ]),
      mkSesion(2026, 5, 25, [
        { ejercicioId: 'ed-pecho2', catalogoId: 'press-banca-plano', nombre: 'Press de banca plano', grupoMuscular: 'Pecho', series: [] },
      ]),
    ]
    const result = getEjerciciosUsadosConGrupoLocal(sesiones)
    expect(result).toHaveLength(1)
    expect(result[0].catalogoId).toBe('press-banca-plano')
  })

  it('un grupo sin catalogoId lo adopta apenas aparece en otra sesión', () => {
    const sesiones = [
      mkSesion(2026, 5, 24, [{ nombre: 'Press Banca', grupoMuscular: 'Pecho', series: [] }]), // sin catalogoId
      mkSesion(2026, 5, 25, [{ nombre: 'Press Banca', catalogoId: 'press-banca-plano', grupoMuscular: 'Pecho', series: [] }]),
    ]
    const result = getEjerciciosUsadosConGrupoLocal(sesiones)
    expect(result).toHaveLength(1)
    expect(result[0].catalogoId).toBe('press-banca-plano')
  })
})

// ---------------------------------------------------------------------------

describe('esMismoEjercicio', () => {
  it('matchea por catalogoId aunque el nombre difiera', () => {
    expect(esMismoEjercicio(
      { catalogoId: 'press-banca-plano', nombre: 'Press de banca plano' },
      { catalogoId: 'press-banca-plano', nombre: 'Press banca' },
    )).toBe(true)
  })

  it('no matchea si el catalogoId difiere', () => {
    expect(esMismoEjercicio(
      { catalogoId: 'press-banca-plano', nombre: 'Press de banca plano' },
      { catalogoId: 'press-militar', nombre: 'Press de banca plano' },
    )).toBe(false)
  })

  it('cae a comparar por nombre si a alguno le falta catalogoId', () => {
    expect(esMismoEjercicio(
      { catalogoId: null, nombre: 'Press de banca plano' },
      { catalogoId: 'press-banca-plano', nombre: 'Press de banca plano' },
    )).toBe(true)
  })

  it('sin catalogoId en ningún lado, matchea por nombre', () => {
    expect(esMismoEjercicio({ nombre: 'Press Banca' }, { nombre: 'Press Banca' })).toBe(true)
    expect(esMismoEjercicio({ nombre: 'Press Banca' }, { nombre: 'Sentadilla' })).toBe(false)
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
    expect(getRegistrosPorEjercicioLocal(sesiones, { nombre: 'Curl Bíceps' })).toEqual([])
  })

  it('returns all series for a given exercise sorted by date (oldest first)', () => {
    const result = getRegistrosPorEjercicioLocal(sesiones, { nombre: 'Press Banca' })
    expect(result).toHaveLength(3)
    expect(result[0].sesionId).toBe('s1')
    expect(result[2].pesoUsado).toBe(85)
  })

  it('includes correct fields in each record', () => {
    const result = getRegistrosPorEjercicioLocal(sesiones, { nombre: 'Sentadilla' })
    expect(result[0]).toMatchObject({ sesionId: 's2', pesoUsado: 100, repsHechas: 5, numeroSerie: 1 })
  })

  it('matchea por catalogoId aunque el nombre difiera entre sesiones', () => {
    const sesionesConCatalogo = [
      {
        id: 's1', fecha: ts(2026, 5, 24),
        resumen: { ejercicios: [
          { catalogoId: 'press-banca-plano', nombre: 'Press de banca plano', grupoMuscular: 'Pecho', series: [
            { numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
          ]},
        ]},
      },
      {
        id: 's2', fecha: ts(2026, 5, 25),
        resumen: { ejercicios: [
          { catalogoId: 'press-banca-plano', nombre: 'Press banca (día 2)', grupoMuscular: 'Pecho', series: [
            { numeroSerie: 1, pesoUsado: 85, repsHechas: 8 },
          ]},
        ]},
      },
    ]
    const result = getRegistrosPorEjercicioLocal(sesionesConCatalogo, { catalogoId: 'press-banca-plano', nombre: 'Press de banca plano' })
    expect(result).toHaveLength(2)
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

// ---------------------------------------------------------------------------

describe('getSesionesPaginadas', () => {
  beforeEach(() => { mockGetDocs.mockReset() })

  it('pide pageSize+where(usuarioId,completada)+orderBy(fecha desc) y arma la respuesta', async () => {
    const docs = [
      { id: 's1', data: () => ({ fecha: 'a' }) },
      { id: 's2', data: () => ({ fecha: 'b' }) },
    ]
    mockGetDocs.mockResolvedValue({ docs })

    const r = await getSesionesPaginadas('user1', { pageSize: 2 })

    expect(r.sesiones).toEqual([{ id: 's1', fecha: 'a' }, { id: 's2', fecha: 'b' }])
    expect(r.ultimoDoc).toBe(docs[1])
    // pageSize=2 con 2 resultados ⇒ puede haber más
    expect(r.hayMas).toBe(true)

    const llamada = mockGetDocs.mock.calls[0][0]
    const tipos = llamada.restricciones.map(r2 => r2.type ?? 'where')
    expect(tipos).toContain('orderBy')
    expect(tipos).toContain('limit')
    expect(tipos).not.toContain('startAfter')
  })

  it('con menos resultados que pageSize, hayMas es false', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 's1', data: () => ({}) }] })
    const r = await getSesionesPaginadas('user1', { pageSize: 20 })
    expect(r.hayMas).toBe(false)
    expect(r.ultimoDoc).not.toBeNull()
  })

  it('sin resultados, ultimoDoc es null', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    const r = await getSesionesPaginadas('user1')
    expect(r).toEqual({ sesiones: [], ultimoDoc: null, hayMas: false })
  })

  it('con after, agrega startAfter a la query', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    const cursor = { id: 'cursor-doc' }
    await getSesionesPaginadas('user1', { after: cursor, pageSize: 20 })
    const llamada = mockGetDocs.mock.calls[0][0]
    const startAfterCall = llamada.restricciones.find(r => r.type === 'startAfter')
    expect(startAfterCall.doc).toBe(cursor)
  })
})
