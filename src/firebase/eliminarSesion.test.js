vi.mock('./config', () => ({ db: {} }))

const mockBatchCommit = vi.fn()
const mockBatch = { __isBatch: true, commit: mockBatchCommit }

vi.mock('firebase/firestore', () => ({
  writeBatch: () => mockBatch,
}))

vi.mock('./sesiones', () => ({ eliminarSesion: vi.fn() }))
vi.mock('./statsGlobal', () => ({ removerSesionDeResumenGlobal: vi.fn() }))
vi.mock('./statsEjercicios', () => ({ rebuildStatsEjercicios: vi.fn() }))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { eliminarSesionConAgregados } from './eliminarSesion'
import { eliminarSesion } from './sesiones'
import { removerSesionDeResumenGlobal } from './statsGlobal'
import { rebuildStatsEjercicios } from './statsEjercicios'

beforeEach(() => {
  vi.clearAllMocks()
  mockBatchCommit.mockResolvedValue(undefined)
  eliminarSesion.mockResolvedValue(undefined)
  removerSesionDeResumenGlobal.mockResolvedValue(undefined)
  rebuildStatsEjercicios.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------

describe('eliminarSesionConAgregados', () => {
  it('arma un único batch compartido entre los 3 helpers y lo comitea una sola vez', async () => {
    const fecha = new Date()
    const ejercicios = [{ catalogoId: 'press' }]

    await eliminarSesionConAgregados('ses1', { usuarioId: 'user1', fecha, ejercicios })

    expect(eliminarSesion).toHaveBeenCalledWith('ses1', mockBatch)
    expect(removerSesionDeResumenGlobal).toHaveBeenCalledWith('user1', { sesionId: 'ses1', fecha }, mockBatch)
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('excluye la sesión que se está borrando del historial usado para reconstruir statsEjercicios', async () => {
    await eliminarSesionConAgregados('ses1', { usuarioId: 'user1', fecha: new Date(), ejercicios: [{ catalogoId: 'press' }] })

    expect(rebuildStatsEjercicios).toHaveBeenCalledWith(
      'user1',
      [{ catalogoId: 'press' }],
      mockBatch,
      { excluirSesionId: 'ses1' },
    )
  })

  it('sin usuarioId, solo borra la sesión (sin tocar los agregados) y comitea igual', async () => {
    await eliminarSesionConAgregados('ses1', { usuarioId: undefined, fecha: new Date(), ejercicios: [] })

    expect(eliminarSesion).toHaveBeenCalledWith('ses1', mockBatch)
    expect(removerSesionDeResumenGlobal).not.toHaveBeenCalled()
    expect(rebuildStatsEjercicios).not.toHaveBeenCalled()
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('sin ejercicios, igual reconstruye statsEjercicios con lista vacía', async () => {
    await eliminarSesionConAgregados('ses1', { usuarioId: 'user1', fecha: new Date(), ejercicios: undefined })

    expect(rebuildStatsEjercicios).toHaveBeenCalledWith('user1', [], mockBatch, { excluirSesionId: 'ses1' })
  })
})
