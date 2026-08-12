import { useId } from 'react'
import Select from '../ui/Select'
import { formatCurrency } from '../../utils/currency'

export default function ContractTermsPanel({ seasons, onSeasonsChange, annualWage, onAnnualWageChange, suggestedWage, wageCustomized, onResetWage }) {
  const wageInputId = useId()
  const changeBy = millions => onAnnualWageChange(Math.max(0, annualWage + millions * 1_000_000))
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-heading font-bold uppercase tracking-wider text-gray-500">Contract Length</label>
        <Select value={String(seasons)} onChange={event => onSeasonsChange(Number(event.target.value))} reserveErrorSpace={false}>
          {[1, 2, 3, 5].map(years => <option key={years} value={years}>{years} season{years > 1 ? 's' : ''}</option>)}
        </Select>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2"><label htmlFor={wageInputId} className="text-xs text-gray-500">Wage / season · paid at next season</label>{wageCustomized && <button type="button" onClick={onResetWage} className="cursor-pointer text-xs font-medium text-[#FD5461] hover:underline">Reset ${formatCurrency(suggestedWage)}</button>}</div>
        <div className="flex items-center gap-1.5">
          {[-1, -0.5].map(amount => <button key={amount} type="button" onClick={() => changeBy(amount)} className="h-10 rounded-xl border border-gray-200 px-2.5 text-xs text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">{amount}</button>)}
          <div className="relative min-w-0 flex-1"><input id={wageInputId} type="number" min="0" step="0.1" value={(annualWage / 1_000_000).toFixed(1)} onChange={event => onAnnualWageChange(Math.max(0, Math.round(Number(event.target.value || 0) * 1_000_000)))} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 pr-8 text-center text-sm font-normal text-[#0A1318] outline-none transition-colors focus:border-[#FD5461]" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">M</span></div>
          {[0.5, 1].map(amount => <button key={amount} type="button" onClick={() => changeBy(amount)} className="h-10 rounded-xl border border-gray-200 px-2.5 text-xs text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+{amount}</button>)}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs"><span className="text-gray-400">{seasons} season{seasons > 1 ? 's' : ''} total</span><span className="font-normal text-[#0A1318]">${formatCurrency(annualWage * seasons)}</span></div>
      </div>
    </div>
  )
}
