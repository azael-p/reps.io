// AnimatePresence in mode="popLayout" keeps exiting children in the DOM during
// their exit animation. Replace it with a simple pass-through so filtered items
// are removed immediately in tests.
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../firebase/catalogo', () => ({
  getCatalogo: vi.fn().mockResolvedValue([
    { id: '1', nombre: 'Press Banca', grupoMuscular: 'Pecho' },
    { id: '2', nombre: 'Sentadilla', grupoMuscular: 'Piernas' },
    { id: '3', nombre: 'Curl Bíceps', grupoMuscular: 'Bíceps' },
  ]),
}))

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeleccionarEjercicio from './SeleccionarEjercicio'
import { getCatalogo } from '../firebase/catalogo'

const defaultProps = {
  onSeleccionar: vi.fn(),
  onCerrar: vi.fn(),
}

describe('SeleccionarEjercicio', () => {
  it('shows skeleton loaders before data arrives', () => {
    render(<SeleccionarEjercicio {...defaultProps} />)
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })

  it('renders the exercise list after loading', async () => {
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Press Banca')).toBeInTheDocument()
      expect(screen.getByText('Sentadilla')).toBeInTheDocument()
      expect(screen.getByText('Curl Bíceps')).toBeInTheDocument()
    })
  })

  it('filters exercises by muscle group chip', async () => {
    const user = userEvent.setup()
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() => screen.getByText('Press Banca'))

    // The group buttons appear in the filter row; there is also a "Todos" button
    await user.click(screen.getByRole('button', { name: 'Pecho' }))

    expect(screen.getByText('Press Banca')).toBeInTheDocument()
    expect(screen.queryByText('Sentadilla')).not.toBeInTheDocument()
    expect(screen.queryByText('Curl Bíceps')).not.toBeInTheDocument()
  })

  it('filters exercises by search text (case insensitive)', async () => {
    const user = userEvent.setup()
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() => screen.getByText('Press Banca'))

    await user.type(screen.getByPlaceholderText('Buscar...'), 'curl')

    expect(screen.getByText('Curl Bíceps')).toBeInTheDocument()
    expect(screen.queryByText('Press Banca')).not.toBeInTheDocument()
    expect(screen.queryByText('Sentadilla')).not.toBeInTheDocument()
  })

  it('shows "Sin resultados" when no exercises match the search', async () => {
    const user = userEvent.setup()
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() => screen.getByText('Press Banca'))

    await user.type(screen.getByPlaceholderText('Buscar...'), 'xyzabc123')

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('shows all exercises again after clearing the search', async () => {
    const user = userEvent.setup()
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() => screen.getByText('Press Banca'))

    await user.type(screen.getByPlaceholderText('Buscar...'), 'curl')
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))

    await waitFor(() => {
      expect(screen.getByText('Press Banca')).toBeInTheDocument()
      expect(screen.getByText('Sentadilla')).toBeInTheDocument()
    })
  })

  it('shows muscle group tags on exercises', async () => {
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() => screen.getByText('Press Banca'))
    // Tags appear in both filter chips and exercise rows, so use getAllByText
    expect(screen.getAllByText('Pecho').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Piernas').length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------

describe('SeleccionarEjercicio — flujo de confirmación', () => {
  it('al tocar un ejercicio muestra la pantalla de configuración', async () => {
    const user = userEvent.setup()
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() => screen.getByText('Press Banca'))
    await user.click(screen.getByRole('button', { name: /press banca/i }))
    expect(screen.getByText('Configurar')).toBeInTheDocument()
    // Inputs de tipo number (spinbutton): series y reps
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2)
  })

  it('llama a onSeleccionar con los datos correctos al confirmar', async () => {
    const onSeleccionar = vi.fn()
    const user = userEvent.setup()
    render(<SeleccionarEjercicio onSeleccionar={onSeleccionar} onCerrar={vi.fn()} />)
    await waitFor(() => screen.getByText('Sentadilla'))
    await user.click(screen.getByRole('button', { name: /sentadilla/i }))

    // Primer spinbutton = series
    const [seriesInput] = screen.getAllByRole('spinbutton')
    await user.clear(seriesInput)
    await user.type(seriesInput, '4')

    await user.click(screen.getByRole('button', { name: /agregar ejercicio/i }))

    expect(onSeleccionar).toHaveBeenCalledOnce()
    expect(onSeleccionar).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Sentadilla',
      grupoMuscular: 'Piernas',
      esCustom: false,
      seriesEsperadas: 4,
    }))
  })

  it('llama a onSeleccionar con el catalogoId del ejercicio elegido', async () => {
    const onSeleccionar = vi.fn()
    const user = userEvent.setup()
    render(<SeleccionarEjercicio onSeleccionar={onSeleccionar} onCerrar={vi.fn()} />)
    await waitFor(() => screen.getByText('Sentadilla'))
    await user.click(screen.getByRole('button', { name: /sentadilla/i }))
    await user.click(screen.getByRole('button', { name: /agregar ejercicio/i }))

    expect(onSeleccionar).toHaveBeenCalledWith(expect.objectContaining({
      catalogoId: '2',
      esCustom: false,
    }))
  })

  it('no confirma con series vacío (evita seriesEsperadas: 0) y muestra un error', async () => {
    const onSeleccionar = vi.fn()
    const user = userEvent.setup()
    render(<SeleccionarEjercicio onSeleccionar={onSeleccionar} onCerrar={vi.fn()} />)
    await waitFor(() => screen.getByText('Sentadilla'))
    await user.click(screen.getByRole('button', { name: /sentadilla/i }))

    const [seriesInput] = screen.getAllByRole('spinbutton')
    await user.clear(seriesInput)

    await user.click(screen.getByRole('button', { name: /agregar ejercicio/i }))

    expect(onSeleccionar).not.toHaveBeenCalled()
    expect(screen.getByText('Series y reps deben ser mayores a 0')).toBeInTheDocument()
  })

  it('no confirma con reps vacío', async () => {
    const onSeleccionar = vi.fn()
    const user = userEvent.setup()
    render(<SeleccionarEjercicio onSeleccionar={onSeleccionar} onCerrar={vi.fn()} />)
    await waitFor(() => screen.getByText('Sentadilla'))
    await user.click(screen.getByRole('button', { name: /sentadilla/i }))

    const [, repsInput] = screen.getAllByRole('spinbutton')
    await user.clear(repsInput)

    await user.click(screen.getByRole('button', { name: /agregar ejercicio/i }))

    expect(onSeleccionar).not.toHaveBeenCalled()
    expect(screen.getByText('Series y reps deben ser mayores a 0')).toBeInTheDocument()
  })

  it('el error desaparece al corregir el valor y confirmar de nuevo', async () => {
    const onSeleccionar = vi.fn()
    const user = userEvent.setup()
    render(<SeleccionarEjercicio onSeleccionar={onSeleccionar} onCerrar={vi.fn()} />)
    await waitFor(() => screen.getByText('Sentadilla'))
    await user.click(screen.getByRole('button', { name: /sentadilla/i }))

    const [seriesInput] = screen.getAllByRole('spinbutton')
    await user.clear(seriesInput)
    await user.click(screen.getByRole('button', { name: /agregar ejercicio/i }))
    expect(screen.getByText('Series y reps deben ser mayores a 0')).toBeInTheDocument()

    await user.type(seriesInput, '3')
    expect(screen.queryByText('Series y reps deben ser mayores a 0')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /agregar ejercicio/i }))
    expect(onSeleccionar).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------

