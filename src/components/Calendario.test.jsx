// AnimatePresence holds exiting elements for exit animations; replace with a
// simple pass-through so filtered/removed items are gone immediately in tests.
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Calendario from './Calendario'

// Use local date constructor to avoid UTC offset issues (same as the component's
// getDate()/getMonth()/getFullYear() usage).
const ts = (y, m, d) => {
  const date = new Date(y, m - 1, d)
  return { toDate: () => date, toMillis: () => date.getTime() }
}

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0)) // local May 15 2026
})
afterAll(() => vi.useRealTimers())

describe('Calendario', () => {
  it('renders the current month header', () => {
    render(<Calendario fechas={[]} />)
    expect(screen.getByText('Mayo 2026')).toBeInTheDocument()
  })

  it('renders all 7 day-of-week headers', () => {
    render(<Calendario fechas={[]} />)
    for (const d of ['L', 'M', 'X', 'J', 'V', 'S', 'D']) {
      expect(screen.getAllByText(d).length).toBeGreaterThan(0)
    }
  })

  it('navigates to the previous month', () => {
    render(<Calendario fechas={[]} />)
    fireEvent.click(screen.getByText('‹'))
    expect(screen.getByText('Abril 2026')).toBeInTheDocument()
  })

  it('navigates to the next month', () => {
    render(<Calendario fechas={[]} />)
    fireEvent.click(screen.getByText('›'))
    expect(screen.getByText('Junio 2026')).toBeInTheDocument()
  })

  it('shows the session counter when there are sessions this month', () => {
    render(<Calendario fechas={[ts(2026, 5, 10), ts(2026, 5, 12), ts(2026, 5, 14)]} />)
    expect(screen.getByText('3 sesiones')).toBeInTheDocument()
  })

  it('shows session counter for a single session', () => {
    render(<Calendario fechas={[ts(2026, 5, 10)]} />)
    expect(screen.getByText('1 sesiones')).toBeInTheDocument()
  })

  it('does not show session counter when there are no sessions', () => {
    render(<Calendario fechas={[]} />)
    expect(screen.queryByText(/sesiones/)).not.toBeInTheDocument()
  })

  it('does not count sessions from other months', () => {
    render(<Calendario fechas={[ts(2026, 4, 10), ts(2026, 6, 1)]} />)
    expect(screen.queryByText(/sesiones/)).not.toBeInTheDocument()
  })

  it('renders day numbers for the current month', () => {
    render(<Calendario fechas={[]} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })
})
