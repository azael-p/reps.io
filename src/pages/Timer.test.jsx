// Testea el wiring de la página (máquina config → activo → fin) con el
// useTimer real y los componentes hijos stubbeados.
const wakeLock = vi.hoisted(() => ({ activar: vi.fn(), liberar: vi.fn() }))
vi.mock('../components/timer/useWakeLock', () => ({ useWakeLock: () => wakeLock }))

vi.mock('../components/timer/TimerConfig', () => ({
  default: ({ onIniciar }) => (
    <button onClick={() => onIniciar({ calentamiento: 1, trabajo: 1, descanso: 1, enfriamiento: 1, sets: 1 })}>
      iniciar-mock
    </button>
  ),
}))
vi.mock('../components/timer/TimerActivo', () => ({
  default: ({ fase, onTerminar }) => (
    <div data-testid="activo">
      <span data-testid="fase">{fase}</span>
      <button onClick={onTerminar}>terminar-mock</button>
    </div>
  ),
}))
vi.mock('../components/timer/TimerFin', () => ({
  default: ({ tiempoTotal, onVolver }) => (
    <div data-testid="fin">
      <span data-testid="tiempo-total">{tiempoTotal}</span>
      <button onClick={onVolver}>volver-mock</button>
    </div>
  ),
}))

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import Timer from './Timer'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

function iniciar() {
  render(<Timer />)
  fireEvent.click(screen.getByText('iniciar-mock'))
}

// ---------------------------------------------------------------------------

describe('Timer — máquina de estados', () => {
  it('arranca en la pantalla de configuración', () => {
    render(<Timer />)
    expect(screen.getByText('iniciar-mock')).toBeInTheDocument()
    expect(screen.queryByTestId('activo')).not.toBeInTheDocument()
  })

  it('al iniciar pasa a activo en calentamiento y activa el wake lock', () => {
    iniciar()
    expect(screen.getByTestId('fase')).toHaveTextContent('calentamiento')
    expect(wakeLock.activar).toHaveBeenCalledOnce()
  })

  it('al completarse todas las fases muestra la pantalla de fin con el tiempo total', () => {
    iniciar()
    // 1s calentamiento + 1s trabajo + 1s enfriamiento (sets=1: sin descanso)
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.getByTestId('fin')).toBeInTheDocument()
    expect(Number(screen.getByTestId('tiempo-total').textContent)).toBeGreaterThan(0)
  })

  it('terminar manualmente vuelve a configuración y libera el wake lock', () => {
    iniciar()
    fireEvent.click(screen.getByText('terminar-mock'))
    expect(screen.getByText('iniciar-mock')).toBeInTheDocument()
    expect(wakeLock.liberar).toHaveBeenCalledOnce()
  })

  it('desde la pantalla de fin, volver regresa a configuración', () => {
    iniciar()
    act(() => { vi.advanceTimersByTime(4000) })
    fireEvent.click(screen.getByText('volver-mock'))
    expect(screen.getByText('iniciar-mock')).toBeInTheDocument()
    expect(wakeLock.liberar).toHaveBeenCalledOnce()
  })

  it('tras un stop manual, una nueva sesión que termina muestra su propio tiempo (no el viejo)', () => {
    iniciar()
    act(() => { vi.advanceTimersByTime(1500) })
    fireEvent.click(screen.getByText('terminar-mock'))
    // Segunda sesión completa
    fireEvent.click(screen.getByText('iniciar-mock'))
    act(() => { vi.advanceTimersByTime(4000) })
    const total = Number(screen.getByTestId('tiempo-total').textContent)
    expect(total).toBeGreaterThanOrEqual(3)
    expect(total).toBeLessThan(10)
  })
})
