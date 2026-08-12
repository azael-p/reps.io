vi.mock('./config', () => ({ db: {}, auth: { currentUser: { uid: 'test-uid' } } }))

const mockBatch = {
  delete: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteField: vi.fn(() => '__DELETE__'),
  doc: vi.fn((_, col, id) => ({ _col: col, _id: id })),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDocs, updateDoc, writeBatch } from 'firebase/firestore'
import { getDias, marcarDiaParaEliminar, desmarcarDiaParaEliminar, eliminarDiaDefinitivo as eliminarDia } from './dias'

beforeEach(() => {
  vi.clearAllMocks()
  mockBatch.delete.mockClear()
  mockBatch.update.mockClear()
  mockBatch.commit.mockClear().mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------

describe('eliminarDia', () => {
  it('borra ejerciciosDia en cascade y el día en el mismo batch', async () => {
    const ej1 = { ref: { _id: 'ej1' } }
    const ej2 = { ref: { _id: 'ej2' } }
    getDocs.mockResolvedValueOnce({ docs: [ej1, ej2] })

    await eliminarDia('dia1')

    expect(writeBatch).toHaveBeenCalledOnce()
    expect(mockBatch.delete).toHaveBeenCalledTimes(3) // ej1 + ej2 + dia1
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })

  it('borra el día aunque no tenga ejerciciosDia', async () => {
    getDocs.mockResolvedValueOnce({ docs: [] })

    await eliminarDia('dia-vacio')

    expect(writeBatch).toHaveBeenCalledOnce()
    expect(mockBatch.delete).toHaveBeenCalledTimes(1) // solo el día
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })

  it('busca ejerciciosDia filtrando por el diaId correcto', async () => {
    const { where } = await import('firebase/firestore')
    getDocs.mockResolvedValueOnce({ docs: [] })

    await eliminarDia('dia-target')

    expect(where).toHaveBeenCalledWith('diaId', '==', 'dia-target')
  })
})

// ---------------------------------------------------------------------------

describe('getDias — soft-delete filter', () => {
  const mkDoc = (id, data) => ({ id, data: () => data })

  it('excluye días con eliminadoEn', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        mkDoc('d1', { nombre: 'Lunes', orden: 1 }),
        mkDoc('d2', { nombre: 'Borrado', orden: 2, eliminadoEn: 123 }),
      ],
    })
    const result = await getDias('prog1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('d1')
  })

  it('ordena por orden ascendente', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        mkDoc('d2', { nombre: 'B', orden: 2 }),
        mkDoc('d1', { nombre: 'A', orden: 1 }),
      ],
    })
    const result = await getDias('prog1')
    expect(result[0].id).toBe('d1')
  })
})

// ---------------------------------------------------------------------------

describe('marcarDiaParaEliminar / desmarcarDiaParaEliminar', () => {
  it('marcar setea eliminadoEn con un timestamp', async () => {
    const before = Date.now()
    await marcarDiaParaEliminar('dia1')
    const [, update] = updateDoc.mock.calls[0]
    expect(update.eliminadoEn).toBeGreaterThanOrEqual(before)
  })

  it('desmarcar envía deleteField', async () => {
    await desmarcarDiaParaEliminar('dia1')
    const [, update] = updateDoc.mock.calls[0]
    expect(update.eliminadoEn).toBe('__DELETE__')
  })
})
