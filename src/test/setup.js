import '@testing-library/jest-dom'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// WakeLock API mock
Object.defineProperty(global.navigator, 'wakeLock', {
  writable: true,
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
})

// Audio mock (jsdom doesn't implement HTMLMediaElement)
global.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
global.HTMLMediaElement.prototype.pause = vi.fn()

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
