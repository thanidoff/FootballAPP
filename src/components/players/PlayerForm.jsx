import { useEffect, useRef, useState } from 'react'
import { Plus, Minus } from 'lucide-react'
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

import OvrBadge from '../ui/OvrBadge'

const POS_COLORS = { GK: '#f59e0b', DEF: '#3b82f6', MF: '#22c55e', FWD: '#FD5461' }

export default function PlayerForm({ initialValues, onSubmit, loading, clubs = [], onDirtyChange }) {
  const parseFormState = (values) => {
    if (!values) return null
    const nameParts = String(values.name || '').trim().split(/\s+/).filter(Boolean)
    return {
      ...values,
      first_name: values.first_name ?? nameParts[0] ?? '',
      last_name: values.last_name ?? nameParts.slice(1).join(' '),
      club_id: values.club_id ?? values.club?.id ?? '',
      photo: values.photo || (values.photo_url ? { preview: values.photo_url } : null),
      stats: normalizeStats(values.stats),
    }
  }
  const [form, setForm] = useState(() => {
    if (initialValues) return parseFormState(initialValues)
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
    if (!initialValues) return
    const next = parseFormState(initialValues)
    setForm(next)
    setMvDisplay(((Number(initialValues.market_value) || 0) / 1_000_000).toFixed(1))
    initialSnapshot.current = JSON.stringify(next)
  }, [initialValues?.id])

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== initialSnapshot.current)
  }, [form, onDirtyChange])

  const statKeys = STATS_BY_POSITION[form.position] || ALL_STATS
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
        {/* Age with +/- buttons */}
        <div className="relative">
          <Input
            label="Age"
            type="number"
            min={15}
            max={45}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: parseInt(e.target.value) || 22 }))}
            className="text-center px-9"
          />
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, age: Math.max(15, (f.age || 22) - 1) }))}
            className="absolute left-1.5 top-[31px] flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
            title="Decrease Age"
          >
            <Minus size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, age: Math.min(45, (f.age || 22) + 1) }))}
            className="absolute right-1.5 top-[31px] flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
            title="Increase Age"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        <Select
          label="Position"
          value={form.position}
          onChange={handlePositionChange}
        >
          {Object.entries(POSITIONS).map(([key]) => (
            <option key={key} value={key}>{POSITION_LABELS[key]}</option>
          ))}
        </Select>

        {/* Market Value with +/- 5M buttons */}
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
            className="text-center px-16"
            placeholder="0.00"
          />
          <button
            type="button"
            onClick={() => {
              const curr = parseFloat(mvDisplay) || 0
              const next = Math.max(0, curr - 5)
              setMvDisplay(next.toFixed(1))
              setForm((f) => ({ ...f, market_value: Math.round(next * 1_000_000) }))
            }}
            className="absolute left-1.5 top-[31px] flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
            title="Decrease by 5M"
          >
            <Minus size={14} strokeWidth={2.5} />
          </button>
          <div className="absolute right-1.5 top-[31px] flex items-center gap-1">
            <span className="text-xs font-heading font-bold text-gray-400 mr-0.5">M</span>
            <button
              type="button"
              onClick={() => {
                const curr = parseFloat(mvDisplay) || 0
                const next = curr + 5
                setMvDisplay(next.toFixed(1))
                setForm((f) => ({ ...f, market_value: Math.round(next * 1_000_000) }))
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
              title="Increase by 5M"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
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
          <div className="flex items-center gap-1">
            <span className="font-heading text-xs font-bold uppercase tracking-wider text-gray-400 mr-1">OVR</span>
            <OvrBadge value={ovr} size="md" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {statKeys.map((key) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-heading font-bold tracking-wider uppercase text-gray-400">
                  {key} <span className="text-gray-300">· {STAT_LABELS[key]}</span>
                </label>
                <span className="text-xs font-heading font-bold text-gray-800 tabular-nums">
                  {form.stats[key] ?? 50}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={STAT_MAX}
                value={form.stats[key] ?? 50}
                onChange={(e) => handleStatChange(key, e.target.value)}
                className="w-full h-2 appearance-none bg-gray-200 rounded-full accent-[#FD5461] cursor-pointer"
              />
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
