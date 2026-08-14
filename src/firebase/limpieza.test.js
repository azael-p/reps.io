vi.mock('./config', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, col) => ({ _col: col })),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  getDocs: vi.fn(),
}))

vi.mock('./programas', () => ({ eliminarProgramaDefinitivo: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./dias', () => ({ eliminarDiaDefinitivo: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./ejerciciosDia', () => ({ eliminarEjercicioDefinitivo: vi.fn().mockResolvedValue(undefined) }))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDocs } from 'firebase/firestore'
import { eliminarProgramaDefinitivo } from './programas'
import { eliminarDiaDefinitivo } from './dias'
import { eliminarEjercicioDefinitivo } from './ejerciciosDia'
import { limpiarEliminadosDefinitivamente } from './limpieza'

const UMBRAL_MS = 10 * 60 * 1000

function fakeSnap(docs) {
  return { docs: docs.map(data => ({ id: data.id, data: () => data })) }
}

beforeEach(() => {
  vi.clearAllMocks()
  getDocs.mockResolvedValue(fakeSnap([]))
})

describe('limpiarEliminadosDefinitivamente', () => {
  it('no borra nada si las 3 colecciones vienen vacías', async () => {
    await limpiarEliminadosDefinitivamente('user1')

    expect(getDocs).toHaveBeenCalledTimes(3)
    expect(eliminarProgramaDefinitivo).not.toHaveBeenCalled()
    expect(eliminarDiaDefinitivo).not.toHaveBeenCalled()
    expect(eliminarEjercicioDefinitivo).not.toHaveBeenCalled()
  })

  it('no borra un doc cuyo eliminadoEn está dentro del umbral de undo', async () => {
    const reciente = Date.now() - 1000
    getDocs
      .mockResolvedValueOnce(fakeSnap([{ id: 'p1', eliminadoEn: reciente }]))
      .mockResolvedValueOnce(fakeSnap([]))
      .mockResolvedValueOnce(fakeSnap([]))

    await limpiarEliminadosDefinitivamente('user1')

    expect(eliminarProgramaDefinitivo).not.toHaveBeenCalled()
  })

  it('borra un programa cuyo eliminadoEn venció el umbral', async () => {
    const vencido = Date.now() - UMBRAL_MS - 1000
    getDocs
      .mockResolvedValueOnce(fakeSnap([{ id: 'p1', eliminadoEn: vencido }]))
      .mockResolvedValueOnce(fakeSnap([]))
      .mockResolvedValueOnce(fakeSnap([]))

    await limpiarEliminadosDefinitivamente('user1')

    expect(eliminarProgramaDefinitivo).toHaveBeenCalledWith('p1')
  })

  it('borra un día y un ejercicio vencidos en sus colecciones respectivas', async () => {
    const vencido = Date.now() - UMBRAL_MS - 1000
    getDocs
      .mockResolvedValueOnce(fakeSnap([]))
      .mockResolvedValueOnce(fakeSnap([{ id: 'd1', eliminadoEn: vencido }]))
      .mockResolvedValueOnce(fakeSnap([{ id: 'e1', eliminadoEn: vencido }]))

    await limpiarEliminadosDefinitivamente('user1')

    expect(eliminarDiaDefinitivo).toHaveBeenCalledWith('d1')
    expect(eliminarEjercicioDefinitivo).toHaveBeenCalledWith('e1')
  })

  it('consulta las 3 colecciones filtrando por eliminadoEn > 0, sin traer docs sin soft-delete', async () => {
    // La query en sí (where('eliminadoEn', '>', 0)) es la que excluye los
    // docs sin el campo en Firestore real; acá solo verificamos que se arma
    // la query con esos filtros para las 3 colecciones.
    await limpiarEliminadosDefinitivamente('user1')

    const { collection, where } = await import('firebase/firestore')
    expect(collection).toHaveBeenCalledWith({}, 'programas')
    expect(collection).toHaveBeenCalledWith({}, 'dias')
    expect(collection).toHaveBeenCalledWith({}, 'ejerciciosDia')
    expect(where).toHaveBeenCalledWith('usuarioId', '==', 'user1')
    expect(where).toHaveBeenCalledWith('eliminadoEn', '>', 0)
  })
})
