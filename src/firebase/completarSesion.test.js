vi.mock('./config', () => ({ db: {} }))

const mockBatchCommit = vi.fn()
const mockBatch = { __isBatch: true, commit: mockBatchCommit }

vi.mock('firebase/firestore', () => ({
  writeBatch: () => mockBatch,
}))

vi.mock('./sesiones', () => ({ completarSesion: vi.fn() }))
vi.mock('./statsGlobal', () => ({ agregarSesionAResumenGlobalBlind: vi.fn() }))
vi.mock('./statsEjercicios', () => ({ aplicarSesionAStats: vi.fn() }))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { completarSesionConAgregados } from './completarSesion'
import { completarSesion } from './sesiones'
import { agregarSesionAResumenGlobalBlind } from './statsGlobal'
import { aplicarSesionAStats } from './statsEjercicios'

beforeEach(() => {
  vi.clearAllMocks()
  mockBatchCommit.mockResolvedValue(undefined)
  aplicarSesionAStats.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------

describe('completarSesionConAgregados', () => {
  it('arma un único batch compartido entre los 3 helpers y lo comitea una sola vez', async () => {
    const fecha = new Date()
    const resumen = { volumenTotal: 100, ejercicios: [] }

    await completarSesionConAgregados('ses1', { usuarioId: 'user1', fecha, resumen })

    expect(completarSesion).toHaveBeenCalledWith('ses1', resumen, mockBatch)
    expect(agregarSesionAResumenGlobalBlind).toHaveBeenCalledWith(mockBatch, 'user1', { sesionId: 'ses1', fecha, resumen })
    expect(aplicarSesionAStats).toHaveBeenCalledWith('user1', { sesionId: 'ses1', fecha, resumen }, mockBatch)
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('sin usuarioId, solo completa la sesión (sin tocar los agregados) y comitea igual', async () => {
    await completarSesionConAgregados('ses1', { usuarioId: undefined, fecha: new Date(), resumen: {} })

    expect(completarSesion).toHaveBeenCalled()
    expect(agregarSesionAResumenGlobalBlind).not.toHaveBeenCalled()
    expect(aplicarSesionAStats).not.toHaveBeenCalled()
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('no bloquea si el commit del batch nunca resuelve (sin red): la función no espera el ACK antes de retornar', async () => {
    mockBatchCommit.mockReturnValue(new Promise(() => {})) // simula ACK que nunca llega
    const resultado = completarSesionConAgregados('ses1', { usuarioId: 'user1', fecha: new Date(), resumen: { ejercicios: [] } })

    const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 50))
    const r = await Promise.race([resultado, timeout])
    expect(r).toBe('timeout')
    // Y sin embargo el batch ya se armó por completo antes de ese punto:
    expect(completarSesion).toHaveBeenCalled()
    expect(agregarSesionAResumenGlobalBlind).toHaveBeenCalled()
  })
})
