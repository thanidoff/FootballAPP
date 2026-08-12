import Select from '../ui/Select'
import { formatCurrency } from '../../utils/currency'
import { annualWageFor } from '../../utils/contracts'

export default function ContractTermsPanel({ person, seasons, onSeasonsChange }) {
  const annualWage = annualWageFor(person)
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-heading font-bold uppercase tracking-wider text-gray-500">Contract Length</label>
        <Select value={String(seasons)} onChange={event => onSeasonsChange(Number(event.target.value))} reserveErrorSpace={false}>
          {[1, 2, 3, 5].map(years => <option key={years} value={years}>{years} season{years > 1 ? 's' : ''}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><div className="text-xs text-gray-400">Wage / season</div><strong className="mt-0.5 block text-sm text-[#0A1318]">${formatCurrency(annualWage)}</strong></div>
        <div><div className="text-xs text-gray-400">Total wages</div><strong className="mt-0.5 block text-sm text-[#0A1318]">${formatCurrency(annualWage * seasons)}</strong></div>
      </div>
    </div>
  )
}
