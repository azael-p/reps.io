import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TimerFin from './TimerFin'

const onVolver = vi.fn()

describe('TimerFin', () => {
  it('muestra el mensaje de fin', () => {
    render(<TimerFin config={{}} setsCompletados={8} tiempoTotal={600} onVolver={onVolver} />)
    expect(screen.getByText('¡Listo!')).toBeDefined()
  })

  it('muestra el tiempo total correctamente (10:00)', () => {
    render(<TimerFin config={{}} setsCompletados={8} tiempoTotal={600} onVolver={onVolver} />)
    expect(screen.getByText('10:00')).toBeDefined()
  })

  it('muestra los sets completados', () => {
    render(<TimerFin config={{}} setsCompletados={8} tiempoTotal={600} onVolver={onVolver} />)
    expect(screen.getByText('8')).toBeDefined()
  })

  it('el botón volver llama al callback', () => {
    const cb = vi.fn()
    render(<TimerFin config={{}} setsCompletados={3} tiempoTotal={120} onVolver={cb} />)
    fireEvent.click(screen.getByText('Volver a configuración'))
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
