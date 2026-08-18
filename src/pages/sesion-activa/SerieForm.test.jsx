import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SerieForm from './SerieForm'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

const EJERCICIO = { id: 'ej1', repsEsperadas: 10 }

function SerieFormFixture({ pesoInicial = '', repsInicial = '', ejercicio = EJERCICIO, mostrarNota = false }) {
  const [pesoUsado, setPesoUsado] = useState(pesoInicial)
  const [repsHechas, setRepsHechas] = useState(repsInicial)
  const [nota, setNota] = useState('')
  return (
    <SerieForm
      ejercicio={ejercicio}
      pesoUsado={pesoUsado} setPesoUsado={setPesoUsado}
      repsHechas={repsHechas} setRepsHechas={setRepsHechas}
      ultimoPeso={{}}
      mostrarNota={mostrarNota}
      nota={nota} setNota={setNota}
    />
  )
}

// ---------------------------------------------------------------------------

describe('SerieForm — stepper de peso/reps', () => {
  it('un tap corto en "Sumar 2,5 kg" incrementa el peso en 2.5', () => {
    render(<SerieFormFixture />)
    const btn = screen.getByLabelText('Sumar 2,5 kg')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    fireEvent.click(btn)
    expect(screen.getByLabelText('Peso (kg)').value).toBe('2.5')
  })

  it('mantener presionado "Sumar 2,5 kg" incrementa el peso repetidamente', async () => {
    vi.useFakeTimers()
    render(<SerieFormFixture />)
    const btn = screen.getByLabelText('Sumar 2,5 kg')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500) })
    await act(async () => { vi.advanceTimersByTime(150 * 2) })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    expect(Number(screen.getByLabelText('Peso (kg)').value)).toBeGreaterThan(2.5)
    vi.useRealTimers()
  })

  it('mantener presionado "Restar 2,5 kg" desde 0 no baja el peso de 0', async () => {
    vi.useFakeTimers()
    render(<SerieFormFixture pesoInicial="0" />)
    const btn = screen.getByLabelText('Restar 2,5 kg')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150 * 3) })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    expect(screen.getByLabelText('Peso (kg)').value).toBe('0')
    vi.useRealTimers()
  })

  it('mantener presionado "Restar una repetición" desde 1 no baja las reps de 1', async () => {
    vi.useFakeTimers()
    render(<SerieFormFixture repsInicial="1" />)
    const btn = screen.getByLabelText('Restar una repetición')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150 * 3) })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    expect(screen.getByLabelText('Repeticiones').value).toBe('1')
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------

describe('SerieForm — tamaño de fuente del input de peso', () => {
  it('con un peso de hasta 4 caracteres usa el tamaño grande', () => {
    render(<SerieFormFixture pesoInicial="82.5" />)
    expect(screen.getByLabelText('Peso (kg)').className).toBe('sa-input-big')
  })

  it('con un peso de 5 caracteres achica la fuente (sa-input-big--md)', () => {
    render(<SerieFormFixture pesoInicial="100.5" />)
    expect(screen.getByLabelText('Peso (kg)').className).toContain('sa-input-big--md')
  })

  it('con un peso de 6+ caracteres achica más la fuente (sa-input-big--sm), ej. "100.25"', () => {
    render(<SerieFormFixture pesoInicial="100.25" />)
    expect(screen.getByLabelText('Peso (kg)').className).toContain('sa-input-big--sm')
  })
})

describe('SerieForm — nota', () => {
  it('sin mostrarNota, no renderiza el textarea (el toggle vive en EjercicioInfo)', () => {
    render(<SerieFormFixture mostrarNota={false} />)
    expect(screen.queryByPlaceholderText('Nota para esta serie...')).not.toBeInTheDocument()
  })

  it('con mostrarNota, muestra el textarea y permite escribir', () => {
    render(<SerieFormFixture mostrarNota />)
    const textarea = screen.getByPlaceholderText('Nota para esta serie...')
    fireEvent.change(textarea, { target: { value: 'pesado hoy' } })
    expect(textarea.value).toBe('pesado hoy')
  })
})
