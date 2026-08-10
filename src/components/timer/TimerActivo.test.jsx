import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import TimerActivo from './TimerActivo'

const CONFIG = { calentamiento: 300, trabajo: 40, descanso: 20, sets: 8, enfriamiento: 300 }

const defaultProps = {
  fase: 'trabajo',
  segundosRestantes: 40,
  setActual: 1,
  config: CONFIG,
  pausado: false,
  onPausar: vi.fn(),
  onReanudar: vi.fn(),
  onSaltar: vi.fn(),
  onTerminar: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('TimerActivo', () => {
  it('muestra la fase actual en texto grande', () => {
    render(<TimerActivo {...defaultProps} />)
    expect(screen.getByText('TRABAJO')).toBeDefined()
  })

  it('muestra la cuenta regresiva', () => {
    render(<TimerActivo {...defaultProps} />)
    expect(screen.getByText('0:40')).toBeDefined()
  })

  it('muestra los sets correctamente', () => {
    render(<TimerActivo {...defaultProps} />)
    expect(screen.getByText(/Set/)).toBeDefined()
    expect(screen.getByText(/1/).textContent).toBeTruthy()
    expect(screen.getByText(/8/).textContent).toBeTruthy()
  })

  it('el botón pausar llama a onPausar()', () => {
    render(<TimerActivo {...defaultProps} />)
    fireEvent.click(screen.getByText('PAUSAR'))
    expect(defaultProps.onPausar).toHaveBeenCalledTimes(1)
  })

  it('el botón reanudar llama a onReanudar() cuando está pausado', () => {
    render(<TimerActivo {...defaultProps} pausado={true} />)
    fireEvent.click(screen.getByText('REANUDAR'))
    expect(defaultProps.onReanudar).toHaveBeenCalledTimes(1)
  })

  it('el botón saltar llama a onSaltar()', () => {
    render(<TimerActivo {...defaultProps} />)
    fireEvent.click(screen.getByText('SALTAR →'))
    expect(defaultProps.onSaltar).toHaveBeenCalledTimes(1)
  })

  it('el botón terminar NO llama a onTerminar() en tap corto', () => {
    render(<TimerActivo {...defaultProps} />)
    const btn = screen.getByText('TERMINAR')
    fireEvent.pointerDown(btn)
    fireEvent.pointerUp(btn)
    expect(defaultProps.onTerminar).not.toHaveBeenCalled()
  })

  it('el botón terminar llama a onTerminar() tras long press de 2s', async () => {
    vi.useFakeTimers()
    render(<TimerActivo {...defaultProps} />)
    const btn = screen.getByText('TERMINAR')
    fireEvent.pointerDown(btn)
    await act(async () => { vi.advanceTimersByTime(2100) })
    expect(defaultProps.onTerminar).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('soltar antes de 2s no llama a onTerminar()', async () => {
    vi.useFakeTimers()
    render(<TimerActivo {...defaultProps} />)
    const btn = screen.getByText('TERMINAR')
    fireEvent.pointerDown(btn)
    await act(async () => { vi.advanceTimersByTime(500) })
    fireEvent.pointerUp(btn)
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(defaultProps.onTerminar).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('muestra CALENTAMIENTO con fase calentamiento', () => {
    render(<TimerActivo {...defaultProps} fase="calentamiento" />)
    expect(screen.getByText('CALENTAMIENTO')).toBeDefined()
  })

  it('muestra DESCANSO con fase descanso', () => {
    render(<TimerActivo {...defaultProps} fase="descanso" />)
    expect(screen.getByText('DESCANSO')).toBeDefined()
  })
})
