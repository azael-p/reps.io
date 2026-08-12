import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import LazyPanel from './LazyPanel'

let instances

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback
    instances.push(this)
  }
  observe() {}
  disconnect() {}
  trigger(isIntersecting) {
    this.callback([{ isIntersecting }])
  }
}

beforeEach(() => {
  instances = []
  global.IntersectionObserver = MockIntersectionObserver
})

afterEach(() => {
  delete global.IntersectionObserver
})

describe('LazyPanel', () => {
  it('no renderiza los children hasta que el panel entra en viewport', () => {
    render(<LazyPanel><div data-testid="pesado">Gráfico</div></LazyPanel>)
    expect(screen.queryByTestId('pesado')).not.toBeInTheDocument()
  })

  it('renderiza los children cuando el observer dispara isIntersecting', () => {
    render(<LazyPanel><div data-testid="pesado">Gráfico</div></LazyPanel>)
    act(() => { instances[0].trigger(true) })
    expect(screen.getByTestId('pesado')).toBeInTheDocument()
  })

  it('ignora los disparos con isIntersecting=false', () => {
    render(<LazyPanel><div data-testid="pesado">Gráfico</div></LazyPanel>)
    act(() => { instances[0].trigger(false) })
    expect(screen.queryByTestId('pesado')).not.toBeInTheDocument()
  })

  it('el placeholder usa minHeight para no saltar el scroll', () => {
    render(<LazyPanel minHeight={300}><div>x</div></LazyPanel>)
    expect(screen.getByTestId('lazy-placeholder')).toHaveStyle({ minHeight: '300px' })
  })
})
