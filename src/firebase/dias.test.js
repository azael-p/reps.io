vi.mock('./config', () => ({ db: {} }))

const mockBatch = {
  delete: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn((_, col, id) => ({ _col: col, _id: id })),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDocs, writeBatch } from 'firebase/firestore'
import { eliminarDiaDefinitivo as eliminarDia } from './dias'

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
