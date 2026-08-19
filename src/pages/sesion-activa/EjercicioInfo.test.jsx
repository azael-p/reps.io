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
      onEditarSerie={vi.fn()}
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

// ---------------------------------------------------------------------------

describe('EjercicioInfo — corrección no lineal (dots de series completadas)', () => {
  it('solo las series ya completadas son tocables — la activa y las pendientes no', () => {
    // serieIdx=2, totalSeries=4: series 0 y 1 completadas, 2 activa, 3 pendiente.
    renderInfo({ serieIdx: 2, totalSeries: 4 })
    expect(screen.getAllByRole('button', { name: /^Editar serie/ })).toHaveLength(2)
  })

  it('tocar el dot de una serie completada llama a onEditarSerie con su índice', async () => {
    const onEditarSerie = vi.fn()
    const user = userEvent.setup()
    renderInfo({ serieIdx: 2, totalSeries: 4, onEditarSerie })
    await user.click(screen.getByRole('button', { name: 'Editar serie 2' }))
    expect(onEditarSerie).toHaveBeenCalledWith(1)
  })

  it('sin series completadas (serieIdx=0), no hay ningún dot tocable', () => {
    renderInfo({ serieIdx: 0, totalSeries: 3 })
    expect(screen.queryByRole('button', { name: /^Editar serie/ })).not.toBeInTheDocument()
  })
})
