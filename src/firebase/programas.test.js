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
import { addDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore'
import { getProgramas, crearPrograma, marcarParaEliminar, desmarcarParaEliminar, eliminarProgramaDefinitivo as eliminarPrograma, reordenarProgramas } from './programas'

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

// ---------------------------------------------------------------------------

describe('getProgramas — soft-delete filter', () => {
  const mkDoc = (id, data) => ({ id, data: () => data })

  it('excluye programas con eliminadoEn', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        mkDoc('p1', { nombre: 'PPL', orden: 1 }),
        mkDoc('p2', { nombre: 'Borrado', orden: 2, eliminadoEn: Date.now() }),
      ],
    })
    const result = await getProgramas('user1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })

  it('retorna todos cuando ninguno está eliminado', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        mkDoc('p1', { nombre: 'A', orden: 1 }),
        mkDoc('p2', { nombre: 'B', orden: 2 }),
      ],
    })
    expect(await getProgramas('user1')).toHaveLength(2)
  })

  it('ordena por campo orden ascendente', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        mkDoc('p2', { nombre: 'B', orden: 2 }),
        mkDoc('p1', { nombre: 'A', orden: 1 }),
      ],
    })
    const result = await getProgramas('user1')
    expect(result[0].id).toBe('p1')
    expect(result[1].id).toBe('p2')
  })
})

// ---------------------------------------------------------------------------

describe('marcarParaEliminar / desmarcarParaEliminar', () => {
  it('marcar setea eliminadoEn con un timestamp', async () => {
    const before = Date.now()
    await marcarParaEliminar('prog1')
    const [, update] = updateDoc.mock.calls[0]
    expect(update.eliminadoEn).toBeGreaterThanOrEqual(before)
  })

  it('desmarcar envía deleteField', async () => {
    await desmarcarParaEliminar('prog1')
    const [, update] = updateDoc.mock.calls[0]
    expect(update.eliminadoEn).toBe('__DELETE__')
  })
})
