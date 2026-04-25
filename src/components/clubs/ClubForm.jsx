import { useState } from 'react'
import Input from '../ui/Input'
import Button from '../ui/Button'
import ImageUploadCrop from '../ui/ImageUploadCrop'

export default function ClubForm({ initialValues, onSubmit, loading }) {
  const [form, setForm] = useState(() => initialValues ?? {
    name: '',
    short_name: '',
    budget: 10000000,
    badge: null,
  })
  const [shortNameEdited, setShortNameEdited] = useState(() => !!(initialValues?.short_name))
  const [budgetDisplay, setBudgetDisplay] = useState(() =>
    initialValues ? (initialValues.budget / 1_000_000).toFixed(1) : '10.0'
  )

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Badge image */}
      <ImageUploadCrop
        label="Club Badge"
        value={form.badge}
        onChange={(badge) => setForm((f) => ({ ...f, badge }))}
        aspect={1}
        shape="square"
        placeholder="Badge"
      />

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
        required
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
          Budget
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={budgetDisplay}
            onChange={(e) => {
              const raw = e.target.value
              if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return
              setBudgetDisplay(raw)
              const num = parseFloat(raw) || 0
              setForm((f) => ({ ...f, budget: Math.round(num * 1_000_000) }))
            }}
            onBlur={() => {
              const num = parseFloat(budgetDisplay) || 0
              setBudgetDisplay(num.toFixed(1))
              setForm((f) => ({ ...f, budget: Math.round(num * 1_000_000) }))
            }}
            className="w-full pl-3 pr-10 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-colors"
            placeholder="0.0"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-heading font-bold text-gray-400">
            M
          </span>
        </div>
      </div>

<Button type="submit" className="w-full justify-center" disabled={loading}>
        {loading ? 'Saving...' : 'Save Club'}
      </Button>
    </form>
  )
}
