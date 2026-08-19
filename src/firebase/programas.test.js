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
  getDoc: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addDoc, getDocs, getDoc, writeBatch, where } from 'firebase/firestore'
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

  it('con varios días, hace una sola query "in" para ejerciciosDia en vez de una por día', async () => {
    const diaDoc1 = { id: 'dia1', ref: { _id: 'dia1' } }
    const diaDoc2 = { id: 'dia2', ref: { _id: 'dia2' } }
    const diaDoc3 = { id: 'dia3', ref: { _id: 'dia3' } }
    const ejDoc1 = { ref: { _id: 'ej1' } }
    const ejDoc2 = { ref: { _id: 'ej2' } }

    getDocs
      .mockResolvedValueOnce({ docs: [diaDoc1, diaDoc2, diaDoc3] })
      .mockResolvedValueOnce({ docs: [ejDoc1, ejDoc2] })

    await eliminarPrograma('prog1')

    // 1 query para días + 1 sola query "in" para ejerciciosDia (no 3, una por día)
    expect(getDocs).toHaveBeenCalledTimes(2)
    const [, , diaIdFiltro] = where.mock.calls[where.mock.calls.length - 1]
    expect(diaIdFiltro).toEqual(['dia1', 'dia2', 'dia3'])
    expect(mockBatch.delete).toHaveBeenCalledTimes(6) // ej1 + ej2 + dia1 + dia2 + dia3 + prog1
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
  const mkDia = (id, data = {}) => ({ id, ref: { _id: id }, data: () => data })

  it('marcar setea eliminadoEn con el mismo timestamp en el programa y sus días activos', async () => {
    const dia1 = mkDia('dia1')
    const dia2 = mkDia('dia2')
    getDocs.mockResolvedValueOnce({ docs: [dia1, dia2] })

    const before = Date.now()
    await marcarParaEliminar('prog1')
    const after = Date.now()

    expect(writeBatch).toHaveBeenCalledOnce()
    const programaUpdate = mockBatch.update.mock.calls.find(([ref]) => ref._id === 'prog1')[1]
    expect(programaUpdate.eliminadoEn).toBeGreaterThanOrEqual(before)
    expect(programaUpdate.eliminadoEn).toBeLessThanOrEqual(after)

    const dia1Update = mockBatch.update.mock.calls.find(([ref]) => ref === dia1.ref)[1]
    const dia2Update = mockBatch.update.mock.calls.find(([ref]) => ref === dia2.ref)[1]
    expect(dia1Update.eliminadoEn).toBe(programaUpdate.eliminadoEn)
    expect(dia2Update.eliminadoEn).toBe(programaUpdate.eliminadoEn)
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })

  it('marcar no pisa el eliminadoEn de un día ya eliminado individualmente antes', async () => {
    const diaYaEliminado = mkDia('dia1', { eliminadoEn: 111 })
    getDocs.mockResolvedValueOnce({ docs: [diaYaEliminado] })

    await marcarParaEliminar('prog1')

    expect(mockBatch.update.mock.calls.some(([ref]) => ref === diaYaEliminado.ref)).toBe(false)
    // solo se actualiza el programa
    expect(mockBatch.update).toHaveBeenCalledTimes(1)
  })

  it('desmarcar restaura el programa y solo los días marcados en la misma cascada', async () => {
    const diaDeLaCascada = mkDia('dia1', { eliminadoEn: 500 })
    const diaEliminadoAntes = mkDia('dia2', { eliminadoEn: 999 })
    getDoc.mockResolvedValueOnce({ data: () => ({ eliminadoEn: 500 }) })
    getDocs.mockResolvedValueOnce({ docs: [diaDeLaCascada, diaEliminadoAntes] })

    await desmarcarParaEliminar('prog1')

    const programaUpdate = mockBatch.update.mock.calls.find(([ref]) => ref._id === 'prog1')[1]
    expect(programaUpdate.eliminadoEn).toBe('__DELETE__')
    const dia1Update = mockBatch.update.mock.calls.find(([ref]) => ref === diaDeLaCascada.ref)
    expect(dia1Update[1].eliminadoEn).toBe('__DELETE__')
    expect(mockBatch.update.mock.calls.some(([ref]) => ref === diaEliminadoAntes.ref)).toBe(false)
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })
})
