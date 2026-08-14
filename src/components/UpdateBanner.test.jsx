import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import UpdateBanner from './UpdateBanner'

const updateServiceWorker = vi.fn()
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

beforeEach(() => {
  mockNeedRefresh = false
  updateServiceWorker.mockClear()
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

  it('actualiza el service worker automáticamente cuando hay una versión nueva', () => {
    mockNeedRefresh = true
    render(<UpdateBanner />)
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('no actualiza el service worker si no hay una versión nueva', () => {
    render(<UpdateBanner />)
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
