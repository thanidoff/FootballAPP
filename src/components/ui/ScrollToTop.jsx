import { useState, useEffect, useRef } from 'react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const animationFrame = useRef(null)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
    }
  }, [])

  const scrollToTop = () => {
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current)

    const startY = window.scrollY
    const startedAt = performance.now()
    const duration = Math.min(650, Math.max(360, startY * 0.35))
    const easeOutCubic = progress => 1 - Math.pow(1 - progress, 3)

    const animate = now => {
      const progress = Math.min((now - startedAt) / duration, 1)
      window.scrollTo(0, Math.round(startY * (1 - easeOutCubic(progress))))
      if (progress < 1) animationFrame.current = requestAnimationFrame(animate)
      else animationFrame.current = null
    }

    animationFrame.current = requestAnimationFrame(animate)
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[#0A1318] text-white shadow-xl transition-all duration-300 hover:bg-[#1a2830] active:scale-95
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
