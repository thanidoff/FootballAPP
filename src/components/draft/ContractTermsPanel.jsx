import Select from '../ui/Select'
import { formatCurrency } from '../../utils/currency'
import { annualWageFor } from '../../utils/contracts'

export default function ContractTermsPanel({ person, seasons, onSeasonsChange }) {
  const annualWage = annualWageFor(person)
  return (
    <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500">Contract length</div>
          <div className="mt-1 text-xs text-gray-400">Choose how long this signing stays.</div>
        </div>
        <Select value={String(seasons)} onChange={event => onSeasonsChange(Number(event.target.value))} reserveErrorSpace={false} className="min-h-10 w-28 rounded-xl py-1.5 text-sm">
          {[1, 2, 3, 5].map(years => <option key={years} value={years}>{years} season{years > 1 ? 's' : ''}</option>)}
        </Select>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-200 pt-3 text-xs">
        <div><div className="text-gray-400">Wage each season</div><strong className="mt-1 block text-sm text-[#0A1318]">${formatCurrency(annualWage)}</strong></div>
        <div><div className="text-gray-400">Total wages</div><strong className="mt-1 block text-sm text-[#0A1318]">${formatCurrency(annualWage * seasons)}</strong></div>
      </div>
      <p className="mt-3 text-[11px] leading-4 text-gray-400">Pay the transfer fee now. Wages are deducted automatically when a new season begins. At 0 seasons remaining, the player or coach becomes a Free Agent.</p>
    </div>
  )
}
