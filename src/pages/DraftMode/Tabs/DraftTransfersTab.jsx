import { useState, useMemo, useEffect, useRef } from 'react'
import { useOutletContext, useLocation } from 'react-router-dom'
import { transferDraftPlayer, transferDraftCoach, updateDraftState } from '../../../services/draftSave'
import PlayerCard from '../../../components/ui/PlayerCard'
import CoachCard from '../../../components/ui/CoachCard'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import ClubSelect from '../../../components/ui/ClubSelect'
import PlayerForm from '../../../components/players/PlayerForm'
import CoachForm from '../../../components/coaches/CoachForm'
import SegmentedControl from '../../../components/ui/SegmentedControl'
import Select from '../../../components/ui/Select'
import ContractTermsPanel from '../../../components/draft/ContractTermsPanel'
import { formatCurrency } from '../../../utils/currency'
import { calculateOVR } from '../../../utils/stats'
import { useToast } from '../../../components/ui/Toast'

import PositionBadge from '../../../components/ui/PositionBadge'
import OvrBadge from '../../../components/ui/OvrBadge'
import ScrollToTop from '../../../components/ui/ScrollToTop'
import FreeAgentIcon from '../../../components/ui/FreeAgentIcon'
import { FIFA_NATIONS } from '../../../utils/fifaNations'

import { fetchPlayers } from '../../../services/players'
import { fetchCoaches } from '../../../services/coaches'
import { Check, Plus, Search, Sparkles, Users, UserCheck } from 'lucide-react'
import SeasonalGrowthModal from '../../../components/draft/SeasonalGrowthModal'
import { applySeasonalCoachAdjustments, applySeasonalPlayerAdjustments, restoreSeasonalPlayerAdjustments } from '../../../utils/playerGrowth'
import { annualWageFor, contractFeeFor } from '../../../utils/contracts'

const POS_FILTERS = ['ALL', 'GK', 'DEF', 'MF', 'FWD']

