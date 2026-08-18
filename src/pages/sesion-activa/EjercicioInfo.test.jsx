vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EjercicioInfo from './EjercicioInfo'

const EJERCICIO = { nombre: 'Press Banca', grupoMuscular: 'Pecho' }

function renderInfo(props = {}) {
  return render(
    <EjercicioInfo
      ejIdx={0} serieIdx={0} ejercicio={EJERCICIO}
      serieActual={1} totalSeries={3}
      tabRef="ultima" setTabRef={vi.fn()} refAnterior={null} refPR={null}
      mostrarNota={false} setMostrarNota={vi.fn()}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------

describe('EjercicioInfo — grupo muscular como texto secundario', () => {
  it('muestra el grupo muscular sin badge, junto al nombre', () => {
    renderInfo()
    expect(screen.getByText('Press Banca')).toBeInTheDocument()
    expect(screen.getByText('Pecho')).toHaveClass('sa-ejercicio-grupo')
  })
})

// ---------------------------------------------------------------------------

describe('EjercicioInfo — icono de nota', () => {
  it('sin nota mostrada, el botón ofrece "Agregar nota"', () => {
    renderInfo({ mostrarNota: false })
    expect(screen.getByRole('button', { name: 'Agregar nota a esta serie' })).toBeInTheDocument()
  })

  it('con la nota mostrada, el botón ofrece "Ocultar nota" y queda marcado activo', () => {
    renderInfo({ mostrarNota: true })
    const btn = screen.getByRole('button', { name: 'Ocultar nota' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('tocar el ícono alterna mostrarNota', async () => {
    const setMostrarNota = vi.fn()
    const user = userEvent.setup()
    renderInfo({ mostrarNota: false, setMostrarNota })
    await user.click(screen.getByRole('button', { name: 'Agregar nota a esta serie' }))

    expect(setMostrarNota).toHaveBeenCalledOnce()
    // Se pasa un updater función (m => !m), no un valor fijo — soporta taps rápidos consecutivos.
    const updater = setMostrarNota.mock.calls[0][0]
    expect(updater(false)).toBe(true)
  })
})
