import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import UpdateBanner from './UpdateBanner'

const updateServiceWorker = vi.fn()
const mockShow = vi.fn(() => 'toast-1')
const mockDismiss = vi.fn()
let mockNeedRefresh = false
let capturedOnRegisteredSW

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(options => {
    capturedOnRegisteredSW = options?.onRegisteredSW
    return {
      needRefresh: [mockNeedRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    }
  }),
}))

vi.mock('./Toast', () => ({
  useToast: () => ({ show: mockShow, dismiss: mockDismiss }),
}))

beforeEach(() => {
  mockNeedRefresh = false
  updateServiceWorker.mockClear()
  mockShow.mockClear()
  mockDismiss.mockClear()
  capturedOnRegisteredSW = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------

describe('UpdateBanner', () => {
  it('no renderiza nada', () => {
    const { container } = render(<UpdateBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra un toast persistente con acción "Actualizar" cuando hay una versión nueva, sin recargar solo', () => {
    mockNeedRefresh = true
    render(<UpdateBanner />)

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      duration: 0,
      action: expect.objectContaining({ label: 'Actualizar' }),
    }))
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })

  it('actualiza el service worker recién cuando el usuario toca la acción del toast', () => {
    mockNeedRefresh = true
    render(<UpdateBanner />)

    const { action } = mockShow.mock.calls[0][0]
    action.onClick()

    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('no muestra el toast ni actualiza el service worker si no hay una versión nueva', () => {
    render(<UpdateBanner />)
    expect(mockShow).not.toHaveBeenCalled()
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })

  it('chequea actualizaciones periódicamente cada 60 minutos', () => {
    vi.useFakeTimers()
    const registration = { update: vi.fn() }
    render(<UpdateBanner />)
    capturedOnRegisteredSW('/sw.js', registration)

    expect(registration.update).not.toHaveBeenCalled()

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('limpia el intervalo al desmontar para evitar memory leaks', () => {
    vi.useFakeTimers()
    const registration = { update: vi.fn() }
    const { unmount } = render(<UpdateBanner />)
    capturedOnRegisteredSW('/sw.js', registration)

    unmount()
    vi.advanceTimersByTime(60 * 60 * 1000)

    expect(registration.update).not.toHaveBeenCalled()
  })

  it('no falla si onRegisteredSW recibe una registration undefined', () => {
    render(<UpdateBanner />)
    expect(() => capturedOnRegisteredSW('/sw.js', undefined)).not.toThrow()
  })
})
