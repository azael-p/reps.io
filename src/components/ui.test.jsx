vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Modal, ConfirmDialog, Badge } from './ui'

function withRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function ModalHarness({ initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <p>Contenido del modal</p>
      </Modal>
    </>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------

describe('Modal', () => {
  it('no renderiza nada cuando open=false', () => {
    withRouter(<Modal open={false} onClose={vi.fn()}><p>Hola</p></Modal>)
    expect(screen.queryByText('Hola')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renderiza los children con role="dialog" cuando open=true', () => {
    withRouter(<Modal open={true} onClose={vi.fn()}><p>Hola</p></Modal>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hola')).toBeInTheDocument()
  })

  it('clickear el overlay (fuera del contenido) llama a onClose', () => {
    const onClose = vi.fn()
    withRouter(<Modal open={true} onClose={onClose}><p>Hola</p></Modal>)
    // El role="dialog" vive en el contenido; el overlay es su padre.
    fireEvent.click(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clickear el contenido del modal NO llama a onClose', () => {
    const onClose = vi.fn()
    withRouter(<Modal open={true} onClose={onClose}><p>Hola</p></Modal>)
    fireEvent.click(screen.getByText('Hola'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('navegar hacia atrás (popstate) cierra el modal', async () => {
    const user = userEvent.setup()
    withRouter(<ModalHarness />)
    await user.click(screen.getByText('abrir'))
    expect(screen.getByText('Contenido del modal')).toBeInTheDocument()

    fireEvent(window, new PopStateEvent('popstate'))

    await waitFor(() => {
      expect(screen.queryByText('Contenido del modal')).not.toBeInTheDocument()
    })
  })

  it('al abrirse, mueve el foco al primer elemento enfocable dentro del modal', async () => {
    withRouter(
      <Modal open={true} onClose={vi.fn()}>
        <button>Primero</button>
        <button>Segundo</button>
      </Modal>
    )
    await waitFor(() => {
      expect(screen.getByText('Primero')).toHaveFocus()
    })
  })
})

// ---------------------------------------------------------------------------

describe('ConfirmDialog', () => {
  it('no renderiza nada si data es null', () => {
    withRouter(<ConfirmDialog open={false} data={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra título y descripción', () => {
    withRouter(
      <ConfirmDialog
        open={true}
        data={{ titulo: '¿Eliminar?', descripcion: 'No se puede deshacer', onConfirm: vi.fn() }}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('¿Eliminar?')).toBeInTheDocument()
    expect(screen.getByText('No se puede deshacer')).toBeInTheDocument()
  })

  it('usa las etiquetas por defecto "Cancelar" y "Eliminar" si no se especifican', () => {
    withRouter(
      <ConfirmDialog open={true} data={{ titulo: 'x', onConfirm: vi.fn() }} onClose={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('permite etiquetas custom para confirmar/cancelar', () => {
    withRouter(
      <ConfirmDialog
        open={true}
        data={{ titulo: 'x', onConfirm: vi.fn(), confirmLabel: 'Sí, archivar', cancelLabel: 'Volver' }}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Sí, archivar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  })

  it('cancelar llama a onClose sin llamar a onConfirm', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    withRouter(
      <ConfirmDialog open={true} data={{ titulo: 'x', onConfirm }} onClose={onClose} />
    )
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('confirmar llama a onConfirm y luego a onClose', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const user = userEvent.setup()
    withRouter(
      <ConfirmDialog open={true} data={{ titulo: 'x', onConfirm }} onClose={onClose} />
    )
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('si onConfirm rechaza, igual llama a onClose (no deja el diálogo colgado)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('fallo de red'))
    const onClose = vi.fn()
    const user = userEvent.setup()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    withRouter(
      <ConfirmDialog open={true} data={{ titulo: 'x', onConfirm }} onClose={onClose} />
    )
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    errorSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------

describe('Badge', () => {
  it('renderiza el contenido', () => {
    render(<Badge>Pecho</Badge>)
    expect(screen.getByText('Pecho')).toBeInTheDocument()
  })

  it('no rompe con un color no reconocido (cae al default)', () => {
    render(<Badge color="inexistente">X</Badge>)
    expect(screen.getByText('X')).toBeInTheDocument()
  })
})
