import { useEffect, useState } from 'react'

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    let raf1, raf2, timer
    if (open) {
      setRendered(true)
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true))
      })
      document.body.style.overflow = 'hidden'
    } else {
      setVisible(false)
      timer = setTimeout(() => setRendered(false), 250)
      document.body.style.overflow = ''
    }
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(timer)
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!rendered) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-250 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={`relative w-full ${width} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] transition-all duration-250
          ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-heading font-black text-xl uppercase tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {/* Scrollable body */}
        <div className="px-6 py-5 overflow-y-auto scrollbar-hide">{children}</div>
      </div>
    </div>
  )
}
