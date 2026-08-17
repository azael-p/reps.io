vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../context/UserContext', () => {
  const usuario = { id: 'user1' }
  return { useUser: () => ({ usuario }) }
})

vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))

const mockShow = vi.fn()
vi.mock('../components/Toast', () => ({
  useToast: () => ({ show: mockShow }),
}))

// Expone onReorder como un botón: simular el drag real de @dnd-kit en jsdom
// no aporta nada acá, lo que se testea es el manejo del fallo de escritura.
vi.mock('../components/DnDList', () => ({
  default: ({ items, onReorder, renderItem }) => (
    <div>
      <button onClick={() => onReorder([...items].reverse().map((it, i) => ({ ...it, orden: i })))}>
        reordenar
      </button>
      {items.map((item, i) => {
        const render = renderItem(item, i)
        return <div key={item.id}>{render({ dragHandleProps: {} })}</div>
      })}
    </div>
  ),
}))

vi.mock('../firebase/programas', () => ({
  getProgramas: vi.fn(),
  crearPrograma: vi.fn(),
  editarPrograma: vi.fn(),
  marcarParaEliminar: vi.fn(),
  desmarcarParaEliminar: vi.fn(),
  eliminarProgramaDefinitivo: vi.fn(),
  reordenarProgramas: vi.fn(),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Programas from './Programas'
import {
  getProgramas, crearPrograma, editarPrograma, reordenarProgramas,
  marcarParaEliminar, desmarcarParaEliminar, eliminarProgramaDefinitivo,
} from '../firebase/programas'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/programas']}>
      <Programas />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------

describe('Programas — crear', () => {
  beforeEach(() => {
    getProgramas.mockResolvedValue([])
  })

  it('valida que el nombre no esté vacío al confirmar con Enter', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /crear programa/i }))
    const input = screen.getByPlaceholderText('Nombre del programa')
    await user.type(input, '{Enter}')
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(crearPrograma).not.toHaveBeenCalled()
  })

  it('crea el programa con el nombre ingresado (trimmed) y muestra un toast', async () => {
    crearPrograma.mockResolvedValue('nuevo-id')
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /crear programa/i }))
    await user.type(screen.getByPlaceholderText('Nombre del programa'), '  Push Day  ')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(crearPrograma).toHaveBeenCalledWith('user1', 'Push Day')
    })
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ message: 'Programa creado' }))
  })
})

// ---------------------------------------------------------------------------

describe('Programas — eliminar con deshacer', () => {
  beforeEach(() => {
    getProgramas.mockResolvedValue([{ id: 'p1', nombre: 'Push Day', orden: 0 }])
  })

  it('al eliminar: marca para eliminar y lo saca de la lista inmediatamente (optimista)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push Day')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(marcarParaEliminar).toHaveBeenCalledWith('p1')
    expect(screen.queryByText('Push Day')).not.toBeInTheDocument()
  })

  it('muestra el toast con acción "Deshacer" y onTimeout definido', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push Day')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      message: '"Push Day" eliminado',
      duration: 5000,
      action: expect.objectContaining({ label: 'Deshacer', onClick: expect.any(Function) }),
      onTimeout: expect.any(Function),
    }))
  })

  it('"Deshacer" desmarca el programa y recarga la lista', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push Day')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    const { action } = mockShow.mock.calls[0][0]
    getProgramas.mockResolvedValueOnce([{ id: 'p1', nombre: 'Push Day', orden: 0 }])
    await action.onClick()

    expect(desmarcarParaEliminar).toHaveBeenCalledWith('p1')
    await waitFor(() => expect(getProgramas).toHaveBeenCalledTimes(2)) // carga inicial + reload tras deshacer
  })

  it('si expira el timeout sin deshacer, borra el programa definitivamente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push Day')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    const { onTimeout } = mockShow.mock.calls[0][0]
    onTimeout()

    expect(eliminarProgramaDefinitivo).toHaveBeenCalledWith('p1')
    expect(desmarcarParaEliminar).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('Programas — editar', () => {
  beforeEach(() => {
    getProgramas.mockResolvedValue([{ id: 'p1', nombre: 'Push Day', orden: 0 }])
  })

  it('precarga el nombre actual y llama a editarPrograma al guardar', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push Day')
    await user.click(screen.getByRole('button', { name: /renombrar/i }))

    const input = screen.getByPlaceholderText('Nombre del programa')
    expect(input).toHaveValue('Push Day')

    await user.clear(input)
    await user.type(input, 'Pull Day')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(editarPrograma).toHaveBeenCalledWith('p1', 'Pull Day')
    })
  })
})

describe('Programas — fallo al reordenar', () => {
  beforeEach(() => {
    getProgramas.mockResolvedValue([
      { id: 'p1', nombre: 'PPL', orden: 0 },
      { id: 'p2', nombre: 'Full Body', orden: 1 },
    ])
  })

  it('revierte el orden local y muestra un toast de error', async () => {
    const user = userEvent.setup()
    reordenarProgramas.mockRejectedValue(new Error('sin red'))
    renderPage()
    await screen.findByText('PPL')

    await user.click(screen.getByRole('button', { name: 'reordenar' }))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
        message: 'No se pudo guardar el orden. Intentá de nuevo.',
        variant: 'error',
      }))
    })
    const nombres = screen.getAllByText(/^(PPL|Full Body)$/).map(n => n.textContent)
    expect(nombres[0]).toBe('PPL')
  })
})
