import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useLongPress } from './useLongPress'

function LongPressFixture({ onStep, delay = 500, interval = 150 }) {
  const press = useLongPress(onStep, { delay, interval })
  return <button data-testid="btn" {...press}>+</button>
}

// ---------------------------------------------------------------------------

describe('useLongPress', () => {
  it('un tap corto dispara onStep exactamente una vez', () => {
    const onStep = vi.fn()
    render(<LongPressFixture onStep={onStep} />)
    const btn = screen.getByTestId('btn')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    fireEvent.click(btn)
    expect(onStep).toHaveBeenCalledTimes(1)
  })

  it('mantener presionado más del delay dispara onStep repetidamente', async () => {
    vi.useFakeTimers()
    const onStep = vi.fn()
    render(<LongPressFixture onStep={onStep} delay={500} interval={150} />)
    const btn = screen.getByTestId('btn')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    expect(onStep).toHaveBeenCalledTimes(1)
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(onStep).toHaveBeenCalledTimes(1)
    await act(async () => { vi.advanceTimersByTime(150) })
    expect(onStep).toHaveBeenCalledTimes(2)
    await act(async () => { vi.advanceTimersByTime(150 * 3) })
    expect(onStep).toHaveBeenCalledTimes(5)
    vi.useRealTimers()
  })

  it('soltar detiene la repetición', async () => {
    vi.useFakeTimers()
    const onStep = vi.fn()
    render(<LongPressFixture onStep={onStep} delay={500} interval={150} />)
    const btn = screen.getByTestId('btn')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150) })
    const llamadasAlSoltar = onStep.mock.calls.length
    fireEvent.pointerUp(btn, { pointerId: 1 })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(onStep).toHaveBeenCalledTimes(llamadasAlSoltar)
    vi.useRealTimers()
  })

  it('el click sintético tras un long press no dispara un onStep extra', async () => {
    vi.useFakeTimers()
    const onStep = vi.fn()
    render(<LongPressFixture onStep={onStep} delay={500} interval={150} />)
    const btn = screen.getByTestId('btn')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150) })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    const llamadasAlSoltar = onStep.mock.calls.length
    fireEvent.click(btn)
    expect(onStep).toHaveBeenCalledTimes(llamadasAlSoltar)
    vi.useRealTimers()
  })

  it('activación por teclado (click sin pointerdown previo) dispara onStep una vez', () => {
    const onStep = vi.fn()
    render(<LongPressFixture onStep={onStep} />)
    fireEvent.click(screen.getByTestId('btn'))
    expect(onStep).toHaveBeenCalledTimes(1)
  })

  it('desmontar mientras está presionado no sigue invocando onStep (sin memory leak)', async () => {
    vi.useFakeTimers()
    const onStep = vi.fn()
    const { unmount } = render(<LongPressFixture onStep={onStep} delay={500} interval={150} />)
    const btn = screen.getByTestId('btn')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150) })
    const llamadasAntesDeDesmontar = onStep.mock.calls.length
    unmount()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(onStep).toHaveBeenCalledTimes(llamadasAntesDeDesmontar)
    vi.useRealTimers()
  })

  it('pasar a background (visibilitychange a hidden) detiene la repetición', async () => {
    vi.useFakeTimers()
    const onStep = vi.fn()
    render(<LongPressFixture onStep={onStep} delay={500} interval={150} />)
    const btn = screen.getByTestId('btn')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150) })
    const llamadasAntes = onStep.mock.calls.length
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    fireEvent(document, new Event('visibilitychange'))
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(onStep).toHaveBeenCalledTimes(llamadasAntes)
    vi.useRealTimers()
  })
})
