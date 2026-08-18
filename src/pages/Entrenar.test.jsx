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
vi.mock('../firebase/dias', () => ({ getDias: vi.fn(), getProximoDiaSugerido: vi.fn() }))
vi.mock('../firebase/statsGlobal', () => ({ getResumenGlobalConFallback: vi.fn() }))
vi.mock('../firebase/sesiones', () => ({ crearSesion: vi.fn(), eliminarSesion: vi.fn() }))

const mockShow = vi.fn()
vi.mock('../components/Toast', () => ({
  useToast: () => ({ show: mockShow }),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getDoc } from 'firebase/firestore'
import { getProgramas } from '../firebase/programas'
import { getDias, getProximoDiaSugerido } from '../firebase/dias'
import { getResumenGlobalConFallback } from '../firebase/statsGlobal'
import { crearSesion, eliminarSesion } from '../firebase/sesiones'
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
  getResumenGlobalConFallback.mockResolvedValue({ diasEntrenados: [], ultimoDiaId: null })
  getProximoDiaSugerido.mockResolvedValue(null)
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
    crearSesion.mockReturnValue({ id: 'nueva-sesion', listo: Promise.resolve() })
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

  it('si la escritura de crearSesion falla en el servidor, igual navega (el id ya es válido en el cache local) y avisa por toast', async () => {
    const listo = Promise.reject(new Error('fail'))
    listo.catch(() => {}) // evita el warning de unhandled rejection entre el mock y el .catch real del componente
    crearSesion.mockReturnValue({ id: 'nueva-sesion', listo })
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await screen.findByTestId('sesion-activa')
    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning' }))
    })
  })

  it('si crearSesion falla sincrónicamente, muestra un error y no navega', async () => {
    crearSesion.mockImplementation(() => { throw new Error('fail') })
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

  it('si la sesión guardada ya está completada, crea una sesión nueva en su lugar', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: true }) })
    crearSesion.mockReturnValue({ id: 'nueva-sesion', listo: Promise.resolve() })
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
    crearSesion.mockReturnValue({ id: 'nueva-sesion', listo: Promise.resolve() })
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
    crearSesion.mockReturnValue({ id: 'nueva-sesion', listo: Promise.resolve() })
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    })
  })
})

// ---------------------------------------------------------------------------

describe('Entrenar — autoselección con un solo programa', () => {
  it('muestra los días del único programa sin tener que elegirlo primero', async () => {
    renderPage()
    await screen.findByText('Día de pecho')
    expect(getDias).toHaveBeenCalledWith('prog1')
  })
})

// ---------------------------------------------------------------------------

describe('Entrenar — sugerencia "Seguir"', () => {
  const PROGRAMA2 = { id: 'prog2', nombre: 'PPL2' }
  const DIA_SUGERIDO = { id: 'dia2', nombre: 'Día de espalda' }

  beforeEach(() => {
    // Dos programas: sin esto la autoselección ya deja todo listo y no se
    // puede distinguir el efecto de la sugerencia.
    getProgramas.mockResolvedValue([PROGRAMA, PROGRAMA2])
    getDias.mockImplementation(id => Promise.resolve(id === 'prog2' ? [DIA_SUGERIDO] : [DIA]))
    getResumenGlobalConFallback.mockResolvedValue({ diasEntrenados: [], ultimoDiaId: 'algun-dia' })
    getProximoDiaSugerido.mockResolvedValue({ dia: DIA_SUGERIDO, programaId: 'prog2', numero: 3 })
  })

  it('un tap sobre "Seguir" preselecciona programa y día, dejando "Empezar" como único paso restante', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('Día de espalda'))

    expect(getDias).toHaveBeenCalledWith('prog2')
    expect(screen.getByText('Empezar entrenamiento')).toBeInTheDocument()
  })

  it('no se muestra si no hay último día entrenado', async () => {
    getResumenGlobalConFallback.mockResolvedValue({ diasEntrenados: [], ultimoDiaId: null })
    getProximoDiaSugerido.mockResolvedValue(null)
    renderPage()
    await screen.findByText('PPL')
    expect(screen.queryByText(/^Seguir:/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('Entrenar — sesión guardada de OTRO día (conflicto)', () => {
  beforeEach(() => {
    localStorage.setItem('sesion_activa_user1', 'sesion-guardada')
    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ diaId: 'otro-dia', completada: false }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Día de espalda' }) })
  })

  it('no crea una sesión nueva de una: muestra el modal de conflicto con el nombre del día pendiente', async () => {
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))

    expect(await screen.findByText('Sesión sin terminar')).toBeInTheDocument()
    expect(screen.getByText('Día de espalda')).toBeInTheDocument()
    expect(crearSesion).not.toHaveBeenCalled()
  })

  it('"Continuar" navega a la sesión pendiente sin crear ni borrar nada', async () => {
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))
    await user.click(await screen.findByText('Continuar'))

    await screen.findByTestId('sesion-activa')
    expect(crearSesion).not.toHaveBeenCalled()
    expect(eliminarSesion).not.toHaveBeenCalled()
  })

  it('"Volver" cierra el modal sin crear ni borrar nada', async () => {
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))
    await user.click(await screen.findByText('Volver'))

    await waitFor(() => {
      expect(screen.queryByText('Sesión sin terminar')).not.toBeInTheDocument()
    })
    expect(crearSesion).not.toHaveBeenCalled()
    expect(eliminarSesion).not.toHaveBeenCalled()
  })

  it('"Descartar y empezar de nuevo" borra la sesión pendiente y crea una nueva para el día elegido', async () => {
    eliminarSesion.mockResolvedValue(undefined)
    crearSesion.mockReturnValue({ id: 'nueva-sesion', listo: Promise.resolve() })
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))
    await user.click(await screen.findByText('Descartar y empezar de nuevo'))

    await waitFor(() => expect(eliminarSesion).toHaveBeenCalledWith('sesion-guardada'))
    expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    await screen.findByTestId('sesion-activa')
  })

  it('si falla el descarte, muestra un error y no crea la sesión nueva', async () => {
    eliminarSesion.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderPage()
    await elegirProgramaYDia(user)
    await user.click(screen.getByText('Empezar entrenamiento'))
    await user.click(await screen.findByText('Descartar y empezar de nuevo'))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    })
    expect(crearSesion).not.toHaveBeenCalled()
  })
})
