vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))

// Estado mutable por test; identidad estable del objeto usuario.
const authState = vi.hoisted(() => ({ usuario: null, loading: false }))
vi.mock('../context/UserContext', () => ({ useUser: () => authState }))

vi.mock('../firebase/auth', () => ({ signInWithGoogle: vi.fn() }))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { signInWithGoogle } from '../firebase/auth'
import Login from './Login'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<div data-testid="home-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.usuario = null
  authState.loading = false
})

// ---------------------------------------------------------------------------

describe('Login — render', () => {
  it('muestra el título y el botón de Google', () => {
    renderPage()
    expect(screen.getByText('¿Qué es Reps.io?')).toBeInTheDocument()
    expect(screen.getByText('Continuar con Google')).toBeInTheDocument()
  })

  it('no renderiza nada mientras auth está cargando', () => {
    authState.loading = true
    const { container } = renderPage()
    expect(container).toBeEmptyDOMElement()
  })

  it('redirige a /home si ya hay usuario logueado', async () => {
    authState.usuario = { id: 'user1' }
    renderPage()
    await screen.findByTestId('home-page')
  })
})

// ---------------------------------------------------------------------------

describe('Login — sign in con Google', () => {
  it('llama a signInWithGoogle y muestra "Ingresando…" mientras procesa', async () => {
    let resolver
    signInWithGoogle.mockReturnValue(new Promise(res => { resolver = res }))
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Continuar con Google'))
    expect(signInWithGoogle).toHaveBeenCalledOnce()
    expect(screen.getByText('Ingresando…')).toBeInTheDocument()
    resolver()
  })

  it('muestra un error si el sign-in falla por un motivo real', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/network-request-failed' })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Continuar con Google'))
    await waitFor(() => {
      expect(screen.getByText('Error al iniciar sesión. Intentá de nuevo.')).toBeInTheDocument()
    })
  })

  it('no muestra error si el usuario simplemente cerró el popup', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/popup-closed-by-user' })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Continuar con Google'))
    await waitFor(() => {
      expect(screen.getByText('Continuar con Google')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Error al iniciar sesión/)).not.toBeInTheDocument()
  })
})