describe('SeleccionarEjercicio — búsqueda fuzzy', () => {
  // Nombres reales del catálogo, que es donde el fuzzy tiene que rendir.
  const CATALOGO_REAL = [
    { id: '1', nombre: 'Press de banca plano', grupoMuscular: 'Pecho' },
    { id: '2', nombre: 'Press de banca inclinado', grupoMuscular: 'Pecho' },
    { id: '3', nombre: 'Press francés', grupoMuscular: 'Tríceps' },
    { id: '4', nombre: 'Peck deck', grupoMuscular: 'Pecho' },
    { id: '5', nombre: 'Jalón en polea frontal', grupoMuscular: 'Espalda' },
    { id: '6', nombre: 'Remo en máquina', grupoMuscular: 'Espalda' },
    { id: '7', nombre: 'Curl con barra Z', grupoMuscular: 'Bíceps' },
    { id: '8', nombre: 'Antebrazo en polea', grupoMuscular: 'Antebrazo' },
  ]

  async function buscar(texto, catalogo = CATALOGO_REAL) {
    getCatalogo.mockResolvedValueOnce(catalogo)
    const user = userEvent.setup()
    render(<SeleccionarEjercicio onSeleccionar={vi.fn()} onCerrar={vi.fn()} />)
    await waitFor(() => screen.getByText(catalogo[0].nombre))
    await user.type(screen.getByPlaceholderText('Buscar...'), texto)
  }

  it('encuentra un ejercicio acentuado escribiendo sin acentos', async () => {
    await buscar('jalon')
    expect(screen.getByText('Jalón en polea frontal')).toBeInTheDocument()
  })

  it('tolera errores de tipeo', async () => {
    // "Prck deck" es el typo real que quedó registrado en las sesiones de Fernando
    await buscar('prck deck')
    expect(screen.getByText('Peck deck')).toBeInTheDocument()
  })

  it('encuentra por grupo muscular sin acentos', async () => {
    await buscar('biceps')
    expect(screen.getByText('Curl con barra Z')).toBeInTheDocument()
  })

  it('con varias palabras prioriza el que matchea todas', async () => {
    await buscar('press banca')
    const nombres = screen.getAllByText(/^Press /).map(el => el.textContent)
    // Con la query entera como un solo patrón, "Press francés" salía primero:
    // los que matchean las dos palabras tienen que ir antes.
    expect(nombres[0]).toBe('Press de banca plano')
    expect(nombres.indexOf('Press de banca inclinado')).toBeLessThan(nombres.indexOf('Press francés'))
  })

  it('limita las sugerencias a 8', async () => {
    const catalogoGrande = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      nombre: `Press variante ${i}`,
      grupoMuscular: 'Pecho',
    }))
    await buscar('press', catalogoGrande)
    expect(screen.getAllByText(/^Press variante/)).toHaveLength(8)
  })
})
