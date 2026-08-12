import { useEffect } from 'react'

export function useKeyboardShortcut(key, handler, deps = []) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        handler(e)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handler, ...deps])
}