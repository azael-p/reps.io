vi.mock('./config', () => ({ db: {}, auth: { currentUser: { uid: 'test-uid' } } }))

const mockBatch = {
  delete: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-ej' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  deleteField: vi.fn(() => '__DELETE__'),
  doc: vi.fn((_, col, id) => ({ _col: col, _id: id })),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDocs, addDoc, updateDoc, deleteDoc, where } from 'firebase/firestore'
import {
  getEjerciciosDia,
  agregarEjercicioDia,
  marcarEjercicioParaEliminar,
  desmarcarEjercicioParaEliminar,
  eliminarEjercicioDefinitivo,
  reordenarEjercicios,
} from './ejerciciosDia'

beforeEach(() => {
  vi.clearAllMocks()
  mockBatch.delete.mockClear()
  mockBatch.update.mockClear()
  mockBatch.commit.mockClear().mockResolvedValue(undefined)
})

const mkDoc = (id, data) => ({ id, ref: { _id: id }, data: () => data })

// ---------------------------------------------------------------------------

describe('getEjerciciosDia', () => {
  it('filtra ejercicios con eliminadoEn y ordena por orden', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        mkDoc('e1', { nombre: 'Press', orden: 2, eliminadoEn: null }),
        mkDoc('e2', { nombre: 'Curl',  orden: 1 }),
        mkDoc('e3', { nombre: 'Remo',  orden: 3, eliminadoEn: 123456 }),
      ],
    })
    const result = await getEjerciciosDia('dia1')
    expect(result.map(e => e.id)).toEqual(['e2', 'e1'])
    expect(result.find(e => e.id === 'e3')).toBeUndefined()
  })

  it('retorna array vacío si todos están eliminados', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [mkDoc('e1', { eliminadoEn: 1 }), mkDoc('e2', { eliminadoEn: 2 })],
    })
    expect(await getEjerciciosDia('dia1')).toEqual([])
  })

  it('filtra por diaId correcto', async () => {
    getDocs.mockResolvedValueOnce({ docs: [] })
    await getEjerciciosDia('dia-target')
    expect(where).toHaveBeenCalledWith('diaId', '==', 'dia-target')
  })
})

// ---------------------------------------------------------------------------

describe('agregarEjercicioDia', () => {
  it('llama a addDoc con todos los campos requeridos', async () => {
    const id = await agregarEjercicioDia({
      diaId: 'd1', nombre: 'Sentadilla', grupoMuscular: 'Piernas',
      esCustom: false, seriesEsperadas: 4, repsEsperadas: 8, orden: 0,
    })
    expect(addDoc).toHaveBeenCalledOnce()
    const [, payload] = addDoc.mock.calls[0]
    expect(payload.nombre).toBe('Sentadilla')
    expect(payload.seriesEsperadas).toBe(4)
    expect(id).toBe('new-ej')
  })
})

// ---------------------------------------------------------------------------

describe('marcarEjercicioParaEliminar / desmarcarEjercicioParaEliminar', () => {
  it('marcar setea eliminadoEn con un timestamp', async () => {
    await marcarEjercicioParaEliminar('ej1')
    const [, update] = updateDoc.mock.calls[0]
    expect(typeof update.eliminadoEn).toBe('number')
    expect(update.eliminadoEn).toBeGreaterThan(0)
  })

  it('desmarcar envía deleteField', async () => {
    await desmarcarEjercicioParaEliminar('ej1')
    const [, update] = updateDoc.mock.calls[0]
    expect(update.eliminadoEn).toBe('__DELETE__')
  })
})

// ---------------------------------------------------------------------------

describe('eliminarEjercicioDefinitivo', () => {
  it('llama a deleteDoc con el id correcto', async () => {
    await eliminarEjercicioDefinitivo('ej-abc')
    expect(deleteDoc).toHaveBeenCalledOnce()
    const [ref] = deleteDoc.mock.calls[0]
    expect(ref._id).toBe('ej-abc')
  })
})

// ---------------------------------------------------------------------------

describe('reordenarEjercicios', () => {
  it('actualiza el orden de cada ejercicio en batch', async () => {
    await reordenarEjercicios([{ id: 'e1', orden: 0 }, { id: 'e2', orden: 1 }])
    expect(mockBatch.update).toHaveBeenCalledTimes(2)
    expect(mockBatch.commit).toHaveBeenCalledOnce()
  })
})
