vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))

// El objeto usuario debe tener identidad estable entre renders (como en la app
// real): un objeto nuevo por render dispara en loop los effects con dep [usuario].
const logoutMock = vi.hoisted(() => vi.fn())
const USUARIO = vi.hoisted(() => ({ id: 'user1', nombre: 'Azael' }))
vi.mock('../context/UserContext', () => ({
  useUser: () => ({ usuario: USUARIO, logout: logoutMock }),
}))

const showMock = vi.hoisted(() => vi.fn())
vi.mock('../components/Toast', () => ({ useToast: () => ({ show: showMock }) }))

vi.mock('../firebase/config', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, col, id) => ({ _col: col, _id: id })),
  getDoc: vi.fn(),
}))
vi.mock('../firebase/statsGlobal', () => ({ getResumenGlobalConFallback: vi.fn() }))
vi.mock('../firebase/dias', () => ({ getProximoDiaSugerido: vi.fn() }))
vi.mock('../firebase/sesiones', () => ({ crearSesion: vi.fn() }))

vi.mock('../components/Calendario', () => ({ default: () => <div data-testid="calendario" /> }))
vi.mock('../components/PullToRefresh', () => ({ default: ({ children }) => children }))
vi.mock('../components/Onboarding', () => ({
  default: ({ onCompletar }) => (
    <div data-testid="onboarding">
      <button onClick={onCompletar}>completar-onboarding</button>
    </div>
  ),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getDoc } from 'firebase/firestore'
import { getResumenGlobalConFallback } from '../firebase/statsGlobal'
import { getProximoDiaSugerido } from '../firebase/dias'
import { crearSesion } from '../firebase/sesiones'
import Home from './Home'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/" element={<div data-testid="login-page" />} />
        <Route path="/programas" element={<div data-testid="programas-page" />} />
        <Route path="/sesion/:sesionId" element={<div data-testid="sesion-activa" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('onboarding_user1', '1')
  getResumenGlobalConFallback.mockResolvedValue({ diasEntrenados: [], volumenPorSesion: [] })
  getProximoDiaSugerido.mockResolvedValue(null)
})

// ---------------------------------------------------------------------------

describe('Home — render básico', () => {
  it('muestra el saludo con el nombre del usuario', async () => {
    renderPage()
    expect(await screen.findByText(/, Azael/)).toBeInTheDocument()
  })

  it('muestra los accesos a programas, entrenar y progreso', async () => {
    renderPage()
    expect(screen.getByText('Mis programas')).toBeInTheDocument()
    expect(screen.getByText('Entrenar hoy')).toBeInTheDocument()
    expect(screen.getByText('Mi progreso')).toBeInTheDocument()
  })

  it('navega a /programas al tocar la sección', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Mis programas'))
    await screen.findByTestId('programas-page')
  })
})

// ---------------------------------------------------------------------------

describe('Home — sesión pendiente', () => {
  it('muestra el banner cuando hay una sesión activa sin completar', async () => {
    localStorage.setItem('sesion_activa_user1', 'ses1')
    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Push' }) })
    renderPage()
    expect(await screen.findByText('Push')).toBeInTheDocument()
  })

  it('si la sesión guardada ya está completada, no muestra banner y limpia localStorage', async () => {
    localStorage.setItem('sesion_activa_user1', 'ses1')
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: true }) })
    renderPage()
    await waitFor(() => {
      expect(localStorage.getItem('sesion_activa_user1')).toBeNull()
    })
    expect(screen.queryByText('Push')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('Home — atajo "Seguir" en la card de Entrenar hoy', () => {
  it('con un día sugerido, un tap crea la sesión y navega directo sin pasar por /entrenar', async () => {
    getResumenGlobalConFallback.mockResolvedValue({ diasEntrenados: [], ultimoDiaId: 'dia1' })
    getProximoDiaSugerido.mockResolvedValue({ dia: { id: 'dia1', nombre: 'Pierna' }, programaId: 'prog1', numero: 3 })
    crearSesion.mockReturnValue({ id: 'nueva-sesion', listo: Promise.resolve() })
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Seguir: Pierna')
    await user.click(screen.getByText('Seguir: Pierna'))

    expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    await screen.findByTestId('sesion-activa')
  })

  it('sin día sugerido, la card se comporta como siempre (navega a /entrenar)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Entrenar hoy')
    await user.click(screen.getByText('Entrenar hoy'))
    expect(crearSesion).not.toHaveBeenCalled()
  })

  it('con una sesión pendiente, no calcula ni muestra la sugerencia', async () => {
    localStorage.setItem('sesion_activa_user1', 'ses1')
    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Push' }) })
    getResumenGlobalConFallback.mockResolvedValue({ diasEntrenados: [], ultimoDiaId: 'dia1' })
    renderPage()

    await screen.findByText('Push')
    expect(getProximoDiaSugerido).not.toHaveBeenCalled()
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('Home — logout', () => {
  it('espera el logout y navega al login', async () => {
    logoutMock.mockResolvedValue()
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTitle('Salir'))
    await waitFor(() => expect(logoutMock).toHaveBeenCalledOnce())
    await screen.findByTestId('login-page')
  })

  it('si el logout falla, muestra un toast de error y no navega', async () => {
    logoutMock.mockRejectedValue(new Error('offline'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTitle('Salir'))
    await waitFor(() => {
      expect(showMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    })
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
    consoleError.mockRestore()
  })
})

// ---------------------------------------------------------------------------

describe('Home — onboarding', () => {
  it('se muestra para usuarios nuevos y se marca como completado al terminar', async () => {
    localStorage.removeItem('onboarding_user1')
    renderPage()
    expect(await screen.findByTestId('onboarding')).toBeInTheDocument()
    fireEvent.click(screen.getByText('completar-onboarding'))
    await waitFor(() => {
      expect(localStorage.getItem('onboarding_user1')).toBe('1')
    })
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })

  it('no se muestra si ya fue completado', async () => {
    renderPage()
    await screen.findByText(/, Azael/)
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })
})
