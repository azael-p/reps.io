import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWakeLock } from './useWakeLock'

function stubWakeLock(requestImpl) {
  Object.defineProperty(navigator, 'wakeLock', {
    writable: true, configurable: true,
    value: { request: vi.fn(requestImpl) },
  })
}

function removeWakeLockApi() {
  delete navigator.wakeLock
}

beforeEach(() => {
  HTMLMediaElement.prototype.play.mockClear().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  stubWakeLock(() => Promise.resolve({ release: vi.fn().mockResolvedValue(undefined) }))
})

// ---------------------------------------------------------------------------

describe('useWakeLock — activar()', () => {
  it('usa la WakeLock API cuando está disponible y no recurre al audio de respaldo', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    stubWakeLock(() => Promise.resolve({ release }))
    const { result } = renderHook(() => useWakeLock())

    await act(async () => { await result.current.activar() })

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen')
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('si la WakeLock API falla (ej. permiso denegado), recurre al audio silencioso', async () => {
    stubWakeLock(() => Promise.reject(new Error('not allowed')))
    const { result } = renderHook(() => useWakeLock())

    await act(async () => { await result.current.activar() })

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  })

  it('si el navegador no soporta la WakeLock API (ej. Safari/iOS), usa el audio directamente', async () => {
    removeWakeLockApi()
    const { result } = renderHook(() => useWakeLock())

    await act(async () => { await result.current.activar() })

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  })

  it('reutiliza la misma instancia de Audio en llamadas sucesivas (no crea una nueva cada vez)', async () => {
    removeWakeLockApi()
    const audioSpy = vi.spyOn(globalThis, 'Audio')
    const { result } = renderHook(() => useWakeLock())

    await act(async () => { await result.current.activar() })
    await act(async () => { await result.current.activar() })

    expect(audioSpy).toHaveBeenCalledTimes(1)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  })

  it('si el audio de respaldo también falla al reproducir, no lanza (queda silenciado)', async () => {
    removeWakeLockApi()
    HTMLMediaElement.prototype.play.mockRejectedValue(new Error('autoplay blocked'))
    const { result } = renderHook(() => useWakeLock())

    await expect(act(async () => { await result.current.activar() })).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------

describe('useWakeLock — liberar()', () => {
  it('libera el wake lock sentinel activo', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    stubWakeLock(() => Promise.resolve({ release }))
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.activar() })

    act(() => { result.current.liberar() })

    expect(release).toHaveBeenCalledTimes(1)
  })

  it('llamar liberar() dos veces no libera el sentinel dos veces', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    stubWakeLock(() => Promise.resolve({ release }))
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.activar() })

    act(() => { result.current.liberar() })
    act(() => { result.current.liberar() })

    expect(release).toHaveBeenCalledTimes(1)
  })

  it('pausa el audio de respaldo si estaba en uso', async () => {
    removeWakeLockApi()
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.activar() })

    act(() => { result.current.liberar() })

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1)
  })

  it('llamar liberar() sin haber activado nada no lanza error', () => {
    const { result } = renderHook(() => useWakeLock())
    expect(() => result.current.liberar()).not.toThrow()
  })

  it('después de liberar(), activar() vuelve a pedir el wake lock (no reutiliza el sentinel liberado)', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    stubWakeLock(() => Promise.resolve({ release }))
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.activar() })
    act(() => { result.current.liberar() })

    await act(async () => { await result.current.activar() })

    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(2)
  })
})
