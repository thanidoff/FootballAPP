import { useEffect, useState } from 'react'

export default function PageWrapper({ children, className = '' }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <div
      className={`transition-all duration-300 ease-out ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${className}`}
    >
      {children}
    </div>
  )
}
