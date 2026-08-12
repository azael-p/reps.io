import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useKeyboardShortcut } from './useKeyboardShortcut'

function ShortcutFixture({ onMatch }) {
  useKeyboardShortcut('n', onMatch)
  return (
    <div>
      <input data-testid="input" />
      <textarea data-testid="textarea" />
      <div contentEditable data-testid="editable" />
      <button data-testid="button">btn</button>
    </div>
  )
}

// ---------------------------------------------------------------------------

describe('useKeyboardShortcut', () => {
  it('llama al handler cuando se presiona la tecla configurada', () => {
    const onMatch = vi.fn()
    render(<ShortcutFixture onMatch={onMatch} />)
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(onMatch).toHaveBeenCalledTimes(1)
  })

  it('la comparación de tecla es case-insensitive', () => {
    const onMatch = vi.fn()
    render(<ShortcutFixture onMatch={onMatch} />)
    fireEvent.keyDown(document.body, { key: 'N' })
    expect(onMatch).toHaveBeenCalledTimes(1)
  })

  it('no llama al handler con una tecla distinta', () => {
    const onMatch = vi.fn()
    render(<ShortcutFixture onMatch={onMatch} />)
    fireEvent.keyDown(document.body, { key: 'm' })
    expect(onMatch).not.toHaveBeenCalled()
  })

  it('no dispara el atajo si el foco está en un input', () => {
    const onMatch = vi.fn()
    render(<ShortcutFixture onMatch={onMatch} />)
    fireEvent.keyDown(screen.getByTestId('input'), { key: 'n' })
    expect(onMatch).not.toHaveBeenCalled()
  })

  it('no dispara el atajo si el foco está en un textarea', () => {
    const onMatch = vi.fn()
    render(<ShortcutFixture onMatch={onMatch} />)
    fireEvent.keyDown(screen.getByTestId('textarea'), { key: 'n' })
    expect(onMatch).not.toHaveBeenCalled()
  })

  it('sí dispara el atajo si el foco está en un elemento no editable (ej. un botón)', () => {
    const onMatch = vi.fn()
    render(<ShortcutFixture onMatch={onMatch} />)
    fireEvent.keyDown(screen.getByTestId('button'), { key: 'n' })
    expect(onMatch).toHaveBeenCalledTimes(1)
  })

  it('deja de escuchar tras desmontar el componente', () => {
    const onMatch = vi.fn()
    const { unmount } = render(<ShortcutFixture onMatch={onMatch} />)
    unmount()
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(onMatch).not.toHaveBeenCalled()
  })

  it('al re-renderizar con un handler nuevo, usa el handler actualizado', () => {
    const onMatchViejo = vi.fn()
    const onMatchNuevo = vi.fn()
    const { rerender } = render(<ShortcutFixture onMatch={onMatchViejo} />)
    rerender(<ShortcutFixture onMatch={onMatchNuevo} />)
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(onMatchViejo).not.toHaveBeenCalled()
    expect(onMatchNuevo).toHaveBeenCalledTimes(1)
  })
})
