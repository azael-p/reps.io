vi.mock('./config', () => ({ db: {} }))

const mockAddDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockServerTimestamp = vi.fn(() => 'SERVER_TS')

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  addDoc: (...args) => mockAddDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  doc: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  query: vi.fn((col) => col),
  where: vi.fn(),
  getDocs: (...args) => mockGetDocs(...args),
  serverTimestamp: () => mockServerTimestamp(),
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { getPresets, savePreset, deletePreset } from './timerPresets'

const makeSnap = (docs) => ({ docs, size: docs.length })
const makeDoc = (id, data) => ({ id, data: () => data })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getPresets', () => {
  it('devuelve array vacío si no hay presets', async () => {
    mockGetDocs.mockResolvedValue(makeSnap([]))
    const result = await getPresets('uid1')
    expect(result).toEqual([])
  })

  it('devuelve los presets del usuario ordenados por fecha', async () => {
    const ts = (ms) => ({ toMillis: () => ms })
    mockGetDocs.mockResolvedValue(makeSnap([
      makeDoc('p2', { nombre: 'B', sets: 8, creadoEn: ts(2000) }),
      makeDoc('p1', { nombre: 'A', sets: 4, creadoEn: ts(1000) }),
    ]))
    const result = await getPresets('uid1')
    expect(result).toHaveLength(2)
    expect(result[0].nombre).toBe('A')
    expect(result[1].nombre).toBe('B')
  })
})

describe('savePreset', () => {
  it('guarda correctamente en Firestore cuando hay menos de 5 presets', async () => {
    mockGetDocs.mockResolvedValue(makeSnap([makeDoc('p1', {})]))
    mockAddDoc.mockResolvedValue({ id: 'nuevo' })
    await savePreset('uid1', { nombre: 'Test', sets: 8, trabajo: 40, descanso: 20, calentamiento: 300, enfriamiento: 300 })
    expect(mockAddDoc).toHaveBeenCalledTimes(1)
  })

  it('lanza error si ya hay 5 presets', async () => {
    const docs = Array.from({ length: 5 }, (_, i) => makeDoc(`p${i}`, {}))
    mockGetDocs.mockResolvedValue(makeSnap(docs))
    await expect(savePreset('uid1', { nombre: 'Extra' })).rejects.toThrow('Máximo 5 presets')
    expect(mockAddDoc).not.toHaveBeenCalled()
  })
})

describe('deletePreset', () => {
  it('llama deleteDoc con la ref correcta', async () => {
    mockDeleteDoc.mockResolvedValue()
    await deletePreset('uid1', 'preset123')
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })
})
