import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function useOverlayBehavior(open, onClose) {
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const previousFocus = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const shouldRender = open || rendered

  useLayoutEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement
      setRendered(true)
      setClosing(false)
      return
    }
    if (!rendered) return
    setClosing(true)
    const timer = window.setTimeout(() => {
      setRendered(false)
      setClosing(false)
      previousFocus.current?.focus?.()
    }, 140)
    return () => window.clearTimeout(timer)
  }, [open, rendered])

  useLayoutEffect(() => {
    if (!shouldRender) return
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [shouldRender])

  useEffect(() => {
    if (!rendered || closing) return
    const handleKeyDown = event => { if (event.key === 'Escape') onCloseRef.current?.() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [rendered, closing])

  return { shouldRender, closing }
}
