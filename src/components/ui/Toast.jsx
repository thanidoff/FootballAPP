import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((message, type = 'success') => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type, visible: true }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350)
    }, 3000)
  }, [])

  const toast = {
    success: (msg) => add(msg, 'success'),
    error:   (msg) => add(msg, 'error'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-full px-4">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`transition-all duration-300 ease-out transform pointer-events-auto
              ${t.visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-3 opacity-0 scale-95'}`}
          >
            <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl font-heading font-bold text-sm tracking-wide whitespace-nowrap
              ${t.type === 'success' ? 'bg-[#0A1318] text-white' : 'bg-[#FD5461] text-white'}`}>
              {t.type === 'success' ? (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="flex-shrink-0">
                  <path d="M2.5 7.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="flex-shrink-0">
                  <circle cx="7.5" cy="7.5" r="6.5" stroke="white" strokeWidth="1.5"/>
                  <path d="M7.5 4.5v4M7.5 10.5v.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
              {t.message}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
