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
import { addDoc, getDocs, writeBatch } from 'firebase/firestore'
import { crearPrograma, eliminarPrograma, reordenarProgramas } from './programas'

beforeEach(() => {
  vi.clearAllMocks()
  mockBatch.delete.mockClear()
  mockBatch.update.mockClear()
  mockBatch.commit.mockClear().mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------

describe('crearPrograma', () => {
  it('llama a addDoc con orden basado en Date.now()', async () => {
    const fakeRef = { id: 'prog1' }
    addDoc.mockResolvedValue(fakeRef)

    const before = Date.now()
    const id = await crearPrograma('user1', 'Push Day')
    const after = Date.now()

    expect(addDoc).toHaveBeenCalledOnce()
    const [, payload] = addDoc.mock.calls[0]
    expect(payload.usuarioId).toBe('user1')
    expect(payload.nombre).toBe('Push Day')
    expect(payload.orden).toBeGreaterThanOrEqual(before)
    expect(payload.orden).toBeLessThanOrEqual(after)
    expect(id).toBe('prog1')
  })

  it('no hace getDocs para calcular el orden', async () => {
    addDoc.mockResolvedValue({ id: 'x' })
    await crearPrograma('user1', 'Test')
    expect(getDocs).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('eliminarPrograma', () => {
  it('usa writeBatch para borrar ejercicios, días y programa en una sola operación', async () => {
    const ejDoc1 = { ref: { _id: 'ej1' } }
    const ejDoc2 = { ref: { _id: 'ej2' } }
    const diaDoc = { id: 'dia1', ref: { _id: 'dia1' } }

    getDocs
      .mockResolvedValueOnce({ docs: [diaDoc] })
      .mockResolvedValueOnce({ docs: [ejDoc1, ejDoc2] })

    await eliminarPrograma('prog1')

    expect(writeBatch).toHaveBeenCalledOnce()
    expect(mockBatch.delete).toHaveBeenCalledTimes(4) // ej1 + ej2 + dia1 + prog1
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })

  it('borra el programa aunque no tenga días', async () => {
    getDocs.mockResolvedValueOnce({ docs: [] })

    await eliminarPrograma('prog-vacio')

    expect(mockBatch.delete).toHaveBeenCalledTimes(1) // solo el programa
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------

describe('reordenarProgramas', () => {
  it('actualiza el orden de cada programa en batch', async () => {
    const items = [
      { id: 'p1', orden: 1 },
      { id: 'p2', orden: 2 },
      { id: 'p3', orden: 3 },
    ]
    await reordenarProgramas(items)

    expect(writeBatch).toHaveBeenCalledOnce()
    expect(mockBatch.update).toHaveBeenCalledTimes(3)
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })

  it('no hace nada con lista vacía', async () => {
    await reordenarProgramas([])
    expect(mockBatch.update).not.toHaveBeenCalled()
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })
})
