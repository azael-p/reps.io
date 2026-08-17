vi.mock('./config', () => ({ db: {}, auth: { currentUser: { uid: 'test-uid' } } }))
const mockGetDocs = vi.fn()
const mockWriteBatch = vi.fn()
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  getDoc: vi.fn(),
  query: vi.fn((col, ...restricciones) => ({ col, restricciones })),
  where: vi.fn((...args) => ({ type: 'where', args })),
  orderBy: vi.fn((...args) => ({ type: 'orderBy', args })),
  limit: vi.fn((n) => ({ type: 'limit', n })),
  startAfter: vi.fn((doc) => ({ type: 'startAfter', doc })),
  getDocs: (...args) => mockGetDocs(...args),
  writeBatch: (...args) => mockWriteBatch(...args),
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  esMismoEjercicio,
  getSesionesPaginadas,
  eliminarSesion,
} from './sesiones'

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

describe('eliminarSesion', () => {
  const registrosDocs = [{ ref: { path: 'registros/r1' } }, { ref: { path: 'registros/r2' } }]

  beforeEach(() => {
    mockGetDocs.mockResolvedValue({ docs: registrosDocs })
    mockWriteBatch.mockClear()
  })

  it('sin batch externo, borra los registros y la sesión en un batch propio y lo comitea', async () => {
    const own = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }
    mockWriteBatch.mockReturnValue(own)

    await eliminarSesion('ses1')

    expect(own.delete).toHaveBeenCalledTimes(3) // 2 registros + la sesión
    expect(own.commit).toHaveBeenCalledOnce()
  })

  it('con batch externo, agrega los deletes a ese batch y no comitea', async () => {
    const externo = { delete: vi.fn(), commit: vi.fn() }

    await eliminarSesion('ses1', externo)

    expect(externo.delete).toHaveBeenCalledTimes(3)
    expect(externo.commit).not.toHaveBeenCalled()
    expect(mockWriteBatch).not.toHaveBeenCalled()
  })
})
