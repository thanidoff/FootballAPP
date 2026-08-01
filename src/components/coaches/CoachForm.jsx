import { useEffect, useRef, useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import Input from '../ui/Input'
import Button from '../ui/Button'
import ImageUploadCrop from '../ui/ImageUploadCrop'
import ClubSelect from '../ui/ClubSelect'
import NationalityInput from '../ui/NationalityInput'
import OvrBadge from '../ui/OvrBadge'
import { calculateCoachOVR } from '../../services/coaches'

const COACH_STAT_LABELS = {
  TAC: 'Tactical',
  MGT: 'Management',
  MOT: 'Motivation',
  ATT: 'Attacking',
  DEF: 'Defending',
  PHY: 'Physical',
}

const COACH_STAT_KEYS = ['TAC', 'MGT', 'MOT', 'ATT', 'DEF', 'PHY']

export default function CoachForm({ initialValues, onSubmit, loading, clubs = [], onDirtyChange }) {
  const parseFormState = (vals) => {
    if (!vals) {
      return {
        first_name: '',
        last_name: '',
        nationality: 'Thailand',
        age: 45,
        market_value: 2000000,
        club_id: '',
        photo: null,
        stats: { TAC: 70, MGT: 70, MOT: 70, ATT: 70, DEF: 70, PHY: 70 },
      }
    }
    const nameParts = (vals.name || '').split(' ')
    const statsObj = {
      TAC: vals.stats?.TAC ?? vals.stat_tac ?? 70,
      MGT: vals.stats?.MGT ?? vals.stat_mgt ?? 70,
      MOT: vals.stats?.MOT ?? vals.stat_mot ?? 70,
      ATT: vals.stats?.ATT ?? vals.stat_att ?? 70,
      DEF: vals.stats?.DEF ?? vals.stat_def ?? 70,
      PHY: vals.stats?.PHY ?? vals.stat_phy ?? 70,
    }
    const mv = Number(vals.market_value) || 2000000
    return {
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      nationality: vals.nationality || 'Thailand',
      age: Number(vals.age) || 45,
      market_value: mv,
      club_id: vals.club_id || '',
      photo: vals.photo || (vals.photo_url ? { preview: vals.photo_url } : null),
      stats: statsObj,
    }
  }

  const [form, setForm] = useState(() => parseFormState(initialValues))
  const [mvDisplay, setMvDisplay] = useState(() =>
    ((Number(initialValues?.market_value) || 2000000) / 1_000_000).toFixed(1)
  )

  useEffect(() => {
    const nextForm = parseFormState(initialValues)
    setForm(nextForm)
    setMvDisplay(((Number(initialValues?.market_value) || 2000000) / 1_000_000).toFixed(1))
    initialSnapshot.current = JSON.stringify(nextForm)
  }, [initialValues])

  const initialSnapshot = useRef(JSON.stringify(form))

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== initialSnapshot.current)
  }, [form, onDirtyChange])

  const ovr = calculateCoachOVR(form.stats)

  function handleStatChange(key, raw) {
    const val = Math.max(1, Math.min(99, parseInt(raw) || 1))
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
        label="Coach Photo"
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
          placeholder="Pep"
          required
        />
        <Input
          label="Last Name"
          value={form.last_name}
          onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          placeholder="Guardiola"
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
            min={25}
            max={90}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: parseInt(e.target.value) || 45 }))}
            className="text-center px-9"
          />
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, age: Math.max(25, (f.age || 45) - 1) }))}
            className="absolute left-1.5 top-[31px] flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
            title="Decrease Age"
          >
            <Minus size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, age: Math.min(90, (f.age || 45) + 1) }))}
            className="absolute right-1.5 top-[31px] flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
            title="Increase Age"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Market Value with +/- 5M buttons */}
        <div className="relative col-span-2 sm:col-span-1">
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

        <div className="col-span-2 sm:col-span-1">
          <ClubSelect
            label="Club"
            value={form.club_id ?? ''}
            onChange={(val) => setForm((f) => ({ ...f, club_id: val || null }))}
            clubs={clubs.filter(c => !c.is_national)}
          />
        </div>
      </div>

      {/* Attributes / Stats */}
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
          {COACH_STAT_KEYS.map((key) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-heading font-bold tracking-wider uppercase text-gray-400">
                  {key} <span className="text-gray-300">· {COACH_STAT_LABELS[key]}</span>
                </label>
                <span className="text-xs font-heading font-bold text-gray-800 tabular-nums">
                  {form.stats[key] ?? 70}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={99}
                value={form.stats[key] ?? 70}
                onChange={(e) => handleStatChange(key, e.target.value)}
                className="w-full h-2 appearance-none bg-gray-200 rounded-full accent-[#FD5461] cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full justify-center" disabled={loading}>
        {loading ? 'Saving...' : initialValues ? 'Save Coach' : 'Create Coach'}
      </Button>
    </form>
  )
}
