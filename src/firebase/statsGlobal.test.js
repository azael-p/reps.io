vi.mock('./config', () => ({ db: {} }))

const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  collection: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  query: vi.fn((col) => col),
  where: vi.fn(),
  orderBy: vi.fn(),
}))

vi.mock('./sesiones', () => ({ getSesionesConResumen: vi.fn() }))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  epochDia, buildResumenGlobal, getResumenGlobalConFallback,
  aplicarSesionAResumenGlobal, removerSesionDeResumenGlobal,
} from './statsGlobal'
import { getSesionesConResumen } from './sesiones'

const DIA = (y, m, d) => new Date(y, m - 1, d)
const E = (y, m, d) => DIA(y, m, d).getTime()

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------

describe('epochDia', () => {
  it('normaliza al inicio del día local', () => {
    expect(epochDia(new Date(2026, 5, 10, 18, 30))).toBe(E(2026, 6, 10))
  })

  it('acepta Timestamps de Firestore y devuelve null sin fecha', () => {
    expect(epochDia({ toDate: () => new Date(2026, 0, 5, 7) })).toBe(E(2026, 1, 5))
    expect(epochDia(null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('buildResumenGlobal', () => {
  it('deduplica días y ordena volumen antiguo → reciente', () => {
    const sesiones = [
      { id: 's2', fecha: DIA(2026, 6, 12), resumen: { volumenTotal: 500, diaNombre: 'Pull' } },
      { id: 's1', fecha: DIA(2026, 6, 10), resumen: { volumenTotal: 300, diaNombre: 'Push' } },
      { id: 's3', fecha: new Date(2026, 5, 10, 20), resumen: { volumenTotal: 0 } }, // mismo día que s1, sin volumen
    ]
    const r = buildResumenGlobal(sesiones)
    expect(r.diasEntrenados).toEqual([E(2026, 6, 10), E(2026, 6, 12)])
    expect(r.volumenPorSesion.map(v => v.sesionId)).toEqual(['s1', 's2'])
  })
})

// ---------------------------------------------------------------------------

describe('getResumenGlobalConFallback', () => {
  it('devuelve el doc si existe, sin reconstruir', async () => {
    const data = { diasEntrenados: [1], volumenPorSesion: [] }
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => data })
    expect(await getResumenGlobalConFallback('user1')).toEqual(data)
    expect(getSesionesConResumen).not.toHaveBeenCalled()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('si no existe, lo construye desde las sesiones y lo persiste (self-healing)', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    getSesionesConResumen.mockResolvedValue([
      { id: 's1', fecha: DIA(2026, 6, 10), resumen: { volumenTotal: 300, diaNombre: 'Push' } },
    ])
    const r = await getResumenGlobalConFallback('user1')
    expect(r.diasEntrenados).toEqual([E(2026, 6, 10)])
    expect(mockSetDoc).toHaveBeenCalledWith(
      { path: 'usuarios/user1/stats/global' },
      r,
    )
  })

  it('con cero sesiones devuelve vacío y no escribe', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    getSesionesConResumen.mockResolvedValue([])
    const r = await getResumenGlobalConFallback('user1')
    expect(r).toEqual({ diasEntrenados: [], volumenPorSesion: [] })
    expect(mockSetDoc).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('aplicarSesionAResumenGlobal', () => {
  it('agrega día y entrada de volumen a un agregado existente', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        diasEntrenados: [E(2026, 6, 10)],
        volumenPorSesion: [{ sesionId: 's1', fecha: E(2026, 6, 10), volumen: 300, diaNombre: 'Push' }],
      }),
    })
    await aplicarSesionAResumenGlobal('user1', {
      sesionId: 's2', fecha: DIA(2026, 6, 12), resumen: { volumenTotal: 500, diaNombre: 'Pull' },
    })
    const escrito = mockSetDoc.mock.calls[0][1]
    expect(escrito.diasEntrenados).toEqual([E(2026, 6, 10), E(2026, 6, 12)])
    expect(escrito.volumenPorSesion.map(v => v.sesionId)).toEqual(['s1', 's2'])
  })

  it('es idempotente por sesionId: re-aplicar reemplaza la entrada (edición de series)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        diasEntrenados: [E(2026, 6, 10)],
        volumenPorSesion: [{ sesionId: 's1', fecha: E(2026, 6, 10), volumen: 300, diaNombre: 'Push' }],
      }),
    })
    await aplicarSesionAResumenGlobal('user1', {
      sesionId: 's1', fecha: DIA(2026, 6, 10), resumen: { volumenTotal: 350, diaNombre: 'Push' },
    })
    const escrito = mockSetDoc.mock.calls[0][1]
    expect(escrito.volumenPorSesion).toHaveLength(1)
    expect(escrito.volumenPorSesion[0].volumen).toBe(350)
  })
})

// ---------------------------------------------------------------------------

describe('removerSesionDeResumenGlobal', () => {
  const agregado = {
    diasEntrenados: [E(2026, 6, 10)],
    volumenPorSesion: [{ sesionId: 's1', fecha: E(2026, 6, 10), volumen: 300, diaNombre: 'Push' }],
  }

  it('quita el volumen y el día si no quedan otras sesiones ese día', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => agregado })
    mockGetDocs.mockResolvedValue({ docs: [{ id: 's1' }] }) // solo la que se borra
    await removerSesionDeResumenGlobal('user1', { sesionId: 's1', fecha: DIA(2026, 6, 10) })
    const escrito = mockSetDoc.mock.calls[0][1]
    expect(escrito.diasEntrenados).toEqual([])
    expect(escrito.volumenPorSesion).toEqual([])
  })

  it('conserva el día si otra sesión completada cae el mismo día', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => agregado })
    mockGetDocs.mockResolvedValue({ docs: [{ id: 's1' }, { id: 's9' }] })
    await removerSesionDeResumenGlobal('user1', { sesionId: 's1', fecha: DIA(2026, 6, 10) })
    const escrito = mockSetDoc.mock.calls[0][1]
    expect(escrito.diasEntrenados).toEqual([E(2026, 6, 10)])
  })

  it('no hace nada si el agregado no existe', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    await removerSesionDeResumenGlobal('user1', { sesionId: 's1', fecha: DIA(2026, 6, 10) })
    expect(mockSetDoc).not.toHaveBeenCalled()
  })
})
