import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SerieFooter from './SerieFooter'

function renderFooter(props = {}) {
  return render(
    <SerieFooter
      footerClassName="sa-footer"
      onCompletar={vi.fn()} repsHechas="8" guardando={false} celebrar={false}
      esUltimaSerie={false} esUltimoEjercicio={false} serieActual={1}
      hayHistorial={false} onVolver={vi.fn()}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------

describe('SerieFooter — el CTA no se desplaza entre series (#17)', () => {
  it('sin historial, "Corregir serie anterior" está en el documento pero no visible (el espacio queda reservado)', () => {
    renderFooter({ hayHistorial: false })
    const volver = screen.getByText('Corregir serie anterior').closest('button')
    expect(volver).toBeInTheDocument()
    expect(volver).not.toBeVisible()
  })

  it('con historial, "Corregir serie anterior" es visible', () => {
    renderFooter({ hayHistorial: true })
    expect(screen.getByText('Corregir serie anterior').closest('button')).toBeVisible()
  })

  it('tocar "Corregir serie anterior" llama a onVolver', async () => {
    const onVolver = vi.fn()
    const user = userEvent.setup()
    renderFooter({ hayHistorial: true, onVolver })
    await user.click(screen.getByText('Corregir serie anterior'))
    expect(onVolver).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------

describe('SerieFooter — botón principal', () => {
  it('deshabilitado sin reps cargadas', () => {
    renderFooter({ repsHechas: '' })
    expect(screen.getByRole('button', { name: /Completar serie/ })).toBeDisabled()
  })

  it('tocar el CTA llama a onCompletar', async () => {
    const onCompletar = vi.fn()
    const user = userEvent.setup()
    renderFooter({ onCompletar })
    await user.click(screen.getByRole('button', { name: /Completar serie/ }))
    expect(onCompletar).toHaveBeenCalledOnce()
  })
})
