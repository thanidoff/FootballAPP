import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  POSITIONS, POSITION_LABELS, STATS_BY_POSITION, STAT_LABELS,
  ALL_STATS, calculateOVR, getDefaultStats, normalizeStats, STAT_MAX,
} from '../../utils/stats'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import ImageUploadCrop from '../ui/ImageUploadCrop'
import ClubSelect from '../ui/ClubSelect'
import NationalityInput from '../ui/NationalityInput'

export default function PlayerForm({ initialValues, onSubmit, loading, clubs = [], onDirtyChange }) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [form, setForm] = useState(() => {
    if (initialValues) return { ...initialValues, stats: normalizeStats(initialValues.stats) }
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
  const initialSnapshot = useRef(JSON.stringify(initialValues ? { ...initialValues, stats: normalizeStats(initialValues.stats) } : null))

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== initialSnapshot.current)
  }, [form, onDirtyChange])

  const statKeys = STATS_BY_POSITION[form.position]
  const hiddenStatKeys = ALL_STATS.filter(key => !statKeys.includes(key))
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
    <form onSubmit={handleSubmit} className="space-y-3.5">
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
      <div className="grid grid-cols-2 gap-3">
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
        <div className="relative">
          <Input
            label="Market Value"
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
            className="pr-10"
            placeholder="0.00"
          />
          <span className="pointer-events-none absolute right-3 top-[38px] flex items-center text-sm font-heading font-bold text-gray-400">
            M
          </span>
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
          <span className="text-lg font-semibold tabular-nums text-gray-900">
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
        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen(value => !value)}
          className="mt-4 flex min-h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-600 transition-[background-color,border-color,color,transform] duration-200 hover:border-gray-300 hover:bg-slate-50 active:scale-[0.99]"
        >
          <span>Advanced attributes</span>
          <ChevronDown size={17} className={`transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${advancedOpen ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden" aria-hidden={!advancedOpen} inert={!advancedOpen}>
            <p className="mb-3 text-xs leading-5 text-gray-500">
              Hidden attributes are used when this player takes a different position during a match.
            </p>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              {hiddenStatKeys.map(key => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    {key} <span className="font-normal normal-case text-gray-400">· {STAT_LABELS[key]}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={STAT_MAX}
                    value={form.stats[key] ?? 50}
                    onChange={event => handleStatChange(key, event.target.value)}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-[#FD5461]"
                  />
                  <div className="mt-0.5 text-right text-xs font-medium text-gray-600">{form.stats[key] ?? 50}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full justify-center" disabled={loading}>
        {loading ? 'Saving...' : 'Save Player'}
      </Button>
    </form>
  )
}
