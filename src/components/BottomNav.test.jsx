const mockUseTimerActivo = vi.hoisted(() => vi.fn(() => ({ timerActivo: false })))
vi.mock('../context/TimerActivoContext', () => ({ useTimerActivo: mockUseTimerActivo }))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

function LocationDisplay() {
  const { pathname } = useLocation()
  return <span data-testid="ruta">{pathname}</span>
}

const renderWithRouter = (initialRoute = '/home') =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <BottomNav />
      <LocationDisplay />
    </MemoryRouter>
  )

beforeEach(() => {
  mockUseTimerActivo.mockReturnValue({ timerActivo: false })
})

describe('BottomNav', () => {
  it('renders all 4 navigation tabs', () => {
    renderWithRouter('/home')
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Entrenar')).toBeInTheDocument()
    expect(screen.getByText('Programas')).toBeInTheDocument()
    expect(screen.getByText('Progreso')).toBeInTheDocument()
  })

  it('is visible on /home', () => {
    renderWithRouter('/home')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('is visible on /entrenar', () => {
    renderWithRouter('/entrenar')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('is visible on /programas', () => {
    renderWithRouter('/programas')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('is visible on /progreso', () => {
    renderWithRouter('/progreso')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('is visible on program sub-routes (/programas/...)', () => {
    renderWithRouter('/programas/abc123')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('is not rendered on session routes', () => {
    renderWithRouter('/sesion/abc123')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('is not rendered on the login page', () => {
    renderWithRouter('/')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('BottomNav — timer activo', () => {
  it('sin timer activo, navega directo al tocar otro tab', async () => {
    const user = userEvent.setup()
    renderWithRouter('/timer')
    await user.click(screen.getByText('Inicio'))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/home')
  })

  it('con timer activo, tocar otro tab abre la confirmación y no navega todavía', async () => {
    mockUseTimerActivo.mockReturnValue({ timerActivo: true })
    const user = userEvent.setup()
    renderWithRouter('/timer')

    await user.click(screen.getByText('Inicio'))

    expect(await screen.findByText('¿Salir del timer?')).toBeInTheDocument()
    expect(screen.getByTestId('ruta')).toHaveTextContent('/timer')
  })

  it('"Seguir" cierra el diálogo sin navegar', async () => {
    mockUseTimerActivo.mockReturnValue({ timerActivo: true })
    const user = userEvent.setup()
    renderWithRouter('/timer')
    await user.click(screen.getByText('Inicio'))
    await user.click(await screen.findByText('Seguir'))

    await waitFor(() => expect(screen.queryByText('¿Salir del timer?')).not.toBeInTheDocument())
    expect(screen.getByTestId('ruta')).toHaveTextContent('/timer')
  })

  it('"Salir" navega al tab elegido', async () => {
    mockUseTimerActivo.mockReturnValue({ timerActivo: true })
    const user = userEvent.setup()
    renderWithRouter('/timer')
    await user.click(screen.getByText('Inicio'))
    await user.click(await screen.findByText('Salir'))

    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/home'))
  })

  it('con timer activo, tocar el propio tab de Timer no dispara confirmación', async () => {
    mockUseTimerActivo.mockReturnValue({ timerActivo: true })
    const user = userEvent.setup()
    renderWithRouter('/timer')
    await user.click(screen.getByText('Timer'))

    expect(screen.queryByText('¿Salir del timer?')).not.toBeInTheDocument()
  })
})
