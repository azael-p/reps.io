vi.mock('./config', () => ({ db: {} }))

const mockAddDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  addDoc: (...args) => mockAddDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: vi.fn((col) => col),
  orderBy: vi.fn(),
  serverTimestamp: () => 'SERVER_TS',
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { agregarPeso, getHistorialPeso } from './peso'

const makeDoc = (id, data) => ({ id, data: () => data })

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------

describe('agregarPeso', () => {
  it('guarda el peso con un timestamp de servidor', async () => {
    mockAddDoc.mockResolvedValue({ id: 'nuevo' })

    await agregarPeso('user1', 78)

    expect(mockAddDoc).toHaveBeenCalledWith(
      { path: 'usuarios/user1/historialPeso' },
      { peso: 78, fecha: 'SERVER_TS' },
    )
  })
})

// ---------------------------------------------------------------------------

describe('getHistorialPeso', () => {
  it('devuelve array vacío si no hay registros', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    expect(await getHistorialPeso('user1')).toEqual([])
  })

  it('mapea id, peso y fecha convertida desde el Timestamp', async () => {
    const toDate = () => new Date(2026, 4, 20)
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc('r1', { peso: 80, fecha: { toDate } })],
    })

    const result = await getHistorialPeso('user1')

    expect(result).toEqual([{ id: 'r1', peso: 80, fecha: toDate() }])
  })

  it('si falta la fecha, usa la fecha actual como fallback', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc('r1', { peso: 80, fecha: null })],
    })

    const before = Date.now()
    const result = await getHistorialPeso('user1')
    const after = Date.now()

    expect(result[0].fecha.getTime()).toBeGreaterThanOrEqual(before)
    expect(result[0].fecha.getTime()).toBeLessThanOrEqual(after)
  })
})
