vi.mock('./config', () => ({ db: {}, auth: { currentUser: { uid: 'test-uid' } } }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  doc: vi.fn(() => ({ id: 'r1' })),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}))

import { describe, it, expect, vi } from 'vitest'
import { setDoc } from 'firebase/firestore'
import { agregarRegistro } from './registros'

describe('agregarRegistro', () => {
  it('incluye catalogoId en el documento (null si no se pasa), y devuelve el id de forma síncrona', () => {
    setDoc.mockResolvedValue(undefined)
    const { id, listo } = agregarRegistro({
      sesionId: 's1', ejercicioId: 'ed1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho',
      numeroSerie: 1, repsEsperadas: 8, repsHechas: 8, pesoUsado: 80, nota: '',
    })
    expect(id).toBe('r1')
    expect(listo).toBeInstanceOf(Promise)
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ catalogoId: null }))
  })

  it('escribe el catalogoId recibido', () => {
    setDoc.mockResolvedValue(undefined)
    agregarRegistro({
      sesionId: 's1', ejercicioId: 'ed1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho',
      catalogoId: 'press-banca-plano',
      numeroSerie: 1, repsEsperadas: 8, repsHechas: 8, pesoUsado: 80, nota: '',
    })
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ catalogoId: 'press-banca-plano' }))
  })
})
