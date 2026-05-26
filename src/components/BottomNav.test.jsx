import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from './BottomNav'

const renderWithRouter = (initialRoute = '/home') =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <BottomNav />
    </MemoryRouter>
  )

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
