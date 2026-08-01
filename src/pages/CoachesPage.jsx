import { useState, useEffect, useCallback } from 'react'
import { fetchCoaches, createCoach, updateCoach, deleteCoach, signCoach, releaseCoach } from '../services/coaches'
import { fetchClubs } from '../services/clubs'
import { formatCurrency } from '../utils/currency'
import { FIFA_NATIONS } from '../utils/fifaNations'
import CoachCard from '../components/ui/CoachCard'
import CoachForm from '../components/coaches/CoachForm'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import ClubSelect from '../components/ui/ClubSelect'
import OvrBadge from '../components/ui/OvrBadge'
import { useToast } from '../components/ui/Toast'
import AnimatedTabs from '../components/ui/AnimatedTabs'
import PageWrapper from '../components/ui/PageWrapper'
import { SkeletonCard } from '../components/ui/SkeletonCard'
import FreeAgentIcon from '../components/ui/FreeAgentIcon'

export default function CoachesPage() {
  const [coaches, setCoaches] = useState([])
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all') // 'all' | 'free'

  // Modals state
  const [formModal, setFormModal] = useState(null) // null | { type: 'create' } | { type: 'edit', coach }
  const [signModalCoach, setSignModalCoach] = useState(null)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [agreedFee, setAgreedFee] = useState(2000000)
  const [feeDisplay, setFeeDisplay] = useState('2.0')

  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const toast = useToast()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [coachesData, clubsData] = await Promise.all([fetchCoaches(), fetchClubs()])
      setCoaches(coachesData)
      setClubs(clubsData)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreateModal = () => {
    setFormModal({ type: 'create' })
  }

  const openEditModal = (coach) => {
    setFormModal({ type: 'edit', coach })
  }

  const openSigningModal = (coach) => {
    setSignModalCoach(coach)
    setSelectedClubId('')
    const val = coach.market_value || 2000000
    setAgreedFee(val)
    setFeeDisplay((val / 1_000_000).toFixed(1))
  }

  const handleSaveCoachForm = async (formData) => {
    try {
      setSaving(true)
      if (formModal.type === 'create') {
        await createCoach(formData)
        toast.success('สร้างโค้ชใหม่เรียบร้อยแล้ว')
      } else {
        await updateCoach(formModal.coach.id, formData)
        toast.success('อัปเดตข้อมูลโค้ชเรียบร้อยแล้ว')
      }
      setFormModal(null)
      loadData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCoach = async (coachId) => {
    if (!window.confirm('คุณต้องการลบโค้ชคนนี้ใช่หรือไม่?')) return
    try {
      await deleteCoach(coachId)
      toast.success('ลบโค้ชเรียบร้อยแล้ว')
      loadData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleSignCoachSubmit = async (e) => {
    e.preventDefault()
    if (!selectedClubId || !signModalCoach) {
      toast.error('กรุณาเลือกสโมสรที่ต้องการเซ็นสัญญา')
      return
    }

    try {
      setSigning(true)
      await signCoach(signModalCoach.id, selectedClubId)
      toast.success(`เซ็นสัญญา ${signModalCoach.name} เข้าสโมสรสำเร็จ!`)
      setSignModalCoach(null)
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to sign coach')
    } finally {
      setSigning(false)
    }
  }

  const handleReleaseCoach = async (coach) => {
    if (!window.confirm(`ยกเลิกสัญญากับ ${coach.name} หรือไม่?`)) return
    try {
      await releaseCoach(coach.id)
      toast.success(`ยกเลิกสัญญา ${coach.name} เรียบร้อยแล้ว`)
      loadData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filteredCoaches = coaches
    .filter((c) => {
      const matchTab = tab === 'all' || (tab === 'free' && !c.club_id)
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.nationality.toLowerCase().includes(search.toLowerCase())
      return matchTab && matchSearch
    })
    .sort((a, b) => b.ovr - a.ovr)

  const freeAgentsCount = coaches.filter((c) => !c.club_id).length

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Coaches</h1>
            <p className="text-sm text-gray-500 mt-1">
              {coaches.length} total • {freeAgentsCount} free agents
            </p>
          </div>
          <Button variant="primary" onClick={openCreateModal}>
            + New Coach
          </Button>
        </div>

        {/* Tabs & Search controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <AnimatedTabs
            items={[
              { id: 'all', label: `All Coaches (${coaches.length})` },
              { id: 'free', label: `Free Agents (${freeAgentsCount})` },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="w-full sm:w-72">
            <input
              type="search"
              placeholder="Search name or nationality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>
        </div>

        {/* Coaches Grid List */}
        {loading ? (
          <div className="player-card-grid">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <FreeAgentIcon className="mx-auto h-10 w-10 text-gray-300" />
            <h3 className="mt-3 text-sm font-semibold text-gray-900">No coaches found</h3>
            <p className="mt-1 text-xs text-gray-500">Try adjusting your search filter or create a new coach.</p>
          </div>
        ) : (
          <div className="player-card-grid">
            {filteredCoaches.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                onEdit={openEditModal}
                onDelete={handleDeleteCoach}
                onSign={openSigningModal}
                onRelease={handleReleaseCoach}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Coach */}
      <Modal
        open={Boolean(formModal)}
        onClose={() => setFormModal(null)}
        title={formModal?.type === 'create' ? 'Add New Coach' : 'Edit Coach'}
        width="max-w-xl"
      >
        {formModal && (
          <CoachForm
            key={formModal.coach?.id || formModal.type}
            initialValues={formModal.type === 'edit' ? formModal.coach : null}
            onSubmit={handleSaveCoachForm}
            loading={saving}
            clubs={clubs}
          />
        )}
      </Modal>

      {/* Modal: Sign Coach to Club */}
      <Modal
        open={Boolean(signModalCoach)}
        onClose={() => setSignModalCoach(null)}
        title="Sign Coach"
        width="max-w-md"
      >
        {signModalCoach && (
          <form onSubmit={handleSignCoachSubmit} className="space-y-6">
            {/* Header Box */}
            <div className="bg-white rounded-2xl p-4 flex items-center justify-between gap-3 border border-gray-100">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Photo avatar */}
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
                  {signModalCoach?.photo_url ? (
                    <img src={signModalCoach.photo_url} alt={signModalCoach.name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-base">
                      {signModalCoach?.name?.charAt(0) ?? 'C'}
                    </div>
                  )}
                </div>

                {/* Name + flag + club + age */}
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#0A1318] truncate">{signModalCoach?.name ?? ''}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {(() => {
                      const code = FIFA_NATIONS.find(n => n.name === signModalCoach?.nationality)?.code
                      return code ? <img src={`https://flagcdn.com/${code}.svg`} alt={signModalCoach?.nationality ?? ''} className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10" /> : null
                    })()}
                    {signModalCoach?.club ? (
                      <span className="flex items-center gap-1.5 text-xs text-gray-600">
                        {signModalCoach.club.badge_url ? (
                          <img src={signModalCoach.club.badge_url} alt="" className="h-4 w-4 object-contain shrink-0" />
                        ) : null}
                        <span>{signModalCoach.club.name}</span>
                      </span>
                    ) : null}
                    {signModalCoach?.age && <span className="text-xs text-gray-400">{signModalCoach.age} yrs</span>}
                  </div>
                </div>
              </div>

              {/* OVR & Role Badge */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <OvrBadge value={signModalCoach?.ovr ?? 70} size="md" />
                <span className="text-[10px] font-semibold tracking-wider uppercase text-[#FD5461]">HC</span>
              </div>
            </div>

            {/* Club select */}
            <ClubSelect
              label="Select Club"
              value={selectedClubId}
              onChange={(val) => setSelectedClubId(val)}
              clubs={clubs.filter(c => !c.is_national && c.id !== signModalCoach.club_id).map((c) => {
                const coachCount = coaches.filter(coach => coach.club_id === c.id).length
                return {
                  ...c,
                  disabled: coachCount >= 2,
                }
              })}
            />

            {/* Fee negotiation */}
            <div>
              <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500 block mb-1">
                Set Coach Market Value
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { const v = Math.max(0, agreedFee - 10_000_000); setAgreedFee(v); setFeeDisplay((v/1_000_000).toFixed(1)) }}
                  className="w-10 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors font-heading font-black text-xs flex-shrink-0 cursor-pointer"
                >-10</button>
                <button
                  type="button"
                  onClick={() => { const v = Math.max(0, agreedFee - 5_000_000); setAgreedFee(v); setFeeDisplay((v/1_000_000).toFixed(1)) }}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors font-heading font-bold text-xs flex-shrink-0 cursor-pointer"
                >-5</button>
                <div className="flex-1 min-w-[70px] relative">
                  <input
                    type="number"
                    value={feeDisplay}
                    onChange={(e) => { setFeeDisplay(e.target.value); setAgreedFee(Math.round(parseFloat(e.target.value || 0) * 1_000_000)) }}
                    onBlur={() => setFeeDisplay((agreedFee / 1_000_000).toFixed(1))}
                    className="w-full px-2 py-2 pr-8 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 text-center font-heading font-bold"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">M</span>
                </div>
                <button
                  type="button"
                  onClick={() => { const v = agreedFee + 5_000_000; setAgreedFee(v); setFeeDisplay((v/1_000_000).toFixed(1)) }}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors font-heading font-bold text-xs flex-shrink-0 cursor-pointer"
                >+5</button>
                <button
                  type="button"
                  onClick={() => { const v = agreedFee + 10_000_000; setAgreedFee(v); setFeeDisplay((v/1_000_000).toFixed(1)) }}
                  className="w-10 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors font-heading font-black text-xs flex-shrink-0 cursor-pointer"
                >+10</button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full justify-center mt-2" loading={signing} disabled={!selectedClubId}>
              Confirm Signing
            </Button>
          </form>
        )}
      </Modal>
    </PageWrapper>
  )
}
