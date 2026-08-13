import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

export default function JokeGenerator({ fallbackApi = 'https://official-joke-api.appspot.com/random_joke' }) {
  const [joke, setJoke] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchJoke() {
    setLoading(true)
    setError(null)
    setJoke(null)
    try {
      // Try icanhazdadjoke first (supports CORS) and fall back to the provided API
      const res1 = await fetch('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' } })
      if (res1.ok) {
        const data = await res1.json()
        if (data && data.joke) {
          setJoke({ text: data.joke })
          setLoading(false)
          return
        }
      }

      // Fallback
      const res2 = await fetch(fallbackApi)
      if (!res2.ok) throw new Error('API error')
      const d = await res2.json()
      // official-joke-api returns { setup, punchline }
      if (d.setup && d.punchline) {
        setJoke({ text: `${d.setup} \n\n${d.punchline}` })
      } else if (d.joke) {
        setJoke({ text: d.joke })
      } else {
        setJoke({ text: JSON.stringify(d) })
      }
    } catch (e) {
      console.error('fetchJoke', e)
      setError('No se pudo obtener un chiste. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJoke() }, [])

  return (
    <div className="joke-generator" style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, boxShadow: 'var(--shadow-md)' }}
      >
        <h2 style={{ margin: '0 0 8px 0' }}>Chistes aleatorios</h2>

        {loading && (
          <div style={{ padding: '12px 0' }}>
            <span className="spinner" style={{ color: 'var(--orange)' }} />
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', padding: '8px 0' }}>{error}</div>
        )}

        {joke && (
          <motion.p
            key={joke.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ whiteSpace: 'pre-wrap', margin: '8px 0 16px 0' }}
          >
            {joke.text}
          </motion.p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={fetchJoke} disabled={loading}>
            {loading ? 'Cargando...' : 'Otro chiste'}
          </button>
          <button className="btn btn-ghost" onClick={() => { setJoke(null); setError(null); fetchJoke() }} disabled={loading}>
            Reiniciar
          </button>
        </div>
      </motion.div>
    </div>
  )
}