export default function DraftTransfersTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const toast = useToast()
  const location = useLocation()
  const isCoachMarket = location.pathname.includes('coach-transfers')
  
  const [processing, setProcessing] = useState(false)
  const [posFilter, setPosFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [ovrSort, setOvrSort] = useState('desc')
  const [tab, setTab] = useState('all') // 'all' or 'free'
  const [signingItem, setSigningItem] = useState(null)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [agreedFee, setAgreedFee] = useState(0)
  const [feeDisplay, setFeeDisplay] = useState('0.0')
  const [contractSeasons, setContractSeasons] = useState(3)
  const [annualWage, setAnnualWage] = useState(0)
  const [wageCustomized, setWageCustomized] = useState(false)
  const [editPlayer, setEditPlayer] = useState(null)
  const [editCoach, setEditCoach] = useState(null)

  const [playerManagerOpen, setPlayerManagerOpen] = useState(false)
  const [masterPlayers, setMasterPlayers] = useState([])
  const [managedPlayerIds, setManagedPlayerIds] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const [coachManagerOpen, setCoachManagerOpen] = useState(false)
  const [masterCoaches, setMasterCoaches] = useState([])
  const [managedCoachIds, setManagedCoachIds] = useState([])
  const [loadingCoaches, setLoadingCoaches] = useState(false)
  const [coachGrowthModalOpen, setCoachGrowthModalOpen] = useState(false)
  const [previewCoachGrowthData, setPreviewCoachGrowthData] = useState(null)
  const mockCleanupDone = useRef(false)

  const [growthModalOpen, setGrowthModalOpen] = useState(false)
  const [previewGrowthData, setPreviewGrowthData] = useState(null)

  const activeSeason = (saveData?.settings?.seasons || []).find(s => s.status === 'active') || saveData?.settings?.seasons?.[0]
  const seasonAdjustments = activeSeason?.seasonAdjustments || []
  const coachSeasonAdjustments = activeSeason?.coachSeasonAdjustments || []
  const isGrowthLocked = activeSeason?.seasonAdjustmentsLocked || false

  const growthSourceSeason = (() => {
    const seasons = saveData?.settings?.seasons || []
    const index = seasons.findIndex(season => String(season.id) === String(activeSeason?.id))
    return index > 0 ? seasons[index - 1] : null
  })()

  function handleReshufflePreview(customCount) {
    if (isGrowthLocked) return
    const result = applySeasonalPlayerAdjustments(saveData.teams || [], saveData.freeAgents || [], customCount, { season: growthSourceSeason })
    setPreviewGrowthData(result)
  }

  async function handleConfirmSaveRatings() {
    const target = previewGrowthData
    if (!target) return

    try {
      const nextSettings = { ...saveData.settings }
      if (nextSettings.seasons && nextSettings.seasons.length > 0) {
        const idx = nextSettings.seasons.findIndex(s => String(s.id) === String(activeSeason?.id))
        const targetIdx = idx >= 0 ? idx : nextSettings.seasons.length - 1
        nextSettings.seasons[targetIdx] = {
          ...nextSettings.seasons[targetIdx],
          seasonAdjustments: target.seasonAdjustments,
          seasonAdjustmentsLocked: true,
        }
      }
      const newSaveData = {
        ...saveData,
        teams: target.updatedTeams,
        freeAgents: target.updatedFreeAgents,
        settings: nextSettings,
      }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setPreviewGrowthData(null)
      setGrowthModalOpen(false)
      toast.success('Player ratings updated successfully!')
    } catch (err) {
      console.error('Failed to confirm seasonal player adjustments:', err)
      toast.error('Failed to save rating changes')
    }
  }

  async function handleRestorePreviousRatings() {
    if (!seasonAdjustments.length || !window.confirm('Restore every player in this ratings batch to their previous values?')) return
    const restored = restoreSeasonalPlayerAdjustments(saveData.teams || [], saveData.freeAgents || [], seasonAdjustments)
    const nextSettings = { ...saveData.settings, seasons: [...(saveData.settings?.seasons || [])] }
    const index = nextSettings.seasons.findIndex(season => String(season.id) === String(activeSeason?.id))
    if (index >= 0) nextSettings.seasons[index] = { ...nextSettings.seasons[index], seasonAdjustments: [], seasonAdjustmentsLocked: false }
    const nextState = { ...saveData, teams: restored.teams, freeAgents: restored.freeAgents, settings: nextSettings }
    await updateDraftState(saveId, nextState)
    setSaveData(nextState)
    setPreviewGrowthData(null)
    setGrowthModalOpen(false)
    toast.success(`Restored ${restored.restored} player ratings`)
  }

  const freeAgents = saveData?.freeAgents || []
  const freeAgentsCoaches = saveData?.freeAgentsCoaches || []

  useEffect(() => {
    if (!isCoachMarket || mockCleanupDone.current || !saveData) return
    mockCleanupDone.current = true
    fetchCoaches().then(async coaches => {
      setMasterCoaches(coaches)
      const masterIds = new Set(coaches.map(coach => String(coach.id)))
      const updatedTeams = (saveData.teams || []).map(team => ({
        ...team,
        coaches: (team.coaches || []).filter(coach => masterIds.has(String(coach.id))),
      }))
      const assignedIds = new Set(updatedTeams.flatMap(team => (team.coaches || []).map(coach => String(coach.id))))
      const updatedFreeCoaches = coaches.filter(coach => !assignedIds.has(String(coach.id))).map(coach => ({ ...coach, club: null, club_id: null }))
      const beforeIds = [...(saveData.freeAgentsCoaches || []), ...(saveData.teams || []).flatMap(team => team.coaches || [])].map(coach => String(coach.id)).sort()
      const afterIds = [...updatedFreeCoaches, ...updatedTeams.flatMap(team => team.coaches || [])].map(coach => String(coach.id)).sort()
      if (JSON.stringify(beforeIds) === JSON.stringify(afterIds)) return
      const nextState = { ...saveData, freeAgentsCoaches: updatedFreeCoaches, teams: updatedTeams }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      toast.success('Coach Market synced with Master Data')
    }).catch(error => toast.error(error.message || 'Failed to sync Master Coaches'))
  }, [isCoachMarket, saveData, saveId, setSaveData, toast])
  
  const cleanFreeAgents = useMemo(() => {
    return freeAgents.map(p => ({ ...p, club: null, club_id: null }))
  }, [freeAgents])

  const cleanFreeCoaches = useMemo(() => {
    const assignedIds = new Set()
    saveData?.teams?.forEach(t => (t.coaches || []).forEach(c => assignedIds.add(String(c.id))))
    return freeAgentsCoaches
      .filter(c => !assignedIds.has(String(c.id)))
      .map(c => ({ ...c, position: 'COACH', club: null, club_id: null }))
  }, [freeAgentsCoaches, saveData])

  const allPlayers = useMemo(() => {
    if (!saveData) return []
    const list = [...cleanFreeAgents]
    saveData.teams.forEach(team => {
      (team.roster || []).forEach(p => {
        list.push({
          ...p,
          club: {
            id: team.club_id,
            name: team.club_name,
            short_name: team.club_name,
            badge_url: team.badge_url,
            badge_color: team.badge_color
          }
        })
      })
    })
    return list
  }, [cleanFreeAgents, saveData])

  const allCoaches = useMemo(() => {
    if (!saveData) return []
    const list = [...cleanFreeCoaches]
    saveData.teams.forEach(team => {
      (team.coaches || []).forEach(c => {
        list.push({
          ...c,
          position: 'COACH',
          club: {
            id: team.club_id,
            name: team.club_name,
            short_name: team.club_name,
            badge_url: team.badge_url,
            badge_color: team.badge_color
          }
        })
      })
    })
    return list
  }, [cleanFreeCoaches, saveData])

  const filteredPlayers = useMemo(() => {
    const list = tab === 'free' ? cleanFreeAgents : allPlayers
    return list
      .filter((p) => {
        const matchPos = posFilter === 'ALL' || p.position === posFilter
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.nationality.toLowerCase().includes(search.toLowerCase())
        return matchPos && matchSearch
      })
      .sort((a, b) => {
        if (b.ovr !== a.ovr) {
          return ovrSort === 'desc' ? b.ovr - a.ovr : a.ovr - b.ovr
        }
        return String(a.id).localeCompare(String(b.id))
      })
  }, [allPlayers, cleanFreeAgents, ovrSort, posFilter, search, tab])

  const filteredCoaches = useMemo(() => {
    const list = tab === 'free' ? cleanFreeCoaches : allCoaches
    return list
      .filter((c) => {
        const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.nationality.toLowerCase().includes(search.toLowerCase())
        return matchSearch
      })
      .sort((a, b) => {
        if (b.ovr !== a.ovr) {
          return ovrSort === 'desc' ? b.ovr - a.ovr : a.ovr - b.ovr
        }
        return String(a.id).localeCompare(String(b.id))
      })
  }, [allCoaches, cleanFreeCoaches, ovrSort, search, tab])

  const openSigning = (item) => {
    setSigningItem(item)
    setSelectedClubId('')
    const initialFee = Number(item.market_value) || 0
    setAgreedFee(initialFee)
    setFeeDisplay((initialFee / 1_000_000).toFixed(1))
    setContractSeasons(3)
    setAnnualWage(annualWageFor(item))
    setWageCustomized(false)
  }

  const suggestedWage = annualWageFor(signingItem)
  useEffect(() => {
    if (!wageCustomized && signingItem) setAnnualWage(suggestedWage)
  }, [suggestedWage, signingItem, wageCustomized])

  const handleSign = async () => {
    if (!signingItem || !selectedClubId) return
    try {
      setProcessing(true)
      const isCoach = signingItem.position === 'COACH'
      const nextSaveData = isCoach
        ? await transferDraftCoach(saveId, signingItem.id, selectedClubId, agreedFee, contractSeasons, annualWage)
        : await transferDraftPlayer(saveId, signingItem.id, selectedClubId, agreedFee, contractSeasons, annualWage)
      
      setSaveData(nextSaveData)
      setSigningItem(null)
      setSelectedClubId('')
      toast.success(`${signingItem.name} transferred successfully`)
    } catch (e) {
      toast.error(e.message || 'Failed to transfer')
    } finally {
      setProcessing(false)
    }
  }

  async function handleCoachUpdate(form) {
    if (!editCoach) return
    setProcessing(true)
    try {
      const name = `${form.first_name || ''} ${form.last_name || ''}`.trim() || editCoach.name
      const statVals = Object.values(form.stats || {})
      const ovr = statVals.length > 0 ? Math.round(statVals.reduce((a, b) => a + b, 0) / statVals.length) : editCoach.ovr

      const updatedCoach = {
        ...editCoach,
        name,
        nationality: form.nationality,
        age: form.age,
        market_value: form.market_value,
        stats: form.stats,
        ovr,
        photo_url: form.photo?.preview || editCoach.photo_url || null,
        club_id: form.club_id || null,
      }
      delete updatedCoach.club

      const targetClubId = form.club_id || null
      let newTeams = (saveData.teams || []).map(item => ({
        ...item,
        coaches: (item.coaches || []).filter(coach => String(coach.id) !== String(editCoach.id)),
      }))
      let newFreeCoaches = (saveData.freeAgentsCoaches || saveData.coaches || []).filter(coach => String(coach.id) !== String(editCoach.id))
      if (targetClubId) {
        const target = newTeams.find(item => String(item.club_id) === String(targetClubId))
        if (!target) throw new Error('Selected club is not available in this save')
        if ((target.coaches || []).length >= 2) throw new Error('This club already has 2 coaches')
        newTeams = newTeams.map(item => String(item.club_id) === String(targetClubId)
          ? { ...item, coaches: [...item.coaches, updatedCoach] }
          : item)
      } else {
        newFreeCoaches.push({ ...updatedCoach, club_id: null })
      }

      const nextState = {
        ...saveData,
        teams: newTeams,
        freeAgentsCoaches: newFreeCoaches
      }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setEditCoach(null)
      toast.success('Coach updated in this save')
    } catch (err) {
      console.error('Failed to update coach in save', err)
      toast.error(err.message || 'Failed to update coach')
    } finally {
      setProcessing(false)
    }
  }

  async function handlePlayerUpdate(form) {
    if (!editPlayer) return
    setProcessing(true)
    try {
      const updatedPlayer = {
        ...editPlayer,
        name: form.name || editPlayer.name,
        first_name: form.first_name,
        last_name: form.last_name,
        nationality: form.nationality,
        age: form.age,
        position: form.position,
        market_value: form.market_value,
        stats: form.stats,
        ovr: calculateOVR(form.position, form.stats),
        photo_url: form.photo?.preview || editPlayer.photo_url || null,
        club_id: form.club_id || null,
      }
      delete updatedPlayer.club

      const sourceClubId = editPlayer.club?.id || editPlayer.club_id || null
      const targetClubId = form.club_id || null
      let newTeams = (saveData.teams || []).map(team => ({
        ...team,
        roster: (team.roster || []).filter(player => String(player.id) !== String(editPlayer.id)),
      }))
      let newFreeAgents = (saveData.freeAgents || []).filter(player => String(player.id) !== String(editPlayer.id))
      if (targetClubId) {
        const targetExists = newTeams.some(team => String(team.club_id) === String(targetClubId))
        if (!targetExists) throw new Error('Selected club is not available in this save')
        newTeams = newTeams.map(team => String(team.club_id) === String(targetClubId)
          ? { ...team, roster: [...team.roster, updatedPlayer] }
          : team)
      } else {
        newFreeAgents.push({ ...updatedPlayer, club_id: null })
      }

      const nextState = { ...saveData, teams: newTeams, freeAgents: newFreeAgents }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setEditPlayer(null)
      toast.success(sourceClubId !== targetClubId ? 'Player updated and moved in this save' : 'Player updated in this save')
    } catch (err) {
      console.error('Failed to update player in save', err)
      toast.error(err.message || 'Failed to update player')
    } finally {
      setProcessing(false)
    }
  }

  async function openPlayerManager() {
    setPlayerManagerOpen(true)
    if (masterPlayers.length > 0) {
      const activeIds = (saveData.freeAgents || []).map(p => String(p.id))
      saveData.teams.forEach(t => (t.roster || []).forEach(p => activeIds.push(String(p.id))))
      setManagedPlayerIds(activeIds)
      return
    }
    try {
      setLoadingPlayers(true)
      const players = await fetchPlayers()
      setMasterPlayers(players)
      const activeIds = (saveData.freeAgents || []).map(p => String(p.id))
      saveData.teams.forEach(t => (t.roster || []).forEach(p => activeIds.push(String(p.id))))
      setManagedPlayerIds(activeIds)
    } catch (error) {
      console.error('Failed to load master players', error)
      toast.error('Failed to load player database')
    } finally {
      setLoadingPlayers(false)
    }
  }

  async function openCoachManager() {
    setCoachManagerOpen(true)
    const activeIds = [
      ...(saveData.freeAgentsCoaches || []).map(coach => String(coach.id)),
      ...saveData.teams.flatMap(team => (team.coaches || []).map(coach => String(coach.id))),
    ]
    setManagedCoachIds(activeIds)
    if (masterCoaches.length > 0) return
    try {
      setLoadingCoaches(true)
      setMasterCoaches(await fetchCoaches())
    } catch (error) {
      console.error('Failed to load master coaches', error)
      toast.error('Failed to load coach database')
    } finally {
      setLoadingCoaches(false)
    }
  }

  async function saveManagedCoaches() {
    setProcessing(true)
    try {
      const selected = new Set(managedCoachIds.map(String))
      const existingById = new Map([
        ...(saveData.freeAgentsCoaches || []),
        ...saveData.teams.flatMap(team => team.coaches || []),
      ].map(coach => [String(coach.id), coach]))
      const updatedTeams = saveData.teams.map(team => ({
        ...team,
        coaches: (team.coaches || []).filter(coach => selected.has(String(coach.id))),
      }))
      const assignedIds = new Set(updatedTeams.flatMap(team => (team.coaches || []).map(coach => String(coach.id))))
      const updatedFreeCoaches = masterCoaches
        .filter(coach => selected.has(String(coach.id)) && !assignedIds.has(String(coach.id)))
        .map(coach => ({ ...(existingById.get(String(coach.id)) || coach), club: null, club_id: null }))
      const nextState = { ...saveData, teams: updatedTeams, freeAgentsCoaches: updatedFreeCoaches }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setCoachManagerOpen(false)
      toast.success('Coach pool updated from Master Data')
    } catch (error) {
      toast.error(error.message || 'Failed to update coach pool')
    } finally {
      setProcessing(false)
    }
  }

  function handleCoachReshufflePreview(customCount = 'all') {
    setPreviewCoachGrowthData(applySeasonalCoachAdjustments(saveData.teams || [], saveData.freeAgentsCoaches || [], customCount))
  }

  async function handleConfirmCoachRatings() {
    const target = previewCoachGrowthData || applySeasonalCoachAdjustments(saveData.teams || [], saveData.freeAgentsCoaches || [], 'all')
    try {
      const nextSettings = { ...saveData.settings, seasons: [...(saveData.settings?.seasons || [])] }
      const index = nextSettings.seasons.findIndex(season => String(season.id) === String(activeSeason?.id))
      if (index >= 0) nextSettings.seasons[index] = { ...nextSettings.seasons[index], coachSeasonAdjustments: target.seasonAdjustments }
      const nextState = { ...saveData, teams: target.updatedTeams, freeAgentsCoaches: target.updatedFreeAgents, settings: nextSettings }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setCoachGrowthModalOpen(false)
      setPreviewCoachGrowthData(null)
      toast.success('Coach ratings updated successfully')
    } catch (error) {
      toast.error(error.message || 'Failed to save coach ratings')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <SegmentedControl
          ariaLabel="Transfer groups"
          value={tab}
          onChange={setTab}
          className="w-full sm:w-auto"
          items={[
            { id: 'all', label: isCoachMarket ? `All Coaches (${allCoaches.length})` : `All Players (${allPlayers.length})` },
            { id: 'free', label: isCoachMarket ? `Free Agents (${cleanFreeCoaches.length})` : `Free Agents (${freeAgents.length})` },
          ]}
        />
        {!isCoachMarket ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isGrowthLocked) handleReshufflePreview(30)
                setGrowthModalOpen(true)
              }}
              className="flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider text-[#FD5461] border-[#FD5461]/30 hover:bg-red-50/50"
            >
              <Sparkles size={16} /> Player Ratings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openPlayerManager}
              className="flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"
            >
              <Plus size={16} /> Manage Players
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { handleCoachReshufflePreview('all'); setCoachGrowthModalOpen(true) }} className="flex items-center gap-2 rounded-xl border-[#FD5461]/30 font-heading text-xs font-bold uppercase tracking-wider text-[#FD5461] hover:bg-red-50/50">
              <Sparkles size={16} /> Coach Ratings
            </Button>
            <Button variant="outline" size="sm" onClick={openCoachManager} className="flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider">
              <Plus size={16} /> Manage Coaches
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-gray-900/20 transition-all">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="search"
            placeholder="Search name or nationality..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {!isCoachMarket && POS_FILTERS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors
                ${posFilter === pos ? 'bg-[#0A1318] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {pos}
            </button>
          ))}
          <button
            onClick={() => setOvrSort((s) => s === 'desc' ? 'asc' : 'desc')}
            aria-label={`Sort by overall rating ${ovrSort === 'desc' ? 'ascending' : 'descending'}`}
            aria-pressed="true"
            title={ovrSort === 'desc' ? 'Highest OVR first' : 'Lowest OVR first'}
            className="flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[#0A1318] px-3 py-2 font-heading text-xs font-bold uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            OVR {ovrSort === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Grid */}
      {isCoachMarket ? (
        filteredCoaches.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
            <div className="text-4xl mb-4">🧢</div>
            <h2 className="font-heading font-black text-lg text-gray-400 uppercase tracking-wide">No Coaches Found</h2>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div key={`coaches-${tab}-${ovrSort}`} className="player-card-grid ui-content-refresh">
            {filteredCoaches.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                onEdit={() => setEditCoach(coach)}
                onSign={() => openSigning(coach)}
              />
            ))}
          </div>
        )
      ) : (
        filteredPlayers.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
            <div className="text-4xl mb-4">🛒</div>
            <h2 className="font-heading font-black text-lg text-gray-400 uppercase tracking-wide">No Players Found</h2>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div key={`${tab}-${posFilter}-${ovrSort}`} className="player-card-grid ui-content-refresh">
            {filteredPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onEdit={() => setEditPlayer(player)}
                onSign={() => openSigning(player)}
              />
            ))}
          </div>
        )
      )}

      {/* Edit Coach Modal */}
      <Modal
        open={Boolean(editPlayer)}
        onClose={() => setEditPlayer(null)}
        title="Edit Player"
        width="max-w-xl"
      >
        {editPlayer && <PlayerForm
          initialValues={editPlayer}
          onSubmit={handlePlayerUpdate}
          loading={processing}
          clubs={saveData.teams.map(team => ({ id: team.club_id, name: team.club_name, badge_url: team.badge_url, badge_color: team.badge_color }))}
        />}
      </Modal>

      <Modal
        open={Boolean(editCoach)}
        onClose={() => setEditCoach(null)}
        title="Edit Coach"
        width="max-w-xl"
      >
        {editCoach && (
          <CoachForm
            initialValues={editCoach}
            onSubmit={handleCoachUpdate}
            loading={processing}
            clubs={saveData.teams.map(t => ({ id: t.club_id, name: t.club_name, badge_url: t.badge_url, badge_color: t.badge_color }))}
          />
        )}
      </Modal>

      {/* Sign Modal */}
      <Modal open={!!signingItem} onClose={() => { setSigningItem(null); setSelectedClubId('') }} title={signingItem?.position === 'COACH' ? "Sign Coach" : "Sign Player"} width="max-w-md">
        {signingItem && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 flex items-center justify-between gap-3 border border-gray-100">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Photo avatar */}
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
                  {signingItem.photo_url ? (
                    <img src={signingItem.photo_url} alt={signingItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-base">
                      {signingItem.name?.charAt(0) ?? 'C'}
                    </div>
                  )}
                </div>

                {/* Name + flag + club + position */}
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#0A1318] truncate">{signingItem.name}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {(() => {
                      const code = FIFA_NATIONS.find(n => n.name === signingItem.nationality)?.code
                      return code ? <img src={`https://flagcdn.com/${code}.svg`} alt={signingItem.nationality} className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10" /> : null
                    })()}
                    {signingItem.club ? (
                      <span className="flex items-center gap-1.5 text-xs text-gray-600">
                        {signingItem.club.badge_url ? (
                          <img src={signingItem.club.badge_url} alt="" className="h-4 w-4 object-contain shrink-0" />
                        ) : null}
                        <span>{signingItem.club.name}</span>
                      </span>
                    ) : <FreeAgentIcon size={20} />}
                    {signingItem.age && <span className="text-xs text-gray-400">{signingItem.age} yrs</span>}
                  </div>
                </div>
              </div>

              {/* OVR & Position / Role Badge */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <OvrBadge value={signingItem.ovr} size="md" />
                {signingItem.position === 'COACH' ? (
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-[#FD5461]">HC</span>
                ) : (
                  <PositionBadge position={signingItem.position} />
                )}
              </div>
            </div>

            <ClubSelect
              label="Select Club"
              value={selectedClubId}
              onChange={setSelectedClubId}
              clubs={[
                ...saveData.teams.filter(team => team.club_id !== (signingItem.club_id || signingItem.club?.id)).map(team => {
                  const isCoach = signingItem.position === 'COACH'
                  const coachCount = (team.coaches || []).length
                  const playerCount = (team.roster || []).length
                  const isDisabled = team.budget < 0 || (isCoach ? coachCount >= 2 : false)
                  
                  return {
                    ...team,
                    id: team.club_id,
                    name: isCoach
                      ? `${team.club_name}  ·  $${formatCurrency(team.budget)}  ·  ${coachCount}/2 coaches`
                      : `${team.club_name}  ·  $${formatCurrency(team.budget)}  ·  ${playerCount} players`,
                    short_name: team.short_name || team.club_name.slice(0, 3).toUpperCase(),
                    disabled: isDisabled,
                  }
                })
              ]}
            />

            <div>
              <label className="mb-1 block text-xs font-heading font-bold uppercase tracking-wider text-gray-500">Transfer Fee · External Market</label>
              <div className="flex items-center gap-1.5">
                {[-10, -5].map(amount => <button key={amount} type="button" onClick={() => { const value = Math.max(0, agreedFee + amount * 1_000_000); setAgreedFee(value); setFeeDisplay((value / 1_000_000).toFixed(1)) }} className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">{amount}</button>)}
                <div className="relative min-w-[90px] flex-1"><input type="number" min="0" step="0.1" value={feeDisplay} onChange={event => { setFeeDisplay(event.target.value); setAgreedFee(Math.max(0, Math.round(Number(event.target.value || 0) * 1_000_000))) }} onBlur={() => setFeeDisplay((agreedFee / 1_000_000).toFixed(1))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-center font-heading font-bold focus:border-[#FD5461] focus:outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">M</span></div>
                {[5, 10].map(amount => <button key={amount} type="button" onClick={() => { const value = agreedFee + amount * 1_000_000; setAgreedFee(value); setFeeDisplay((value / 1_000_000).toFixed(1)) }} className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+{amount}</button>)}
              </div>
            </div>

            <ContractTermsPanel seasons={contractSeasons} onSeasonsChange={setContractSeasons} annualWage={annualWage} suggestedWage={suggestedWage} wageCustomized={wageCustomized} onAnnualWageChange={value => { setAnnualWage(value); setWageCustomized(true) }} onResetWage={() => { setAnnualWage(suggestedWage); setWageCustomized(false) }} />

            {(() => {
              const selectedTeam = saveData.teams.find(t => t.club_id === selectedClubId)
              if (!selectedTeam) return null
              const signingFee = contractFeeFor(annualWage, contractSeasons)
              const budgetAfter = selectedTeam.budget - agreedFee - signingFee
              return (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm"><div className="flex justify-between text-gray-500"><span>External transfer fee</span><span>{formatCurrency(agreedFee)}</span></div><div className="mt-1 flex justify-between text-gray-500"><span>Contract fee</span><span>{formatCurrency(signingFee)}</span></div><div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold"><span>Due now</span><span className="text-[#FD5461]">{formatCurrency(agreedFee + signingFee)}</span></div><div className={`mt-1 text-xs ${budgetAfter < 0 ? 'font-bold text-red-500' : 'text-gray-400'}`}>Budget after signing: {budgetAfter < 0 ? `-$${formatCurrency(Math.abs(budgetAfter))}` : `$${formatCurrency(budgetAfter)}`}</div></div>
              )
            })()}

            <Button
              size="lg"
              className="w-full justify-center"
              onClick={handleSign}
              loading={processing}
              disabled={!selectedClubId}
            >
              Confirm Signing
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={coachManagerOpen} onClose={() => setCoachManagerOpen(false)} title="Manage Coaches" width="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Choose coaches from Master Data for this career. Unselected coaches are removed from this save only.</p>
          {loadingCoaches ? <div className="py-12 text-center text-sm text-gray-400">Loading coach database...</div> : (
            <div className="max-h-[430px] overflow-y-auto rounded-2xl border border-gray-200 bg-white">
              <div className="divide-y divide-gray-100">
                {masterCoaches.map(coach => {
                  const checked = managedCoachIds.includes(String(coach.id))
                  const code = FIFA_NATIONS.find(nation => nation.name === coach.nationality)?.code
                  return <label key={coach.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
                    <input type="checkbox" checked={checked} onChange={() => setManagedCoachIds(ids => checked ? ids.filter(id => id !== String(coach.id)) : [...ids, String(coach.id)])} className="h-4 w-4 accent-[#FD5461]" />
                    {coach.photo_url ? <img src={coach.photo_url} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-400">{coach.name?.charAt(0)}</span>}
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0A1318]">{coach.name}</div><div className="mt-1 flex items-center gap-2 text-xs text-gray-400">{code && <img src={`https://flagcdn.com/${code}.svg`} alt="" className="h-3 w-5 rounded-[2px] object-cover ring-1 ring-black/10" />}<span>{coach.nationality}</span><span>· {coach.age} yrs</span></div></div>
                    <OvrBadge value={coach.ovr} size="md" />
                  </label>
                })}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-gray-400">{managedCoachIds.length} selected</span><Button onClick={saveManagedCoaches} loading={processing} disabled={loadingCoaches}>Save Coach Pool</Button></div>
        </div>
      </Modal>

      {/* Modal: Seasonal Player Growth & Form */}
      <SeasonalGrowthModal
        open={growthModalOpen}
        onClose={() => {
          setGrowthModalOpen(false)
          setPreviewGrowthData(null)
        }}
        seasonName={activeSeason?.name || `Season ${activeSeason?.season_number || 1}`}
        adjustments={previewGrowthData ? previewGrowthData.seasonAdjustments : seasonAdjustments}
        isLocked={isGrowthLocked}
        onReshufflePreview={handleReshufflePreview}
        onConfirmSave={handleConfirmSaveRatings}
        onRestorePrevious={handleRestorePreviousRatings}
        saveData={saveData}
      />

      <SeasonalGrowthModal
        open={coachGrowthModalOpen}
        onClose={() => { setCoachGrowthModalOpen(false); setPreviewCoachGrowthData(null) }}
        seasonName={activeSeason?.name || `Season ${activeSeason?.season_number || 1}`}
        adjustments={previewCoachGrowthData ? previewCoachGrowthData.seasonAdjustments : coachSeasonAdjustments}
        onReshufflePreview={handleCoachReshufflePreview}
        onConfirmSave={handleConfirmCoachRatings}
        entityLabel="Coach"
      />

      <ScrollToTop />
    </div>
  )
}
