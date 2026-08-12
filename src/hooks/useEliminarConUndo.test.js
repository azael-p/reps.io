vi.mock('../components/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
const mockShow = vi.hoisted(() => vi.fn())

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEliminarConUndo } from './useEliminarConUndo'

function setup(overrides = {}) {
  const deps = {
    marcar: vi.fn().mockResolvedValue(),
    desmarcar: vi.fn().mockResolvedValue(),
    eliminarDefinitivo: vi.fn().mockResolvedValue(),
    ...overrides,
  }
  const { result } = renderHook(() => useEliminarConUndo(deps))
  return { eliminar: result.current, ...deps }
}

beforeEach(() => { vi.clearAllMocks() })

// ---------------------------------------------------------------------------

describe('useEliminarConUndo — marcar exitoso', () => {
  it('llama a onOptimista y muestra el toast con acción Deshacer', async () => {
    const { eliminar, marcar } = setup()
    const onOptimista = vi.fn()
    await act(async () => {
      await eliminar({ id: 'p1' }, { mensaje: '"Push" eliminado', onOptimista })
    })
    expect(marcar).toHaveBeenCalledWith('p1')
    expect(onOptimista).toHaveBeenCalledOnce()
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      message: '"Push" eliminado',
      duration: 5000,
      action: expect.objectContaining({ label: 'Deshacer' }),
    }))
  })
})

describe('useEliminarConUndo — falla marcar', () => {
  it('muestra toast de error y NO llama a onOptimista ni muestra el toast de undo', async () => {
    const { eliminar, marcar } = setup({ marcar: vi.fn().mockRejectedValue(new Error('offline')) })
    const onOptimista = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      await eliminar({ id: 'p1' }, { mensaje: 'x', onOptimista })
    })
    expect(marcar).toHaveBeenCalled()
    expect(onOptimista).not.toHaveBeenCalled()
    expect(mockShow).toHaveBeenCalledTimes(1)
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    consoleError.mockRestore()
  })
})

describe('useEliminarConUndo — acción Deshacer', () => {
  it('llama a desmarcar y a onRecargar', async () => {
    const { eliminar, desmarcar } = setup()
    const onRecargar = vi.fn()
    await act(async () => {
      await eliminar({ id: 'p1' }, { mensaje: 'x', onRecargar })
    })
    const { onClick } = mockShow.mock.calls[0][0].action
    await act(async () => { await onClick() })
    expect(desmarcar).toHaveBeenCalledWith('p1')
    expect(onRecargar).toHaveBeenCalledOnce()
  })

  it('si desmarcar falla, muestra toast de error pero igual llama a onRecargar', async () => {
    const { eliminar } = setup({ desmarcar: vi.fn().mockRejectedValue(new Error('offline')) })
    const onRecargar = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      await eliminar({ id: 'p1' }, { mensaje: 'x', onRecargar })
    })
    const { onClick } = mockShow.mock.calls[0][0].action
    await act(async () => { await onClick() })
    expect(mockShow).toHaveBeenLastCalledWith(expect.objectContaining({ variant: 'error' }))
    expect(onRecargar).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})

describe('useEliminarConUndo — onTimeout', () => {
  it('se configura para llamar a eliminarDefinitivo con el id', async () => {
    const { eliminar, eliminarDefinitivo } = setup()
    await act(async () => {
      await eliminar({ id: 'p1' }, { mensaje: 'x' })
    })
    const { onTimeout } = mockShow.mock.calls[0][0]
    onTimeout()
    expect(eliminarDefinitivo).toHaveBeenCalledWith('p1')
  })
})
