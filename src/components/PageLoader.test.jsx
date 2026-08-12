import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PageLoader from './PageLoader'

describe('PageLoader', () => {
  it('renderiza un spinner', () => {
    const { container } = render(<PageLoader />)
    expect(container.querySelector('.spinner')).toBeInTheDocument()
  })
})
