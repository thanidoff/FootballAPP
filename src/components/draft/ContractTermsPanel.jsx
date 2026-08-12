import { useId } from 'react'
import Select from '../ui/Select'
import { formatCurrency } from '../../utils/currency'

export default function ContractTermsPanel({ seasons, onSeasonsChange, annualWage, onAnnualWageChange }) {
  const wageInputId = useId()
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-heading font-bold uppercase tracking-wider text-gray-500">Contract Length</label>
        <Select value={String(seasons)} onChange={event => onSeasonsChange(Number(event.target.value))} reserveErrorSpace={false}>
          {[1, 2, 3, 5].map(years => <option key={years} value={years}>{years} season{years > 1 ? 's' : ''}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={wageInputId} className="mb-1 block text-xs text-gray-500">Wage / season</label>
          <div className="relative"><input id={wageInputId} type="number" min="0" step="0.1" value={(annualWage / 1_000_000).toFixed(1)} onChange={event => onAnnualWageChange(Math.max(0, Math.round(Number(event.target.value || 0) * 1_000_000)))} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-8 text-sm font-normal text-[#0A1318] outline-none transition-colors focus:border-[#FD5461]" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">M</span></div>
        </div>
        <div><div className="text-xs text-gray-500">Total wages</div><div className="mt-3 text-sm font-normal text-[#0A1318]">${formatCurrency(annualWage * seasons)}</div></div>
      </div>
    </div>
  )
}
