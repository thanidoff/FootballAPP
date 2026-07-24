import { useState } from 'react'
import Input from '../ui/Input'
import Button from '../ui/Button'
import ImageUploadCrop from '../ui/ImageUploadCrop'
import { LockKeyhole, Minus, Plus } from 'lucide-react'

export default function ClubForm({ initialValues, onSubmit, loading, identityLocked = false }) {
  const [form, setForm] = useState(() => initialValues ?? {
    name: '',
    short_name: '',
    badge: null,
  })
  const [shortNameEdited, setShortNameEdited] = useState(() => !!(initialValues?.short_name))
  const [budgetInput, setBudgetInput] = useState(() => initialValues?.budget != null ? (initialValues.budget / 1_000_000).toFixed(1) : '')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(form)
  }

  function changeBudget(delta) {
    setForm(current => {
      const budget = Math.max(0, (Number(current.budget) || 0) + delta)
      setBudgetInput((budget / 1_000_000).toFixed(1))
      return { ...current, budget }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Badge image */}
      {identityLocked ? (
        <div>
          <div className="mb-1 type-label text-gray-600">Club Badge</div>
          <div className="relative flex h-20 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-3">
            {form.badge?.preview ? <img src={form.badge.preview} alt="" className="h-full w-full object-contain" /> : <span className="type-label text-gray-400">{form.short_name}</span>}
            <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400"><LockKeyhole size={12} /></span>
          </div>
          <p className="mt-1.5 type-body-sm text-gray-400">Edit the badge from the main Clubs page.</p>
        </div>
      ) : (
        <ImageUploadCrop
          label="Club Badge"
          value={form.badge}
          onChange={(badge) => setForm((f) => ({ ...f, badge }))}
          aspect={1}
          shape="square"
          placeholder="Badge"
        />
      )}

      <Input
        label="Club Name"
        value={form.name}
        onChange={(e) => {
          const name = e.target.value
          setForm((f) => ({
            ...f,
            name,
            short_name: shortNameEdited ? f.short_name : name.replace(/\s+/g, '').slice(0, 3).toUpperCase(),
          }))
        }}
        placeholder="FC Barcelona"
        disabled={identityLocked}
        className={identityLocked ? 'cursor-not-allowed bg-white text-gray-500 opacity-100' : ''}
        required
      />
      <Input
        label="Short Name (3-5 chars)"
        value={form.short_name}
        onChange={(e) => {
          setShortNameEdited(true)
          setForm((f) => ({ ...f, short_name: e.target.value.toUpperCase() }))
        }}
        placeholder="FCB"
        maxLength={5}
        disabled={identityLocked}
        className={identityLocked ? 'cursor-not-allowed bg-white text-gray-500 opacity-100' : ''}
        required
      />
      {form.budget != null && (
        <div className="space-y-2">
          <div className="type-label text-gray-600">Budget</div>
          <div className="grid grid-cols-[auto_auto_minmax(110px,1fr)_auto_auto] overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-[#FD5461]/15">
            <button type="button" onClick={() => changeBudget(-10_000_000)} aria-label="Decrease budget by 10 million" className="flex min-h-11 items-center gap-1 border-r border-gray-100 px-3 type-label text-gray-500 transition-colors hover:bg-gray-50 hover:text-[#FD5461]"><Minus size={14} />10M</button>
            <button type="button" onClick={() => changeBudget(-1_000_000)} aria-label="Decrease budget by 1 million" className="min-h-11 border-r border-gray-100 px-3 type-label text-gray-500 transition-colors hover:bg-gray-50 hover:text-[#FD5461]">−1M</button>
            <label className="relative flex min-w-0 items-center justify-center">
              <input type="number" min="0" step="0.1" value={budgetInput} onChange={(event) => { setBudgetInput(event.target.value); setForm(current => ({ ...current, budget: Math.max(0, Number(event.target.value) || 0) * 1_000_000 })) }} onBlur={() => setBudgetInput((Math.max(0, Number(budgetInput) || 0)).toFixed(1))} aria-label="Budget in millions" className="min-w-0 w-full bg-transparent px-2 py-2.5 text-center type-body font-medium text-gray-900 outline-none" />
              <span className="pointer-events-none pr-3 type-body-sm text-gray-400">M</span>
            </label>
            <button type="button" onClick={() => changeBudget(1_000_000)} aria-label="Increase budget by 1 million" className="min-h-11 border-l border-gray-100 px-3 type-label text-gray-500 transition-colors hover:bg-gray-50 hover:text-[#FD5461]">+1M</button>
            <button type="button" onClick={() => changeBudget(10_000_000)} aria-label="Increase budget by 10 million" className="flex min-h-11 items-center gap-1 border-l border-gray-100 px-3 type-label text-gray-500 transition-colors hover:bg-gray-50 hover:text-[#FD5461]"><Plus size={14} />10M</button>
          </div>
        </div>
      )}
      <Button type="submit" className="w-full justify-center" disabled={loading}>
        {loading ? 'Saving...' : identityLocked ? 'Save Budget' : 'Save Club'}
      </Button>
    </form>
  )
}
