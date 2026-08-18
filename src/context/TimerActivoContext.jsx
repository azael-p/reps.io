import { createContext, useContext, useState, useMemo } from 'react'

const TimerActivoContext = createContext(null)

export function TimerActivoProvider({ children }) {
  const [timerActivo, setTimerActivo] = useState(false)
  const value = useMemo(() => ({ timerActivo, setTimerActivo }), [timerActivo])
  return (
    <TimerActivoContext.Provider value={value}>
      {children}
    </TimerActivoContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTimerActivo() {
  return useContext(TimerActivoContext)
}
