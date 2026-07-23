import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const titleId = useId()
  const previousFocus = useRef(null)
  const dialogRef = useRef(null)
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
    const dialog = dialogRef.current
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const firstFocusable = dialog?.querySelector(focusableSelector)
    ;(firstFocusable || dialog)?.focus?.({ preventScroll: true })
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll(focusableSelector)].filter(element => !element.hasAttribute('hidden'))
      if (!focusable.length) {
        e.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [rendered, closing, onClose])

  if (!shouldRender) return null

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${closing ? 'ui-overlay-exit' : 'ui-overlay-enter'}`}>
      <button tabIndex={-1} aria-label="Close modal" className="absolute inset-0 bg-[#0A1318]/55 backdrop-blur-sm" onClick={onClose} disabled={closing} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex w-full ${width} max-h-[min(700px,calc(100dvh-2rem))] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${closing ? 'ui-modal-exit' : 'ui-modal-enter'}`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-6 py-5 sm:px-8">
          <h2 id={titleId} className="type-heading text-[#0A1318]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            disabled={closing}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 ui-transition-fast transition-[background-color,color,transform] hover:bg-gray-100 hover:text-gray-700 active:scale-95"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6 scrollbar-hide sm:px-8">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
