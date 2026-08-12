vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'

let showFn, dismissFn

function Fixture() {
  const { show, dismiss } = useToast()
  showFn = show
  dismissFn = dismiss
  return null
}

function renderProvider() {
  render(
    <ToastProvider>
      <Fixture />
    </ToastProvider>
  )
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('ToastProvider — show', () => {
  it('muestra el mensaje en el DOM', () => {
    renderProvider()
    act(() => showFn({ message: 'Hola toast', duration: 1000 }))
    expect(screen.getByText('Hola toast')).toBeInTheDocument()
  })

  it('elimina el toast automáticamente tras duration ms', () => {
    renderProvider()
    act(() => showFn({ message: 'Auto', duration: 500 }))
    expect(screen.getByText('Auto')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByText('Auto')).not.toBeInTheDocument()
  })

  it('llama onTimeout al expirar', () => {
    const onTimeout = vi.fn()
    renderProvider()
    act(() => showFn({ message: 'Msg', duration: 500, onTimeout }))
    act(() => vi.advanceTimersByTime(500))
    expect(onTimeout).toHaveBeenCalledOnce()
  })

  it('duration: 0 nunca auto-descarta ni llama onTimeout', () => {
    const onTimeout = vi.fn()
    renderProvider()
    act(() => showFn({ message: 'Permanente', duration: 0, onTimeout }))
    act(() => vi.advanceTimersByTime(60000))
    expect(screen.getByText('Permanente')).toBeInTheDocument()
    expect(onTimeout).not.toHaveBeenCalled()
  })
})

describe('ToastProvider — dismiss', () => {
  it('elimina el toast del DOM inmediatamente', () => {
    renderProvider()
    let id
    act(() => { id = showFn({ message: 'Toast', duration: 5000 }) })
    expect(screen.getByText('Toast')).toBeInTheDocument()
    act(() => dismissFn(id))
    expect(screen.queryByText('Toast')).not.toBeInTheDocument()
  })

  it('cancela onTimeout — no se llama al hacer dismiss antes de expirar', () => {
    const onTimeout = vi.fn()
    renderProvider()
    let id
    act(() => { id = showFn({ message: 'Msg', duration: 1000, onTimeout }) })
    act(() => dismissFn(id))
    act(() => vi.advanceTimersByTime(1000))
    expect(onTimeout).not.toHaveBeenCalled()
  })
})

describe('ToastProvider — action (Deshacer)', () => {
  it('ejecuta onClick de la acción y descarta el toast', () => {
    const onClick = vi.fn()
    renderProvider()
    act(() => showFn({
      message: 'Eliminado',
      duration: 5000,
      action: { label: 'Deshacer', onClick },
    }))
    act(() => { screen.getByText('Deshacer').click() })
    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.queryByText('Eliminado')).not.toBeInTheDocument()
  })

  it('clickear la acción cancela onTimeout — no hay borrado definitivo tras deshacer', () => {
    const onTimeout = vi.fn()
    renderProvider()
    act(() => showFn({
      message: 'Eliminado',
      duration: 5000,
      action: { label: 'Deshacer', onClick: vi.fn() },
      onTimeout,
    }))
    act(() => { screen.getByText('Deshacer').click() })
    act(() => vi.advanceTimersByTime(5000))
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('si onTimeout rechaza, el error se captura y se loguea', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onTimeout = vi.fn().mockRejectedValue(new Error('firestore caído'))
    renderProvider()
    act(() => showFn({ message: 'Msg', duration: 500, onTimeout }))
    act(() => vi.advanceTimersByTime(500))
    await act(async () => { await Promise.resolve() })
    expect(onTimeout).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
