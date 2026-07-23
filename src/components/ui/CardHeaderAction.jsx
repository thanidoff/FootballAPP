import { ArrowRight } from 'lucide-react'

export default function CardHeaderAction({ children, onClick, ariaLabel }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#FD5461] transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD5461]/30">
      <span>{children}</span>
      <ArrowRight size={15} strokeWidth={2} />
    </button>
  )
}
