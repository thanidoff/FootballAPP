import { useState } from 'react'
import {
  POSITIONS, POSITION_LABELS, STATS_BY_POSITION, STAT_LABELS,
  calculateOVR, getDefaultStats, STAT_MAX,
} from '../../utils/stats'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import ImageUploadCrop from '../ui/ImageUploadCrop'
import ClubSelect from '../ui/ClubSelect'
import NationalityInput from '../ui/NationalityInput'

export default function PlayerForm({ initialValues, onSubmit, loading, clubs = [] }) {
  const [form, setForm] = useState(() => {
    if (initialValues) return initialValues
    const pos = 'FWD'
    return {
      first_name: '',
      last_name: '',
      nationality: '',
      age: 22,
      position: pos,
      market_value: 1000000,
      stats: getDefaultStats(pos),
      photo: null,
      club_id: '',
    }
  })

  const [mvDisplay, setMvDisplay] = useState(() =>
    initialValues ? (initialValues.market_value / 1_000_000).toFixed(1) : ''
  )

  const statKeys = STATS_BY_POSITION[form.position]
  const ovr = calculateOVR(form.position, form.stats)

  function handlePositionChange(e) {
    const pos = e.target.value
    setForm((f) => {
      // Preserve any stat values that carry over to the new position.
      // Only fall back to 50 for stat keys that didn't exist before (e.g. GK ↔ outfield).
      const defaults = getDefaultStats(pos)
      const merged = Object.fromEntries(
        Object.keys(defaults).map((key) => [key, f.stats[key] ?? defaults[key]])
      )
      return { ...f, position: pos, stats: merged }
    })
  }

  function handleStatChange(key, raw) {
    const val = Math.max(1, Math.min(STAT_MAX, parseInt(raw) || 1))
    setForm((f) => ({ ...f, stats: { ...f.stats, [key]: val } }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const name = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ')
    onSubmit({ ...form, name })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo */}
      <ImageUploadCrop
        label="Player Photo"
        value={form.photo}
        onChange={(photo) => setForm((f) => ({ ...f, photo }))}
        aspect={1}
        shape="circle"
        placeholder="Photo"
      />

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={form.first_name}
          onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
          placeholder="Lionel"
          required
        />
        <Input
          label="Last Name"
          value={form.last_name}
          onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          placeholder="Messi"
          required
        />
        <NationalityInput
          value={form.nationality}
          onChange={(val) => setForm((f) => ({ ...f, nationality: val }))}
        />
        <Input
          label="Age"
          type="number"
          min={15}
          max={45}
          value={form.age}
          onChange={(e) => setForm((f) => ({ ...f, age: parseInt(e.target.value) || 22 }))}
        />
        <Select
          label="Position"
          value={form.position}
          onChange={handlePositionChange}
        >
          {Object.entries(POSITIONS).map(([key]) => (
            <option key={key} value={key}>{POSITION_LABELS[key]}</option>
          ))}
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
            Market Value
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={mvDisplay}
              onChange={(e) => {
                const raw = e.target.value
                if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return
                setMvDisplay(raw)
                const num = parseFloat(raw) || 0
                setForm((f) => ({ ...f, market_value: Math.round(num * 1_000_000) }))
              }}
              onBlur={() => {
                const num = parseFloat(mvDisplay) || 0
                setMvDisplay(num.toFixed(1))
                setForm((f) => ({ ...f, market_value: Math.round(num * 1_000_000) }))
              }}
              className="w-full pl-3 pr-10 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-colors"
              placeholder="0.00"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-heading font-bold text-gray-400">
              M
            </span>
          </div>
        </div>
        <div className="col-span-2">
          <ClubSelect
            label="Club"
            value={form.club_id ?? ''}
            onChange={(val) => setForm((f) => ({ ...f, club_id: val || null }))}
            clubs={clubs.filter(c => !c.is_national)}
          />
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
            Attributes
          </p>
          <span className="font-heading font-black text-2xl text-gray-900">
            OVR {ovr}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {statKeys.map((key) => (
            <div key={key}>
              <label className="block text-xs font-heading font-bold tracking-wider uppercase text-gray-400 mb-1">
                {key} <span className="text-gray-300">· {STAT_LABELS[key]}</span>
              </label>
              <input
                type="range"
                min={1}
                max={STAT_MAX}
                value={form.stats[key] ?? 50}
                onChange={(e) => handleStatChange(key, e.target.value)}
                className="w-full h-1.5 appearance-none bg-gray-200 rounded-full accent-gray-900 cursor-pointer"
              />
              <div className="text-right text-xs font-heading font-bold text-gray-600 mt-0.5">
                {form.stats[key] ?? 50}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full justify-center" disabled={loading}>
        {loading ? 'Saving...' : 'Save Player'}
      </Button>
    </form>
  )
}
