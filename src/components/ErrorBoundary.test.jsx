import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from './ErrorBoundary'

function Bomb({ shouldThrowBox }) {
  if (shouldThrowBox.value) throw new Error('boom')
  return <div>Todo bien</div>
}

let originalLocation

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  originalLocation = window.location
  delete window.location
  window.location = { href: '' }
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location = originalLocation
})

// ---------------------------------------------------------------------------

describe('ErrorBoundary — sin errores', () => {
  it('renderiza los children normalmente', () => {
    render(
      <ErrorBoundary>
        <div>Contenido normal</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Contenido normal')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('ErrorBoundary — con error', () => {
  it('atrapa el error de un hijo y muestra el fallback en vez de crashear', () => {
    const shouldThrowBox = { value: true }
    render(
      <ErrorBoundary>
        <Bomb shouldThrowBox={shouldThrowBox} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    expect(screen.queryByText('Todo bien')).not.toBeInTheDocument()
  })

  it('registra el error en consola', () => {
    const shouldThrowBox = { value: true }
    render(
      <ErrorBoundary>
        <Bomb shouldThrowBox={shouldThrowBox} />
      </ErrorBoundary>
    )
    expect(console.error).toHaveBeenCalledWith(
      '[ErrorBoundary]', expect.any(Error), expect.anything(),
    )
  })

  it('"Reintentar" limpia el error y vuelve a renderizar los children', async () => {
    const shouldThrowBox = { value: true }
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Bomb shouldThrowBox={shouldThrowBox} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()

    shouldThrowBox.value = false
    await user.click(screen.getByText('Reintentar'))

    expect(screen.getByText('Todo bien')).toBeInTheDocument()
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument()
  })

  it('"Volver al inicio" limpia el error y navega a /home', async () => {
    const shouldThrowBox = { value: true }
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Bomb shouldThrowBox={shouldThrowBox} />
      </ErrorBoundary>
    )

    await user.click(screen.getByText('Volver al inicio'))

    expect(window.location.href).toBe('/home')
  })
})
