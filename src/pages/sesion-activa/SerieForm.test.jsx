import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SerieForm from './SerieForm'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

const EJERCICIO = { id: 'ej1', repsEsperadas: 10 }

function SerieFormFixture({ pesoInicial = '', repsInicial = '', ejercicio = EJERCICIO }) {
  const [pesoUsado, setPesoUsado] = useState(pesoInicial)
  const [repsHechas, setRepsHechas] = useState(repsInicial)
  const [mostrarNota, setMostrarNota] = useState(false)
  const [nota, setNota] = useState('')
  return (
    <SerieForm
      ejercicio={ejercicio}
      pesoUsado={pesoUsado} setPesoUsado={setPesoUsado}
      repsHechas={repsHechas} setRepsHechas={setRepsHechas}
      ultimoPeso={{}}
      mostrarNota={mostrarNota} setMostrarNota={setMostrarNota}
      nota={nota} setNota={setNota}
      ejIdx={0} serieIdx={0} tabRef={null} refPR={null} refAnterior={null} serieActual={1}
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
