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

  it('renders the custom exercise button', async () => {
    render(<SeleccionarEjercicio {...defaultProps} />)
    await waitFor(() =>
      expect(screen.getByText('+ Ejercicio personalizado')).toBeInTheDocument()
    )
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
    await user.click(screen.getByRole('button', { name: '✕' }))

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
