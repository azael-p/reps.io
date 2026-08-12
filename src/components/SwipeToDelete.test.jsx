import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SwipeToDelete from './SwipeToDelete'

function renderSwipe(props = {}) {
  render(
    <SwipeToDelete onDelete={vi.fn()} onClick={vi.fn()} {...props}>
      <div data-testid="child">Item</div>
    </SwipeToDelete>
  )
  return screen.getByTestId('child').parentElement
}

function swipe(el, { from, to, pointerId = 1, pointerType = 'touch', button = 0 }) {
  fireEvent.pointerDown(el, { clientX: from, pointerId, pointerType, button })
  fireEvent.pointerMove(el, { clientX: to, pointerId, pointerType })
  fireEvent.pointerUp(el, { clientX: to, pointerId, pointerType })
}

beforeEach(() => {
  document.body.classList.remove('dnd-active')
})

// ---------------------------------------------------------------------------

describe('SwipeToDelete — tap sin swipe', () => {
  it('un tap sin desplazamiento llama a onClick', () => {
    const onClick = vi.fn()
    const el = renderSwipe({ onClick })
    swipe(el, { from: 100, to: 100 })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('un desplazamiento mínimo (< 5px) todavía cuenta como tap', () => {
    const onClick = vi.fn()
    const el = renderSwipe({ onClick })
    swipe(el, { from: 100, to: 97 })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------

describe('SwipeToDelete — swipe hacia la izquierda', () => {
  it('un swipe que supera el threshold llama a onDelete y no a onClick', () => {
    const onDelete = vi.fn()
    const onClick = vi.fn()
    const el = renderSwipe({ onDelete, onClick, threshold: 60 })
    swipe(el, { from: 200, to: 200 - 61 })
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('un swipe que no llega al threshold no llama a onDelete ni a onClick', () => {
    const onDelete = vi.fn()
    const onClick = vi.fn()
    const el = renderSwipe({ onDelete, onClick, threshold: 60 })
    swipe(el, { from: 200, to: 200 - 30 })
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('respeta un threshold custom', () => {
    const onDelete = vi.fn()
    const el = renderSwipe({ onDelete, threshold: 20 })
    swipe(el, { from: 200, to: 200 - 25 })
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('un swipe hacia la derecha no llama a onDelete (solo se borra hacia la izquierda)', () => {
    const onDelete = vi.fn()
    const onClick = vi.fn()
    const el = renderSwipe({ onDelete, onClick, threshold: 60 })
    swipe(el, { from: 200, to: 200 + 80 })
    expect(onDelete).not.toHaveBeenCalled()
    // Un desplazamiento a la derecha no activa isSwipe (solo dx < -5 lo hace), así que cuenta como tap
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------

describe('SwipeToDelete — guards', () => {
  it('un click derecho de mouse no dispara onClick', () => {
    const onClick = vi.fn()
    const el = renderSwipe({ onClick })
    swipe(el, { from: 100, to: 100, pointerType: 'mouse', button: 2 })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('un click izquierdo de mouse sí dispara onClick', () => {
    const onClick = vi.fn()
    const el = renderSwipe({ onClick })
    swipe(el, { from: 100, to: 100, pointerType: 'mouse', button: 0 })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('si el drag & drop está activo (body.dnd-active), ignora el gesto por completo', () => {
    const onDelete = vi.fn()
    const onClick = vi.fn()
    const el = renderSwipe({ onDelete, onClick, threshold: 60 })
    document.body.classList.add('dnd-active')
    swipe(el, { from: 200, to: 200 - 80 })
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('tocar el drag handle (data-dnd-handle) no dispara onClick ni onDelete', () => {
    const onClick = vi.fn()
    const onDelete = vi.fn()
    render(
      <SwipeToDelete onDelete={onDelete} onClick={onClick}>
        <div data-testid="child">
          <span data-dnd-handle data-testid="handle">::</span>
        </div>
      </SwipeToDelete>
    )
    const wrap = screen.getByTestId('child').parentElement
    const handle = screen.getByTestId('handle')
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerMove(wrap, { clientX: 100, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerUp(wrap, { clientX: 100, pointerId: 1, pointerType: 'touch' })
    expect(onClick).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('tocar una zona marcada data-skip-swipe (ej. botones de acción) no dispara onClick', () => {
    const onClick = vi.fn()
    render(
      <SwipeToDelete onDelete={vi.fn()} onClick={onClick}>
        <div data-testid="child">
          <div data-skip-swipe>
            <button data-testid="accion">Editar</button>
          </div>
        </div>
      </SwipeToDelete>
    )
    const wrap = screen.getByTestId('child').parentElement
    const boton = screen.getByTestId('accion')
    fireEvent.pointerDown(boton, { clientX: 100, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerUp(wrap, { clientX: 100, pointerId: 1, pointerType: 'touch' })
    expect(onClick).not.toHaveBeenCalled()
  })
})
