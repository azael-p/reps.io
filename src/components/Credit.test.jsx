import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Credit from './Credit'

describe('Credit', () => {
  it('muestra el texto de crédito con el nombre', () => {
    render(<Credit />)
    expect(screen.getByText(/Diseñado por/)).toBeInTheDocument()
    expect(screen.getByText('Azael Pignanessi')).toBeInTheDocument()
  })

  it('el link apunta al sitio del autor y abre en una pestaña nueva', () => {
    render(<Credit />)
    const link = screen.getByRole('link', { name: 'Azael Pignanessi' })
    expect(link).toHaveAttribute('href', 'https://azael-p.github.io/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
