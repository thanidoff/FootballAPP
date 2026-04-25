import { useState, useEffect } from 'react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-[#0A1318] text-white shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer hover:bg-[#1a2830] active:scale-95
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
