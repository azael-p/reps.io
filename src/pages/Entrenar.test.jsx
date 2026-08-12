vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))

vi.mock('../context/UserContext', () => {
  const usuario = { id: 'user1' }
  return { useUser: () => ({ usuario }) }
})

vi.mock('../firebase/config', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, col, id) => ({ _col: col, _id: id })),
  getDoc: vi.fn(),
}))

vi.mock('../firebase/programas', () => ({ getProgramas: vi.fn() }))
vi.mock('../firebase/dias', () => ({ getDias: vi.fn() }))
vi.mock('../firebase/sesiones', () => ({ crearSesion: vi.fn() }))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getDoc } from 'firebase/firestore'
import { getProgramas } from '../firebase/programas'
import { getDias } from '../firebase/dias'
import { crearSesion } from '../firebase/sesiones'
import Entrenar from './Entrenar'

const PROGRAMA = { id: 'prog1', nombre: 'PPL' }
const DIA = { id: 'dia1', nombre: 'Día de pecho' }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/entrenar']}>
      <Routes>
        <Route path="/entrenar" element={<Entrenar />} />
        <Route path="/sesion/:sesionId" element={<div data-testid="sesion-activa" />} />
        <Route path="/programas" element={<div data-testid="programas-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

async function elegirProgramaYDia(user) {
  await user.click(await screen.findByText('PPL'))
  await user.click(await screen.findByText('Día de pecho'))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  getProgramas.mockResolvedValue([PROGRAMA])
  getDias.mockResolvedValue([DIA])
})

// ---------------------------------------------------------------------------

describe('Entrenar — selección', () => {
  it('carga los días del programa al elegirlo', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('PPL'))
    expect(getDias).toHaveBeenCalledWith('prog1')
    await screen.findByText('Día de pecho')
  })

  it('el botón "Empezar entrenamiento" no aparece hasta elegir un día', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.queryByText('Empezar entrenamiento')).not.toBeInTheDocument()
    await user.click(await screen.findByText('PPL'))
    expect(screen.queryByText('Empezar entrenamiento')).not.toBeInTheDocument()
    await user.click(await screen.findByText('Día de pecho'))
    expect(screen.getByText('Empezar entrenamiento')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('Entrenar — empezar() sin sesión activa guardada', () => {
  it('crea una sesión nueva y navega a ella', async () => {
    crearSesion.mockResolvedValue('nueva-sesion')
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    })
    expect(localStorage.getItem('sesion_activa_user1')).toBe('nueva-sesion')
    await screen.findByTestId('sesion-activa')
  })

  it('si crearSesion falla, muestra un error y no navega', async () => {
    crearSesion.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await waitFor(() => {
      expect(screen.getByText('Error al crear la sesión')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('sesion-activa')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('Entrenar — empezar() con sesión activa guardada en localStorage', () => {
  beforeEach(() => {
    localStorage.setItem('sesion_activa_user1', 'sesion-guardada')
  })

  it('retoma la sesión guardada si coincide el día y no está completada (no crea una nueva)', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await screen.findByTestId('sesion-activa')
    expect(crearSesion).not.toHaveBeenCalled()
  })

  it('si la sesión guardada es de otro día, crea una sesión nueva en su lugar', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'otro-dia', completada: false }) })
    crearSesion.mockResolvedValue('nueva-sesion')
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    })
  })

  it('si la sesión guardada ya está completada, crea una sesión nueva en su lugar', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: true }) })
    crearSesion.mockResolvedValue('nueva-sesion')
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    })
  })

  it('si el documento de la sesión guardada ya no existe, crea una sesión nueva en su lugar', async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined })
    crearSesion.mockResolvedValue('nueva-sesion')
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    })
  })

  it('si falla la lectura de la sesión guardada, cae al flujo de crear sesión nueva', async () => {
    getDoc.mockRejectedValue(new Error('offline'))
    crearSesion.mockResolvedValue('nueva-sesion')
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    })
  })
})
