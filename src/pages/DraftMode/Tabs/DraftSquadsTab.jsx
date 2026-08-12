import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { DEFAULT_CUP_MATCH_PRIZES, DEFAULT_LEAGUE_PRIZES, updateDraftState } from '../../../services/draftSave'
import { fetchClubs } from '../../../services/clubs'
import PlayerCard from '../../../components/ui/PlayerCard'
import Modal from '../../../components/ui/Modal'
import ClubForm from '../../../components/clubs/ClubForm'
import PlayerForm from '../../../components/players/PlayerForm'
import CoachForm from '../../../components/coaches/CoachForm'
import PlayerProfileModal from '../../../components/players/PlayerProfileModal'
import Button from '../../../components/ui/Button'
import SegmentedControl from '../../../components/ui/SegmentedControl'
import PositionBadge from '../../../components/ui/PositionBadge'
import OvrBadge from '../../../components/ui/OvrBadge'
import { FIFA_NATIONS } from '../../../utils/fifaNations'
import { ArrowDown, ArrowUp, Banknote, Check, ChevronDown, ChevronsLeft, ChevronsRight, ChevronUp, Dices, History, Pencil, Plus, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react'

import ClubSelect from '../../../components/ui/ClubSelect'
import FreeAgentIcon from '../../../components/ui/FreeAgentIcon'
import { formatCurrency } from '../../../utils/currency'
import { transferDraftPlayer, transferDraftCoach } from '../../../services/draftSave'
import CoachCard from '../../../components/ui/CoachCard'
import { useToast } from '../../../components/ui/Toast'
import { fetchPlayers } from '../../../services/players'
import { rollDraft } from '../../../utils/draftLogic'
import { getSeasonMatchSize, orderStartingLineup } from '../../../utils/matchFormat'
import { getCoachEffects } from '../../../utils/coachEffects'
import { annualWageFor, withDefaultContract } from '../../../utils/contracts'

import { calculateOVR, getOVRTier } from '../../../utils/stats'
import ContractTermsPanel from '../../../components/draft/ContractTermsPanel'

const TIER_STYLES = {
  special: 'bg-[#FD5461] text-white',
  gold:    'bg-[#0A1318] text-white',
  silver:  'bg-gray-600 text-white',
  bronze:  'bg-gray-400 text-white',
}

function MatchRecordClub({ club, align = 'left' }) {
  return <span className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>{club?.badge_url ? <img src={club.badge_url} alt="" className="h-8 w-8 shrink-0 object-contain" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[8px] font-semibold text-white" style={{ backgroundColor: club?.badge_color || '#34414A' }}>{(club?.short_name || club?.club_name || 'CLB').slice(0, 3).toUpperCase()}</span>}<span className="truncate text-xs font-medium">{club?.club_name || 'Unknown club'}</span></span>
}

function MatchRecordSummary({ record, emptyLabel }) {
  if (!record) return <div className="mt-4 text-sm text-gray-300">{emptyLabel}</div>
  return <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"><MatchRecordClub club={record.homeClub} /><span className="whitespace-nowrap text-base font-semibold tabular-nums text-[#0A1318]">{record.homeScore} - {record.awayScore}</span><MatchRecordClub club={record.awayClub} align="right" /></div>
}

export default function DraftSquadsTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const toast = useToast()
  const longPressTimer = useRef(null)
  const mobilePlayerDrag = useRef({ active: false, fromIndex: null, targetIndex: null, startX: 0, startY: 0 })
  const [searchParams, setSearchParams] = useSearchParams()
  const [processing, setProcessing] = useState(false)
  const [editTeam, setEditTeam] = useState(null)
  const [editPlayer, setEditPlayer] = useState(null)
  const [editCoach, setEditCoach] = useState(null)
  const [profilePlayer, setProfilePlayer] = useState(null)
  const [activeSection, setActiveSection] = useState('roster')
  const [financePage, setFinancePage] = useState(1)
  const [teamSelectorCollapsed, setTeamSelectorCollapsed] = useState(true)
  const [clubManagerOpen, setClubManagerOpen] = useState(false)
  const [masterClubs, setMasterClubs] = useState([])
  const [managedClubIds, setManagedClubIds] = useState([])
  const [loadingClubs, setLoadingClubs] = useState(false)
  const [clubRecordMetric, setClubRecordMetric] = useState('goals')
  const [editDirty, setEditDirty] = useState(false)
  const [discardAction, setDiscardAction] = useState(null)
  const [draggedPlayerIndex, setDraggedPlayerIndex] = useState(null)
  const [dragTargetIndex, setDragTargetIndex] = useState(null)
  const [draggedTeamId, setDraggedTeamId] = useState(null)
  const [dragTargetTeamId, setDragTargetTeamId] = useState(null)
  const [suppressTransition, setSuppressTransition] = useState(false)
  const [localDraftRoster, setLocalDraftRoster] = useState(null)
  const [savingLineup, setSavingLineup] = useState(false)

  // Re-enable transition after drop snap
  useEffect(() => {
    if (suppressTransition) {
      requestAnimationFrame(() => {
        setSuppressTransition(false)
      })
    }
  }, [suppressTransition])

  const [signingPlayer, setSigningPlayer] = useState(null)
  const [signingKind, setSigningKind] = useState('player')
  const [signingClubId, setSigningClubId] = useState('')
  const [agreedFee, setAgreedFee] = useState(0)
  const [feeDisplay, setFeeDisplay] = useState('0.0')
  const [contractSeasons, setContractSeasons] = useState(3)
  const [annualWage, setAnnualWage] = useState(0)
  const [wageCustomized, setWageCustomized] = useState(false)
  const [renewingContract, setRenewingContract] = useState(null)
  const [renewalSeasons, setRenewalSeasons] = useState(3)
  const [renewalWage, setRenewalWage] = useState(0)
  const [renewalWageCustomized, setRenewalWageCustomized] = useState(false)

  function openSigningModal(person, kind = 'player') {
    setSigningPlayer(person)
    setSigningKind(kind)
    setSigningClubId('')
    setAgreedFee(person.market_value || 0)
    setFeeDisplay(((person.market_value || 0) / 1_000_000).toFixed(1))
    setContractSeasons(3)
    setAnnualWage(annualWageFor(person))
    setWageCustomized(false)
  }

  const suggestedWage = annualWageFor({ ...signingPlayer, market_value: agreedFee })
  useEffect(() => {
    if (!wageCustomized && signingPlayer) setAnnualWage(suggestedWage)
  }, [suggestedWage, signingPlayer, wageCustomized])

  async function handleSign() {
    if (!signingPlayer || !signingClubId) return
    setProcessing(true)
    try {
      const nextSaveData = signingKind === 'coach'
        ? await transferDraftCoach(saveId, signingPlayer.id, signingClubId, agreedFee, contractSeasons, annualWage)
        : await transferDraftPlayer(saveId, signingPlayer.id, signingClubId, agreedFee, contractSeasons, annualWage)
      setSaveData(nextSaveData)
      setSigningPlayer(null)
      setSigningClubId('')
      toast.success(`${signingPlayer.name} transferred successfully`)
    } catch (error) {
      console.error(`Failed to transfer ${signingKind}`, error)
      toast.error(error.message || `Failed to transfer ${signingKind}`)
    } finally {
      setProcessing(false)
    }
  }

  async function handleReleaseCoach(coach) {
    if (!window.confirm(`คุณต้องการยกเลิกสัญญากับ ${coach.name} หรือไม่?`)) return
    try {
      setProcessing(true)
      const nextSaveData = await transferDraftCoach(saveId, coach.id, 'free_agent', 0)
      setSaveData(nextSaveData)
      toast.success(`ยกเลิกสัญญา ${coach.name} เรียบร้อยแล้ว`)
    } catch (err) {
      toast.error(err.message || 'Failed to release coach')
    } finally {
      setProcessing(false)
    }
  }

  function openRenewalModal(person, kind) {
    const current = withDefaultContract(person).contract
    setRenewingContract({ person, kind, current })
    setRenewalSeasons(Math.min(10, Math.max(1, Number(current.seasonsRemaining) || 3)))
    setRenewalWage(Number(current.annualWage) || annualWageFor(person))
    setRenewalWageCustomized(false)
  }

  async function renewContract() {
    if (!renewingContract) return
    const { person, kind } = renewingContract
    const wage = Math.max(0, Number(renewalWage) || 0)
    const seasons = Math.min(10, Math.max(1, Math.round(Number(renewalSeasons) || 1)))
    setProcessing(true)
    try {
      const renew = item => String(item.id) === String(person.id)
        ? { ...withDefaultContract(item), contract: { seasonsRemaining: seasons, annualWage: wage } }
        : item
      const updatedTeams = saveData.teams.map(item => String(item.club_id) === String(team.club_id)
        ? {
            ...item,
            budget: (Number(item.budget) || 0) - wage,
            roster: kind === 'player' ? (item.roster || []).map(renew) : item.roster,
            coaches: kind === 'coach' ? (item.coaches || []).map(renew) : item.coaches,
          }
        : item)
      const nextState = {
        ...saveData,
        teams: updatedTeams,
        transferHistory: [...(saveData.transferHistory || []), {
          id: `renewal-${kind}-${person.id}-${Date.now()}`,
          type: 'expense', category: 'Contract', playerName: person.name,
          fromClubId: team.club_id, fromName: team.club_name, toClubId: team.club_id, toName: team.club_name,
          fee: wage, createdAt: new Date().toISOString(), title: `Renewed ${person.name} for ${seasons} season${seasons === 1 ? '' : 's'}`,
        }],
      }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setRenewingContract(null)
      toast.success(`${person.name} renewed for ${seasons} season${seasons === 1 ? '' : 's'}`)
    } catch (error) {
      toast.error(error.message || 'Failed to renew contract')
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
        club_id: form.club_id || editCoach.club_id || null,
      }

      let newTeams = saveData.teams || []
      let newFreeCoaches = saveData.freeAgentsCoaches || saveData.coaches || []

      const targetClubId = updatedCoach.club_id
      if (targetClubId) {
        newTeams = newTeams.map(item => item.club_id === targetClubId
          ? { ...item, coaches: (item.coaches || []).map(c => String(c.id) === String(editCoach.id) ? updatedCoach : c) }
          : item)
      } else {
        newFreeCoaches = newFreeCoaches.map(c => String(c.id) === String(editCoach.id) ? updatedCoach : c)
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

  function moveCoach(fromIndex, toIndex) {
    const coaches = team?.coaches || []
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= coaches.length || toIndex >= coaches.length) return
    const newCoaches = [...coaches]
    const temp = newCoaches[fromIndex]
    newCoaches[fromIndex] = newCoaches[toIndex]
    newCoaches[toIndex] = temp

    const updatedTeams = saveData.teams.map(t => t.club_id === selectedClubId ? { ...t, coaches: newCoaches } : t)
    const nextSaveData = { ...saveData, teams: updatedTeams }

    // Instant local state update (0ms lag!)
    setSaveData(nextSaveData)

    // Silent background persistence
    updateDraftState(saveId, nextSaveData).catch(err => {
      console.error('Failed to save coach order', err)
    })
  }

  function reorderTeams(draggedClubId, targetClubId) {
    if (!draggedClubId || !targetClubId || draggedClubId === targetClubId) return
    const fromIndex = saveData.teams.findIndex(t => t.club_id === draggedClubId)
    const toIndex = saveData.teams.findIndex(t => t.club_id === targetClubId)
    if (fromIndex === -1 || toIndex === -1) return

    const newTeams = [...saveData.teams]
    const [movedTeam] = newTeams.splice(fromIndex, 1)
    newTeams.splice(toIndex, 0, movedTeam)

    const nextSaveData = { ...saveData, teams: newTeams }

    // Instant local state update (0ms lag!)
    setSaveData(nextSaveData)

    // Silent background persistence
    updateDraftState(saveId, nextSaveData).catch(err => {
      console.error('Failed to save team order', err)
    })
  }

  // Default to first team if none selected
  const selectedClubId = searchParams.get('team') || saveData.teams[0]?.club_id

  useEffect(() => {
    if (!searchParams.get('team') && saveData.teams.length > 0) {
      setSearchParams({ team: saveData.teams[0].club_id }, { replace: true })
    }
  }, [saveData, searchParams, setSearchParams])

  const teamIndex = saveData.teams.findIndex(t => t.club_id === selectedClubId)
  const team = saveData.teams[teamIndex]
  const contractRows = [
    ...(team?.roster || []).map(person => ({ person, kind: 'player', contract: withDefaultContract(person).contract })),
    ...(team?.coaches || []).map(person => ({ person, kind: 'coach', contract: withDefaultContract(person).contract })),
  ].sort((a, b) => a.contract.seasonsRemaining - b.contract.seasonsRemaining || b.contract.annualWage - a.contract.annualWage)
  const annualPayroll = contractRows.reduce((sum, row) => sum + row.contract.annualWage, 0)
  const expiringContracts = contractRows.filter(row => row.contract.seasonsRemaining <= 1)
  const draggedTeamIdx = saveData.teams.findIndex(t => t.club_id === draggedTeamId)
  const dragTargetTeamIdx = saveData.teams.findIndex(t => t.club_id === dragTargetTeamId)

  // Keep local draft roster in sync with selected team roster
  useEffect(() => {
    if (team) {
      setLocalDraftRoster([...(team.roster || [])])
    }
  }, [team?.club_id, team?.roster])

  if (!team) return null
  const displayRoster = localDraftRoster || team.roster || []
  const matchSize = getSeasonMatchSize(saveData.settings)
  const isLineupDirty = JSON.stringify(displayRoster.map(p => p.id)) !== JSON.stringify((team.roster || []).map(p => p.id))
  const starters = displayRoster.slice(0, matchSize)
  const averageOvr = starters.length ? Math.round(starters.reduce((sum, player) => sum + player.ovr, 0) / starters.length) : 0

  const [releasingPlayer, setReleasingPlayer] = useState(null)

  function openReleaseModal(player) {
    setReleasingPlayer(player)
  }

  async function handleConfirmRelease() {
    if (!releasingPlayer) return
    const refundAmount = Math.round((releasingPlayer.market_value || 0) * 0.7)
    
    setProcessing(true)
    try {
      const newTeams = [...saveData.teams]
      const currentTeam = { ...newTeams[teamIndex] }
      const newFreeAgents = [...(saveData.freeAgents || [])]

      // Remove from roster
      currentTeam.roster = currentTeam.roster.filter(p => p.id !== releasingPlayer.id)
      // Refund 70% of current market value to budget
      currentTeam.budget += refundAmount
      
      newTeams[teamIndex] = currentTeam
      
      const releasedPlayer = { ...releasingPlayer, club_id: null, club: null }
      newFreeAgents.push(releasedPlayer)

      const activeSeason = saveData.settings?.seasons?.find(season => season.status === 'active')
      const transferRecord = {
        id: globalThis.crypto?.randomUUID?.() || `transfer-${Date.now()}`,
        playerId: releasingPlayer.id,
        playerName: releasingPlayer.name,
        fromClubId: currentTeam.club_id,
        fromName: currentTeam.club_name,
        toClubId: null,
        toName: 'Free Agent',
        fee: refundAmount,
        week: saveData.currentWeek || 1,
        seasonId: activeSeason?.id || null,
        createdAt: new Date().toISOString(),
      }

      const newSaveData = {
        ...saveData,
        teams: newTeams,
        freeAgents: newFreeAgents,
        transferHistory: [...(saveData.transferHistory || []), transferRecord],
      }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      toast.success(`Released ${releasingPlayer.name} (Refunded $${formatCurrency(refundAmount)})`)
      setReleasingPlayer(null)
    } catch (err) {
      console.error('Failed to release player', err)
      toast.error('Failed to release player')
    } finally {
      setProcessing(false)
    }
  }

  async function openClubManager() {
    setClubManagerOpen(true)
    setManagedClubIds(saveData.teams.map(item => String(item.club_id)))
    setLoadingClubs(true)
    try {
      const clubs = await fetchClubs()
      setMasterClubs(clubs.filter(club => !club.is_national))
    } catch (error) {
      console.error('Failed to load master clubs', error)
    } finally {
      setLoadingClubs(false)
    }
  }

  function toggleManagedClub(clubId) {
    const id = String(clubId)
    setManagedClubIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function saveManagedClubs() {
    if (!managedClubIds.length) return
    setProcessing(true)
    try {
      const selected = new Set(managedClubIds.map(String))
      const removedTeams = saveData.teams.filter(item => !selected.has(String(item.club_id)))
      const keptTeams = saveData.teams.filter(item => selected.has(String(item.club_id)))
      const existingIds = new Set(keptTeams.map(item => String(item.club_id)))
      const addedTeams = masterClubs
        .filter(club => selected.has(String(club.id)) && !existingIds.has(String(club.id)))
        .map(club => ({
          club_id: club.id,
          club_name: club.name,
          short_name: club.short_name || club.name?.slice(0, 3).toUpperCase(),
          badge_url: club.badge_url || null,
          badge_color: club.badge_color || '#0A1318',
          budget: 100_000_000,
          stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 },
          roster: [],
        }))
      const releasedPlayers = removedTeams.flatMap(item => (item.roster || []).map(player => ({ ...player, club_id: null, club: null })))
      const releasedIds = new Set(releasedPlayers.map(player => String(player.id)))
      const freeAgents = [...(saveData.freeAgents || []).filter(player => !releasedIds.has(String(player.id))), ...releasedPlayers]
      const teams = [...keptTeams, ...addedTeams]
      const nextState = { ...saveData, teams, freeAgents }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      if (!teams.some(item => String(item.club_id) === String(selectedClubId))) {
        setSearchParams({ team: teams[0].club_id }, { replace: true })
      }
      setClubManagerOpen(false)
    } catch (error) {
      console.error('Failed to manage save clubs', error)
      toast.error('Failed to update clubs in this save')
    } finally {
      setProcessing(false)
    }
  }

  async function handleBudgetUpdate(form) {
    setProcessing(true)
    try {
      const budgetValue = isNaN(Number(form.budget)) ? 0 : Number(form.budget)
      const oldBudget = editTeam.budget || 0
      const diff = budgetValue - oldBudget

      const newTeams = saveData.teams.map(item => {
        if (item.club_id !== editTeam.club_id) return item
        const existingLogs = item.financialHistory || []
        const adjustmentLog = diff !== 0 ? [{
          id: `adj-${Date.now()}`,
          title: 'Manual Budget Adjustment',
          category: 'Admin Adjustment',
          amount: Math.abs(diff),
          type: diff < 0 ? 'expense' : 'income',
          description: `Budget manually adjusted from $${(oldBudget / 1_000_000).toFixed(1)}M to $${(budgetValue / 1_000_000).toFixed(1)}M`,
          date: new Date().toISOString(),
        }] : []

        return {
          ...item,
          budget: budgetValue,
          financialHistory: [...adjustmentLog, ...existingLogs],
        }
      })
      const newSaveData = { ...saveData, teams: newTeams }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setEditTeam(null)
    } catch (error) {
      console.error('Failed to update team budget', error)
    } finally {
      setProcessing(false)
    }
  }

  async function handlePlayerUpdate(form) {
    if (!editPlayer) return
    setProcessing(true)
    try {
      const name = form.name || `${form.first_name || ''} ${form.last_name || ''}`.trim() || editPlayer.name
      const targetClubId = form.club_id || null
      const updatedPlayer = {
        ...editPlayer,
        name,
        nationality: form.nationality,
        age: form.age,
        position: form.position,
        market_value: form.market_value,
        stats: form.stats,
        ovr: calculateOVR(form.position, form.stats),
        photo_url: form.photo?.preview || editPlayer.photo_url || null,
        club_id: targetClubId,
      }
      delete updatedPlayer.club

      let newTeams = saveData.teams
      let newFreeAgents = saveData.freeAgents || []

      // If club changed or remains same
      const sourceClubId = team.club_id
      if (targetClubId === sourceClubId) {
        newTeams = saveData.teams.map(item => item.club_id === sourceClubId
          ? { ...item, roster: (item.roster || []).map(player => player.id === editPlayer.id ? updatedPlayer : player) }
          : item)
      } else {
        // Remove from source club
        newTeams = saveData.teams.map(item => {
          if (item.club_id === sourceClubId) {
            return { ...item, roster: (item.roster || []).filter(player => player.id !== editPlayer.id) }
          }
          if (targetClubId && item.club_id === targetClubId) {
            return { ...item, roster: [...(item.roster || []), updatedPlayer] }
          }
          return item
        })
        if (!targetClubId) {
          newFreeAgents = [...newFreeAgents, updatedPlayer]
        }
      }

      const newSaveData = { ...saveData, teams: newTeams, freeAgents: newFreeAgents }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      const targetClub = saveData.teams.find(t => t.club_id === targetClubId)
      setProfilePlayer(targetClub ? { ...updatedPlayer, club: { id: targetClub.club_id, name: targetClub.club_name, short_name: targetClub.short_name, badge_url: targetClub.badge_url, badge_color: targetClub.badge_color } } : null)
      setEditDirty(false)
      setEditPlayer(null)
    } catch (error) {
      console.error('Failed to update player', error)
      toast.error(error.message || 'Failed to update player')
    } finally {
      setProcessing(false)
    }
  }

  function openPlayerEditor(player) {
    setEditDirty(false)
    setEditPlayer(player)
    setProfilePlayer({
      ...player,
      club: {
        id: team.club_id,
        name: team.club_name,
        short_name: team.short_name,
        badge_url: team.badge_url,
        badge_color: team.badge_color,
      },
    })
  }

  function requestLeavePlayerEditor(action = 'back') {
    if (editDirty) {
      setDiscardAction(action)
      return
    }
    setEditPlayer(null)
    if (action === 'close') setProfilePlayer(null)
  }

  function confirmDiscardPlayerChanges() {
    const action = discardAction
    setDiscardAction(null)
    setEditDirty(false)
    setEditPlayer(null)
    if (action === 'close') setProfilePlayer(null)
  }

  async function handleSaveLineup() {
    if (!localDraftRoster) return
    setSavingLineup(true)
    try {
      const orderedRoster = orderStartingLineup(localDraftRoster, matchSize)
      const newTeams = saveData.teams.map(item => item.club_id === team.club_id ? { ...item, roster: orderedRoster } : item)
      const newSaveData = { ...saveData, teams: newTeams }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
    } catch (error) {
      console.error('Failed to save lineup', error)
      toast.error('Failed to save lineup')
    } finally {
      setSavingLineup(false)
    }
  }

  const [animOffsets, setAnimOffsets] = useState({})

  function swapPlayer(fromIndex, toIndex) {
    const currentRoster = localDraftRoster || team.roster || []
    if (toIndex < 0 || toIndex >= currentRoster.length || fromIndex === toIndex) return

    const player1 = currentRoster[fromIndex]
    const player2 = currentRoster[toIndex]

    // Distance in pixels based on index gap (~72px per card slot)
    const distance = (toIndex - fromIndex) * 72

    setAnimOffsets({
      [player1.id]: -distance,
      [player2.id]: distance,
    })

    const nextRoster = [...currentRoster]
    nextRoster[fromIndex] = player2
    nextRoster[toIndex] = player1
    setLocalDraftRoster(nextRoster)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimOffsets({})
      })
    })
  }

  function movePlayer(fromIndex, toIndex) {
    swapPlayer(fromIndex, toIndex)
  }

  function openRosterPlayer(player) {
    setProfilePlayer({
      ...player,
      club: {
        id: team.club_id,
        name: team.club_name,
        short_name: team.short_name,
        badge_url: team.badge_url,
        badge_color: team.badge_color,
      },
    })
  }

  function dropPlayerAt(toIndex) {
    if (draggedPlayerIndex == null) return
    swapPlayer(draggedPlayerIndex, toIndex)
    setDraggedPlayerIndex(null)
    setDragTargetIndex(null)
  }

  function startMobilePlayerDrag(playerIndex, event) {
    const touch = event.touches?.[0]
    if (!touch) return
    mobilePlayerDrag.current = { active: false, fromIndex: playerIndex, targetIndex: null, startX: touch.clientX, startY: touch.clientY }
    clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      mobilePlayerDrag.current.active = true
      setDraggedPlayerIndex(playerIndex)
      navigator.vibrate?.(35)
    }, 320)
  }

  function moveMobilePlayerDrag(event) {
    const touch = event.touches?.[0]
    if (!touch) return
    const gesture = mobilePlayerDrag.current
    if (!gesture.active) {
      if (Math.hypot(touch.clientX - gesture.startX, touch.clientY - gesture.startY) > 10) {
        clearTimeout(longPressTimer.current)
        mobilePlayerDrag.current = { active: false, fromIndex: null, targetIndex: null, startX: 0, startY: 0 }
      }
      return
    }
    if (event.cancelable) event.preventDefault()
    const card = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-player-index]')
    const targetIndex = Number(card?.getAttribute('data-player-index'))
    if (Number.isInteger(targetIndex) && targetIndex !== gesture.fromIndex) {
      gesture.targetIndex = targetIndex
      setDragTargetIndex(targetIndex)
    }
  }

  function endMobilePlayerDrag() {
    clearTimeout(longPressTimer.current)
    const { active, fromIndex, targetIndex } = mobilePlayerDrag.current
    if (active && fromIndex != null && targetIndex != null) swapPlayer(fromIndex, targetIndex)
    mobilePlayerDrag.current = { active: false, fromIndex: null, targetIndex: null, startX: 0, startY: 0 }
    setDraggedPlayerIndex(null)
    setDragTargetIndex(null)
  }

  const editPlayerInitial = editPlayer ? {
    first_name: editPlayer.name.split(' ').slice(0, -1).join(' ') || editPlayer.name,
    last_name: editPlayer.name.split(' ').slice(-1).join('') || '',
    nationality: editPlayer.nationality,
    age: editPlayer.age,
    position: editPlayer.position,
    market_value: editPlayer.market_value,
    stats: editPlayer.stats,
    photo: editPlayer.photo_url ? { preview: editPlayer.photo_url } : null,
    club_id: team.club_id,
  } : null

  const seasons = saveData.settings?.seasons || []
  const cups = saveData.settings?.cups || []
  const competitionHistory = Array.from({ length: Math.max(seasons.length, cups.length) }, (_, index) => {
    const season = seasons[index]
    const cup = cups.find(item => season?.id != null && String(item.seasonId) === String(season.id)) || cups.find(item => Number(item.number) === index + 1)
    const standingIndex = (season?.standings || []).findIndex(row => String(row.club_id) === String(team.club_id)) ?? -1
    const leagueMatch = (season?.matches || []).some(week => (week.matches || []).some(match => String(match.home) === String(team.club_id) || String(match.away) === String(team.club_id)))
    const leagueParticipated = standingIndex >= 0 || leagueMatch
    const cupTeams = new Set((cup?.rounds?.[1] || []).flatMap(match => [String(match.home), String(match.away)]))
    const cupParticipated = cupTeams.has(String(team.club_id))
    let cupResult = null
    if (cupParticipated) {
      const position = (cup.prizePayouts || []).find(item => String(item.clubId) === String(team.club_id))?.position
      if (position === 1 || String(cup.champion) === String(team.club_id)) cupResult = 'Champion'
      else if (position === 2) cupResult = 'Runner-up'
      else if (position && position <= 4) cupResult = 'Semi-finals'
      else if (position) cupResult = 'Quarter-finals'
      else if ((cup.rounds?.[3] || []).some(match => [match.home, match.away].some(id => String(id) === String(team.club_id)))) cupResult = cup.status === 'completed' ? 'Runner-up' : 'Final'
      else if ((cup.rounds?.[2] || []).some(match => [match.home, match.away].some(id => String(id) === String(team.club_id)))) cupResult = 'Semi-finals'
      else cupResult = 'Quarter-finals'
    }
    return {
      number: index + 1,
      league: leagueParticipated ? { name: `League ${index + 1}`, result: standingIndex >= 0 ? `#${standingIndex + 1}` : 'Participated' } : null,
      cup: cupParticipated ? { name: `Club Cup ${cup.number || index + 1}`, result: cupResult } : null,
    }
  }).filter(entry => entry.league || entry.cup)
  const allClubMatches = [
    ...seasons.flatMap((season, seasonIndex) => (season.matches || []).flatMap(week => (week.matches || []).filter(match => match.played).map(match => ({ ...match, competition: `League ${seasonIndex + 1}`, standings: season.standings })))),
    ...cups.flatMap(cup => Object.values(cup.rounds || {}).flat().filter(match => match?.played).map(match => ({ ...match, competition: `Club Cup ${cup.number}` }))),
  ].map(match => {
    let homeId = match.home
    let awayId = match.away
    if (homeId === 'place_1' || homeId === '1st') {
      homeId = match.standings?.[0]?.club_id || saveData.teams[0]?.club_id
    }
    if (awayId === 'place_1' || awayId === '1st') {
      awayId = match.standings?.[0]?.club_id || saveData.teams[0]?.club_id
    }
    return { ...match, resolvedHomeId: homeId, resolvedAwayId: awayId }
  }).filter(match => String(match.resolvedHomeId) === String(team.club_id) || String(match.resolvedAwayId) === String(team.club_id)).map(match => {
    const isHome = String(match.resolvedHomeId) === String(team.club_id)
    const homeClub = saveData.teams.find(item => String(item.club_id) === String(match.resolvedHomeId)) || (match.home === 'place_1' ? team : null)
    const awayClub = saveData.teams.find(item => String(item.club_id) === String(match.resolvedAwayId)) || (match.away === '__allstars__' ? { club_id: '__allstars__', club_name: 'League All-Stars', short_name: 'ALL', badge_color: '#FD5461', badge_url: saveData.settings?.allStarBadgeUrl || null } : null)
    return { ...match, homeClub, awayClub, clubGoals: isHome ? match.homeScore : match.awayScore, opponentGoals: isHome ? match.awayScore : match.homeScore }
  })
  const highestScoringMatch = [...allClubMatches].sort((a, b) => b.clubGoals - a.clubGoals || (b.clubGoals - b.opponentGoals) - (a.clubGoals - a.opponentGoals) || String(a.competition).localeCompare(String(b.competition)))[0]
  const biggestDefeat = allClubMatches.filter(match => match.opponentGoals > match.clubGoals).sort((a, b) => (b.opponentGoals - b.clubGoals) - (a.opponentGoals - a.clubGoals) || b.opponentGoals - a.opponentGoals)[0]
  const clubPlayerRecords = (() => {
    const records = new Map()
    const ensure = player => {
      if (!player?.id) return null
      const id = String(player.id)
      if (!records.has(id)) records.set(id, { player: { ...player }, goals: 0, assists: 0, mvps: 0, games: 0 })
      return records.get(id)
    }
    ;(team.roster || []).forEach(ensure)
    // Aggregate match events across all played season and cup matches
    seasons.forEach(season => {
      (season.matches || []).flatMap(week => week.matches || []).filter(match => match.played).forEach(match => {
        let homeId = match.home
        let awayId = match.away
        if (homeId === 'place_1' || homeId === '1st') homeId = season.standings?.[0]?.club_id || saveData.teams[0]?.club_id
        if (awayId === 'place_1' || awayId === '1st') awayId = season.standings?.[0]?.club_id || saveData.teams[0]?.club_id

        const isHome = String(homeId) === String(team.club_id)
        const isAway = String(awayId) === String(team.club_id)
        if (!isHome && !isAway) return

        const targetTeamSide = isHome ? 'home' : 'away'
        const participants = new Set()

        ;(match.events || []).forEach(event => {
          if (event.team === targetTeamSide) {
            if (event.type === 'goal' && event.player) {
              const record = ensure(event.player)
              if (record) {
                record.goals += 1
                participants.add(String(event.player.id))
              }
            }
            if (event.type === 'goal' && event.assist) {
              const record = ensure(event.assist)
              if (record) {
                record.assists += 1
                participants.add(String(event.assist.id))
              }
            }
          }
        })

        if (match.mvp) {
          const mvpInRoster = (team.roster || []).some(p => String(p.id) === String(match.mvp.id))
          if (mvpInRoster) {
            const record = ensure(match.mvp)
            if (record) {
              record.mvps += 1
              participants.add(String(match.mvp.id))
            }
          }
        }

        participants.forEach(id => {
          const rec = records.get(id)
          if (rec) rec.games += 1
        })
      })
    })

    cups.forEach(cup => {
      Object.values(cup.rounds || {}).flat().filter(match => match?.played).forEach(match => {
        const isHome = String(match.home) === String(team.club_id)
        const isAway = String(match.away) === String(team.club_id)
        if (!isHome && !isAway) return

        const targetTeamSide = isHome ? 'home' : 'away'
        const participants = new Set()

        ;(match.events || []).forEach(event => {
          if (event.team === targetTeamSide) {
            if (event.type === 'goal' && event.player) {
              const record = ensure(event.player)
              if (record) {
                record.goals += 1
                participants.add(String(event.player.id))
              }
            }
            if (event.type === 'goal' && event.assist) {
              const record = ensure(event.assist)
              if (record) {
                record.assists += 1
                participants.add(String(event.assist.id))
              }
            }
          }
        })

        if (match.mvp) {
          const mvpInRoster = (team.roster || []).some(p => String(p.id) === String(match.mvp.id))
          if (mvpInRoster) {
            const record = ensure(match.mvp)
            if (record) {
              record.mvps += 1
              participants.add(String(match.mvp.id))
            }
          }
        }

        participants.forEach(id => {
          const rec = records.get(id)
          if (rec) rec.games += 1
        })
      })
    })
    const metricValue = record => clubRecordMetric === 'goals' ? record.goals : clubRecordMetric === 'assists' ? record.assists : record.mvps
    return [...records.values()].map(record => {
      const currentClub = saveData.teams.find(item => (item.roster || []).some(player => String(player.id) === String(record.player.id)))
      return { ...record, currentClub, value: metricValue(record) }
    }).sort((a, b) => b.value - a.value || b.goals - a.goals || b.assists - a.assists || b.mvps - a.mvps || String(a.player.name).localeCompare(String(b.player.name))).slice(0, 5)
  })()

  const clubFinancialLogs = useMemo(() => {
    if (!team) return []
    const logs = []
    const teamId = String(team.club_id)
    const saveCreatedTime = saveData.created_at ? new Date(saveData.created_at).getTime() : Date.now()

    // 1. Initial starting budget — use the value stored at save creation time, fall back to current budget
    const initialBudget = (() => {
      // startingBudgets is keyed by club_id (may be string or number)
      const setupBudgets = saveData.settings?.startingBudgets || saveData.settings?.initialBudgets || saveData.settings?.teamBudgets || {}
      const fromSetup = setupBudgets[teamId] ?? setupBudgets[team.club_id] ?? setupBudgets[Number(teamId)]
      if (typeof fromSetup === 'number') return fromSetup
      // Fall back: undo all recorded financialHistory adjustments to reconstruct original budget
      const historyDelta = (team.financialHistory || []).reduce((sum, adj) => sum + (Number(adj.delta) || 0), 0)
      const computed = (team.budget || 0) - historyDelta
      return computed || team.budget || 0
    })()
    logs.push({
      id: 'init-budget',
      title: 'Initial Club Budget',
      category: 'Starting Capital',
      seasonLabel: 'Season 1',
      seasonNum: 1,
      amount: Math.abs(initialBudget),
      type: initialBudget >= 0 ? 'income' : 'expense',
      description: 'Starting budget set when game was created',
      date: saveData.created_at || null,
      timestamp: saveCreatedTime,
    })

    // 2. League matches (per-match prize)
    seasons.forEach((season, seasonIndex) => {
      const matchPrizes = season.prizeSettings?.matchPrizes || DEFAULT_LEAGUE_PRIZES.matchPrizes
      ;(season.matches || []).forEach(week => {
        (week.matches || []).forEach((match, matchIndex) => {
          if (!match.played) return
          let homeId = String(match.home)
          let awayId = String(match.away)
          if (homeId === 'place_1' || homeId === '1st') homeId = String(season.standings?.[0]?.club_id || '')
          if (awayId === 'place_1' || awayId === '1st') awayId = String(season.standings?.[0]?.club_id || '')

          const isHome = homeId === teamId
          const isAway = awayId === teamId
          const isAllStarMatch = match.home === 'place_1' || match.away === '__allstars__' || match.isAllStarMatch
          const matchTimestamp = match.playedAt ? new Date(match.playedAt).getTime() : saveCreatedTime + (seasonIndex * 30 + (week.week || 1)) * 3600_000

          if (isAllStarMatch) {
            const standings = [...(saveData.teams || [])].sort((a, b) => (b.stats?.PTS || 0) - (a.stats?.PTS || 0) || (b.stats?.GD || 0) - (a.stats?.GD || 0))
            const isFirstPlace = String(standings[0]?.club_id) === teamId
            const isAllStarClub = standings.slice(1, 5).some(t => String(t.club_id) === teamId)

            if (isFirstPlace || isAllStarClub) {
              const hScore = match.homeScore || 0
              const aScore = match.awayScore || 0
              let amount = 0
              let resultLabel = ''

              if (hScore > aScore) {
                amount = isFirstPlace ? matchPrizes.win : matchPrizes.loss
                resultLabel = isFirstPlace ? 'Won All-Stars Super Match' : 'All-Stars Loss Prize'
              } else if (aScore > hScore) {
                amount = isFirstPlace ? matchPrizes.loss : matchPrizes.win
                resultLabel = isFirstPlace ? 'Lost All-Stars Super Match' : 'All-Stars Win Prize'
              } else {
                amount = matchPrizes.draw
                resultLabel = 'All-Stars Match Draw'
              }

              if (amount > 0) {
                logs.push({
                  id: `super-match-${seasonIndex}-${week.week}-${matchIndex}`,
                  title: `Super Match Reward (${resultLabel})`,
                  category: 'League Prize',
                  seasonLabel: `Season ${seasonIndex + 1}`,
                  seasonNum: seasonIndex + 1,
                  amount,
                  type: 'income',
                  description: `Season ${seasonIndex + 1} Week ${week.week} Super Match`,
                  date: match.playedAt || new Date(matchTimestamp).toISOString(),
                  timestamp: matchTimestamp,
                })
              }
            }
          } else if (isHome || isAway) {
            const myScore = isHome ? match.homeScore : match.awayScore
            const oppScore = isHome ? match.awayScore : match.homeScore
            let amount = 0
            let resultLabel = ''

            if (myScore > oppScore) {
              amount = matchPrizes.win
              resultLabel = 'Match Win'
            } else if (myScore < oppScore) {
              amount = matchPrizes.loss
              resultLabel = 'Match Loss'
            } else {
              amount = matchPrizes.draw
              resultLabel = 'Match Draw'
            }

            if (amount > 0) {
              const opponent = saveData.teams.find(t => String(t.club_id) === (isHome ? awayId : homeId))
              logs.push({
                id: `league-match-${seasonIndex}-${week.week}-${matchIndex}`,
                title: `League Match Bonus (${resultLabel})`,
                category: 'League Prize',
                seasonLabel: `Season ${seasonIndex + 1}`,
                seasonNum: seasonIndex + 1,
                amount,
                type: 'income',
                description: `Season ${seasonIndex + 1} Week ${week.week} vs ${opponent?.club_name || 'Opponent'} (${myScore}-${oppScore})`,
                date: match.playedAt || new Date(matchTimestamp).toISOString(),
                timestamp: matchTimestamp,
              })
            }
          }
        })
      })

      // 3. End-of-season placement payouts
      if (season.prizePayouts) {
        const myPlacement = season.prizePayouts.find(p => String(p.clubId) === teamId && p.type !== 'player_award')
        if (myPlacement && myPlacement.amount > 0) {
          const timestamp = saveCreatedTime + (seasonIndex * 30 + 12) * 3600_000
          logs.push({
            id: `season-placement-${seasonIndex}`,
            title: `Season ${seasonIndex + 1} Placement Prize`,
            category: 'Season End Reward',
            seasonLabel: `Season ${seasonIndex + 1}`,
            seasonNum: seasonIndex + 1,
            amount: myPlacement.amount,
            type: 'income',
            description: `Finished Position #${myPlacement.position || season.standings?.findIndex(s => String(s.club_id) === teamId) + 1} in Season ${seasonIndex + 1}`,
            date: season.endedAt || new Date(timestamp).toISOString(),
            timestamp,
          })
        }
      }

      const externalIncome = (season.externalIncome || []).find(item => String(item.clubId) === teamId)
      if (externalIncome?.amount > 0) {
        const timestamp = saveCreatedTime + (seasonIndex * 30 + 1) * 3600_000
        logs.push({ id: `external-income-${seasonIndex}`, title: 'External Competitions Income', category: 'External Competitions', seasonLabel: `Season ${seasonIndex + 1}`, seasonNum: seasonIndex + 1, amount: externalIncome.amount, type: 'income', description: 'Income from competitions outside the managed league and cup', date: new Date(timestamp).toISOString(), timestamp })
      }
      const payroll = (season.payrolls || []).find(item => String(item.clubId) === teamId)
      if (payroll?.amount > 0) {
        const timestamp = saveCreatedTime + (seasonIndex * 30 + 2) * 3600_000
        logs.push({ id: `payroll-${seasonIndex}`, title: 'Season Wages', category: 'Contracts', seasonLabel: `Season ${seasonIndex + 1}`, seasonNum: seasonIndex + 1, amount: payroll.amount, type: 'expense', description: 'Player and coach wages paid for the season', date: new Date(timestamp).toISOString(), timestamp })
      }
    })

    // 4. Cup match bonuses & Tournament final placement prizes
    cups.forEach((cup, cupIndex) => {
      const matchPrizes = cup.matchPrizes || DEFAULT_CUP_MATCH_PRIZES
      Object.values(cup.rounds || {}).flat().filter(m => m?.played).forEach((match, matchIndex) => {
        const isHome = String(match.home) === teamId
        const isAway = String(match.away) === teamId
        if (!isHome && !isAway) return

        const isWinner = String(match.winner) === teamId
        const amount = isWinner ? matchPrizes.win : matchPrizes.loss
        if (amount > 0) {
          const opponentId = isHome ? match.away : match.home
          const opponent = saveData.teams.find(t => String(t.club_id) === String(opponentId))
          const timestamp = match.playedAt ? new Date(match.playedAt).getTime() : saveCreatedTime + (cupIndex * 15 + matchIndex) * 1800_000
          logs.push({
            id: `cup-match-${cupIndex}-${matchIndex}`,
            title: `Cup Match Bonus (${isWinner ? 'Win' : 'Loss'})`,
            category: 'Cup Prize',
            seasonLabel: `Season ${cup.number || cupIndex + 1}`,
            seasonNum: cup.number || cupIndex + 1,
            amount,
            type: 'income',
            description: `Club Cup ${cup.number || cupIndex + 1} vs ${opponent?.club_name || 'Opponent'}`,
            date: match.playedAt || new Date(timestamp).toISOString(),
            timestamp,
          })
        }
      })

      if (cup.prizePayouts) {
        const myCupPayout = cup.prizePayouts.find(p => String(p.clubId) === teamId)
        if (myCupPayout && myCupPayout.amount > 0) {
          const timestamp = saveCreatedTime + (cupIndex * 15 + 10) * 1800_000
          logs.push({
            id: `cup-placement-${cupIndex}`,
            title: `Club Cup ${cup.number || cupIndex + 1} Placement Prize`,
            category: 'Cup Final Reward',
            seasonLabel: `Season ${cup.number || cupIndex + 1}`,
            seasonNum: cup.number || cupIndex + 1,
            amount: myCupPayout.amount,
            type: 'income',
            description: `Finished Position #${myCupPayout.position} in Club Cup ${cup.number || cupIndex + 1}`,
            date: cup.endedAt || new Date(timestamp).toISOString(),
            timestamp,
          })
        }
      }
    })

    // 5. Player awards (Top Scorer, Top Assists, MVP)
    seasons.forEach((season, seasonIndex) => {
      if (season.prizePayouts) {
        season.prizePayouts.filter(p => p.type === 'player_award' && String(p.clubId) === teamId).forEach((award, index) => {
          if (award.amount > 0) {
            const player = (saveData.teams || []).flatMap(t => t.roster || []).find(p => String(p.id) === String(award.playerId))
            const timestamp = saveCreatedTime + (seasonIndex * 30 + 13) * 3600_000
            logs.push({
              id: `award-${seasonIndex}-${index}`,
              title: `Player Award: ${award.label}`,
              category: 'Individual Award',
              seasonLabel: `Season ${seasonIndex + 1}`,
              seasonNum: seasonIndex + 1,
              amount: award.amount,
              type: 'income',
              description: `Awarded to ${player?.name || 'Player'} in Season ${seasonIndex + 1}`,
              date: season.endedAt || new Date(timestamp).toISOString(),
              timestamp,
            })
          }
        })
      }
    })

    // 6. Transfer history (Buying = expense, Selling/Releasing = income)
    ;(saveData.transferHistory || []).forEach((t, index) => {
      const isSeller = String(t.fromClubId) === teamId
      const isBuyer = String(t.toClubId) === teamId
      if (!isSeller && !isBuyer) return
      const timestamp = t.createdAt ? new Date(t.createdAt).getTime() : saveCreatedTime + index * 1000

      if (isBuyer) {
        logs.push({
          id: `transfer-buy-${index}`,
          title: `Signed Player: ${t.playerName}`,
          category: 'Transfer (Expense)',
          seasonLabel: `Season ${t.season || saveData.settings?.currentSeasonIdx + 1 || 1}`,
          seasonNum: t.season || saveData.settings?.currentSeasonIdx + 1 || 1,
          amount: t.fee || 0,
          type: 'expense',
          description: t.fromName ? `Bought from ${t.fromName}` : 'Signed player',
          date: t.createdAt || new Date(timestamp).toISOString(),
          timestamp,
        })
      }
      if (isSeller) {
        logs.push({
          id: `transfer-sell-${index}`,
          title: `Transferred Player: ${t.playerName}`,
          category: 'Transfer (Income)',
          seasonLabel: `Season ${t.season || saveData.settings?.currentSeasonIdx + 1 || 1}`,
          seasonNum: t.season || saveData.settings?.currentSeasonIdx + 1 || 1,
          amount: t.fee || 0,
          type: 'income',
          description: t.toName ? `Sold to ${t.toName}` : 'Released player (Refund)',
          date: t.createdAt || new Date(timestamp).toISOString(),
          timestamp,
        })
      }
    })

    // 7. Manual budget adjustments
    ;(team.financialHistory || []).forEach((adj, index) => {
      const timestamp = adj.date ? new Date(adj.date).getTime() : saveCreatedTime + index * 500
      logs.push({
        id: adj.id || `manual-adj-${index}`,
        title: adj.title || 'Manual Budget Adjustment',
        category: adj.category || 'Admin Adjustment',
        seasonLabel: `Season ${adj.season || saveData.settings?.currentSeasonIdx + 1 || 1}`,
        seasonNum: adj.season || saveData.settings?.currentSeasonIdx + 1 || 1,
        amount: adj.amount || 0,
        type: adj.type || 'income',
        description: adj.description || 'Manual budget edit',
        date: adj.date || new Date(timestamp).toISOString(),
        timestamp,
      })
    })

    // Sort chronologically ascending (oldest first)
    logs.sort((a, b) => a.timestamp - b.timestamp)

    // Compute Balance After by working BACKWARDS from the real team.budget
    // team.budget is ground truth — the last entry's Balance After must equal it
    // We go newest→oldest: each row's "Balance After" = next row's "Balance After" reversed
    let balance = team.budget
    const logsWithBalance = [...logs].reverse().map((log) => {
      const logWithBal = { ...log, runningBalance: balance }
      // undo this transaction to get balance before it
      if (log.type === 'expense') {
        balance += log.amount   // reverse: add back
      } else {
        balance -= log.amount   // reverse: subtract
      }
      return logWithBal
    })

    // logsWithBalance is newest-first — return as-is
    return logsWithBalance
  }, [team, seasons, cups, saveData])

  const loadSavePlayerHistory = useCallback(async (playerId) => {
    const id = String(playerId)
    const historyByClub = new Map()
    const awards = []
    const currentClub = saveData.teams.find(item => (item.roster || []).some(player => String(player.id) === id))
    const fallbackClub = currentClub ? { id: currentClub.club_id, name: currentClub.club_name, short_name: currentClub.short_name || currentClub.club_name?.slice(0, 3).toUpperCase(), badge_url: currentClub.badge_url, badge_color: currentClub.badge_color } : null
    const ensureHistory = club => {
      if (!club) return null
      const key = String(club.id)
      if (!historyByClub.has(key)) historyByClub.set(key, { club, stats: { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0 } })
      return historyByClub.get(key)
    }
    seasons.forEach((season, seasonIndex) => {
      const snapshot = season.stats?.playerSnapshots?.[playerId] || season.stats?.playerSnapshots?.[id]
      const club = snapshot?.club || fallbackClub
      const history = ensureHistory(club)
      if (history) {
        history.stats.goal += season.stats?.topScorers?.[playerId] || season.stats?.topScorers?.[id] || 0
        history.stats.assist += season.stats?.topAssists?.[playerId] || season.stats?.topAssists?.[id] || 0
        history.stats.mvp += season.stats?.mostMvps?.[playerId] || season.stats?.mostMvps?.[id] || 0
        ;(season.matches || []).forEach(week => (week.matches || []).forEach(match => (match.events || []).forEach(event => {
          if (event.type !== 'foul' || String(event.player?.id) !== id) return
          history.stats[event.card === 'red' ? 'red_card' : 'yellow_card'] += 1
        })))
      }
      ;[['topScorers', 'top_scorer'], ['topAssists', 'top_assist'], ['mostMvps', 'most_mvp']].forEach(([key, awardType]) => {
        const entries = Object.entries(season.stats?.[key] || {}).sort((a, b) => b[1] - a[1])
        if (entries[0] && String(entries[0][0]) === id && entries[0][1] > 0 && club) awards.push({ season_name: `Season ${seasonIndex + 1}`, award_type: awardType, club })
      })
    })
    return { history: [...historyByClub.values()], awards }
  }, [saveData.teams, seasons])

  const teamItemRefs = useRef(new Map())

  useEffect(() => {
    if (window.innerWidth >= 768) return
    const activeEl = teamItemRefs.current.get(selectedClubId)
    if (!activeEl) return
    const container = activeEl.closest('.overflow-x-auto')
    if (container) {
      const targetScrollLeft = activeEl.offsetLeft - (container.clientWidth - activeEl.offsetWidth) / 2
      container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' })
    }
  }, [selectedClubId])

  return (
    <div className="flex w-full flex-col items-start gap-6 md:flex-row">
      {/* Team Selector Sidebar */}
      <div className={`w-full flex-shrink-0 transition-[width] duration-300 ease-out ${teamSelectorCollapsed ? 'md:w-14' : 'md:w-64'}`}>
        <div className={`mb-3 hidden h-9 items-center md:flex ${teamSelectorCollapsed ? 'justify-center' : 'justify-between'}`}>
          <h3 className={`overflow-hidden whitespace-nowrap text-sm font-medium text-gray-500 transition-[width,opacity] duration-200 ${teamSelectorCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>Select team</h3>
          <button type="button" onClick={() => setTeamSelectorCollapsed(value => !value)} aria-label={teamSelectorCollapsed ? 'Expand team selector' : 'Collapse team selector'} title={teamSelectorCollapsed ? 'Expand teams' : 'Collapse teams'} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-slate-500 transition-[background-color,color,transform] duration-200 hover:bg-slate-100 hover:text-slate-800 active:scale-95">
            {teamSelectorCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        <div className="relative flex gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:flex-col md:overflow-visible md:pb-0">
          {saveData.teams.map((t, idx) => {
            let translateY = 0
            if (draggedTeamIdx !== -1 && dragTargetTeamIdx !== -1 && draggedTeamIdx !== dragTargetTeamIdx) {
              if (draggedTeamIdx < dragTargetTeamIdx && idx > draggedTeamIdx && idx <= dragTargetTeamIdx) {
                translateY = -64
              } else if (draggedTeamIdx > dragTargetTeamIdx && idx < draggedTeamIdx && idx >= dragTargetTeamIdx) {
                translateY = 64
              }
            }

            const isBeingDragged = draggedTeamId === t.club_id

            return (
              <div
                key={t.club_id}
                ref={node => node ? teamItemRefs.current.set(t.club_id, node) : teamItemRefs.current.delete(t.club_id)}
                draggable
                onDragStart={(e) => {
                  setDraggedTeamId(t.club_id)
                  setDragTargetTeamId(t.club_id)
                  e.dataTransfer.setData('text/plain', t.club_id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  if (draggedTeamId) {
                    setDragTargetTeamId(t.club_id)
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (draggedTeamId && dragTargetTeamId !== t.club_id) {
                    setDragTargetTeamId(t.club_id)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedTeamId && dragTargetTeamId && draggedTeamId !== dragTargetTeamId) {
                    reorderTeams(draggedTeamId, dragTargetTeamId)
                  }
                  setDraggedTeamId(null)
                  setDragTargetTeamId(null)
                }}
                onDragEnd={() => {
                  if (draggedTeamId && dragTargetTeamId && draggedTeamId !== dragTargetTeamId) {
                    reorderTeams(draggedTeamId, dragTargetTeamId)
                  }
                  setDraggedTeamId(null)
                  setDragTargetTeamId(null)
                }}
                style={{
                  transform: !isBeingDragged && translateY ? `translateY(${translateY}px)` : undefined,
                }}
                className={`group relative z-10 flex h-14 flex-shrink-0 items-center rounded-xl border-2 transition-transform duration-200 ease-out md:w-full md:flex-shrink cursor-grab active:cursor-grabbing ${
                  isBeingDragged
                    ? 'opacity-0 border-transparent'
                    : selectedClubId === t.club_id 
                    ? 'border-[#FD5461] bg-[#FD5461]/10'
                    : 'border-transparent hover:bg-slate-100/80'
                }`}
              >
                {/* Team Click & View Area */}
                <div
                  onClick={(e) => {
                    if (selectedClubId === t.club_id) {
                      setEditTeam(t)
                    } else {
                      setSearchParams({ team: t.club_id })
                    }
                    const container = e.currentTarget.closest('.overflow-x-auto')
                    if (container && window.innerWidth < 768) {
                      const targetScrollLeft = e.currentTarget.offsetLeft - (container.clientWidth - e.currentTarget.offsetWidth) / 2
                      container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' })
                    }
                  }}
                  title={teamSelectorCollapsed ? t.club_name : undefined}
                  className={`flex h-full min-w-0 flex-1 cursor-pointer items-center text-left transition-[padding,gap] duration-300 ${teamSelectorCollapsed ? 'justify-center gap-0 px-2' : 'gap-3 px-3'}`}
                >
                  {t.badge_url ? (
                    <img src={t.badge_url} alt={t.club_name} className="h-8 w-8 shrink-0 object-contain pointer-events-none" />
                  ) : (
                    <div className={`h-8 w-8 shrink-0 rounded-full transition-colors ${selectedClubId === t.club_id ? 'bg-[#FD5461]/20 ring-2 ring-[#FD5461]/20' : 'bg-slate-200 group-hover:bg-slate-300'}`} />
                  )}
                  <div className={`hidden min-w-0 overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 md:block ${teamSelectorCollapsed ? 'w-0 flex-none opacity-0' : 'w-auto flex-1 opacity-100'}`}>
                    <div className="font-bold text-sm text-[#0A1318] truncate">{t.club_name}</div>
                    <div className="text-xs font-normal text-gray-500">{(t.roster?.length || 0)} players</div>
                  </div>
                </div>

                <button onClick={() => setEditTeam(t)} aria-label={`Edit ${t.club_name} career budget`} tabIndex={teamSelectorCollapsed ? -1 : 0} className={`hidden md:flex h-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg text-gray-400 transition-[width,opacity,background-color,color,margin] duration-200 hover:bg-slate-100 hover:text-slate-800 ${teamSelectorCollapsed ? 'pointer-events-none m-0 w-0 opacity-0' : 'mr-2 w-9 opacity-100'}`}><Pencil size={16} strokeWidth={2.25} /></button>
                {teamSelectorCollapsed && <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 hidden w-max -translate-x-2 -translate-y-1/2 overflow-hidden whitespace-nowrap rounded-xl bg-[#34414A] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 md:block">{t.club_name}</span>}
              </div>
            )
          })}
          <button type="button" onClick={openClubManager} title="Manage clubs in this save" className={`relative z-10 flex h-12 cursor-pointer items-center rounded-xl border border-transparent text-sm font-medium text-gray-500 transition-[background-color,border-color,color,transform] duration-200 hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98] ${teamSelectorCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100"><Plus size={17} /></span>
            <span className={`hidden md:block overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ${teamSelectorCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>Manage clubs</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full min-w-0 flex-1">
        <div className="mb-6 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            {team.badge_url ? (
              <img src={team.badge_url} alt={team.club_name} className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 object-contain" />
            ) : (
              <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-gray-200" />
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-heading font-black text-[#0A1318] uppercase tracking-wider leading-none mb-0.5 sm:mb-1 truncate">
                {team.club_name}
              </h1>
              <div className={`text-xs sm:text-sm font-semibold ${team.budget < 0 ? 'text-red-600 font-bold' : 'text-[#FD5461]'}`}>
                Budget: {team.budget < 0 ? `-$${(Math.abs(team.budget) / 1000000).toFixed(1)}M (Debt)` : `$${(team.budget / 1000000).toFixed(1)}M`}
              </div>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-start sm:gap-3">
            {(!team.roster || team.roster.length === 0) && (
              <Button
                size="sm"
                variant="outline"
                disabled={processing}
                onClick={async () => {
                  try {
                    setProcessing(true)
                    let availablePool = saveData.freeAgents || []
                    if (!availablePool.length) {
                      const allMaster = await fetchPlayers()
                      const assignedIds = new Set()
                      saveData.teams.forEach(t => (t.roster || []).forEach(p => assignedIds.add(String(p.id))))
                      availablePool = allMaster.filter(p => !assignedIds.has(String(p.id)))
                    }

                    const { newTeams: updatedTeams, remainingPlayers } = rollDraft(saveData.teams, availablePool, teamIndex, undefined, matchSize)
                    const draftedPlayers = updatedTeams?.[teamIndex]?.roster || []
                    const draftedIds = new Set(draftedPlayers.map(p => String(p.id)))
                    const updatedFreeAgents = (remainingPlayers || availablePool).filter(p => !draftedIds.has(String(p.id)))
                    const nextSave = { ...saveData, teams: updatedTeams, freeAgents: updatedFreeAgents }
                    await updateDraftState(saveId, nextSave)
      setSaveData(nextSave)
      setLocalDraftRoster(orderedRoster)
                    toast.success(`Drafted ${draftedPlayers.length} players for ${team.club_name}!`)
                  } catch (err) {
                    console.error('Failed to auto draft players', err)
                    toast.error(err.message || 'Failed to auto draft players')
                  } finally {
                    setProcessing(false)
                  }
                }}
                className="flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider text-[#FD5461] border-[#FD5461]/30 hover:bg-red-50/50"
              >
                <Dices size={16} /> Auto Draft Squad
              </Button>
            )}

            {(team.roster?.length || 0) > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={processing || team.budget < 0}
                title={team.budget < 0 ? 'Clear the club debt before drafting another player' : 'Draft a random player for $40M'}
                onClick={async () => {
                  if (team.budget < 0) {
                    toast.error('This club is in debt. Sell or release a player before drafting again.')
                    return
                  }
                  try {
                    setProcessing(true)
                    let availablePool = saveData.freeAgents || []
                    if (!availablePool.length) {
                      const allMaster = await fetchPlayers()
                      const assignedIds = new Set()
                      saveData.teams.forEach(t => (t.roster || []).forEach(p => assignedIds.add(String(p.id))))
                      availablePool = allMaster.filter(p => !assignedIds.has(String(p.id)))
                    }

                    if (!availablePool.length) {
                      toast.error('No available players in pool!')
                      return
                    }

                    const randomIndex = Math.floor(Math.random() * availablePool.length)
                    const randomPlayer = availablePool[randomIndex]

                    const updatedTeams = saveData.teams.map((t, idx) => {
                      if (idx !== teamIndex) return t
                      return {
                        ...t,
                        budget: (t.budget || 0) - 40000000,
                        roster: [...(t.roster || []), { ...randomPlayer, club_id: t.club_id }]
                      }
                    })

                    const updatedFreeAgents = availablePool.filter(p => String(p.id) !== String(randomPlayer.id))
                    const nextSave = { ...saveData, teams: updatedTeams, freeAgents: updatedFreeAgents }
                    
                    await updateDraftState(saveId, nextSave)
                    setSaveData(nextSave)
                    toast.success(`Drafted ${randomPlayer.name} (${randomPlayer.position} OVR ${randomPlayer.ovr}) for $40M!`)
                  } catch (err) {
                    console.error('Failed to draft random player', err)
                    toast.error(err.message || 'Failed to draft random player')
                  } finally {
                    setProcessing(false)
                  }
                }}
                className={`min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 font-heading text-xs font-bold uppercase tracking-normal sm:flex-none sm:px-4 sm:tracking-wider ${
                  team.budget < 0 
                    ? 'opacity-40 border-gray-300 text-gray-400 cursor-not-allowed' 
                    : 'text-[#FD5461] border-[#FD5461]/30 hover:bg-red-50/50'
                }`}
              >
                <Dices size={16} /> Draft Player ($40M)
              </Button>
            )}
            <OvrBadge value={averageOvr} size="lg" />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl compactOnMobile className="w-full sm:w-fit" ariaLabel="Team details" value={activeSection} onChange={setActiveSection} items={[
              { id: 'roster', label: 'Roster', icon: Users },
              { id: 'coaches', label: `Coaches (${(team.coaches || []).length}/2)`, icon: Users },
              { id: 'lineup', label: 'Lineup', icon: ShieldCheck },
              { id: 'finance', label: 'Finance', icon: Banknote },
              { id: 'history', label: 'History', icon: History },
            ]} />

          {activeSection === 'lineup' && (
            <Button
              size="sm"
              disabled={!isLineupDirty || savingLineup}
              onClick={handleSaveLineup}
              className="rounded-xl px-5 py-2.5 font-heading text-xs font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40"
            >
              {savingLineup ? 'Saving...' : isLineupDirty ? 'Save Lineup' : 'Saved'}
            </Button>
          )}
        </div>

        {activeSection === 'coaches' && (
          <div className="space-y-4">
            <div className={`player-card-grid transition-opacity ${processing ? 'opacity-50' : 'opacity-100'}`}>
              {(team.coaches || []).map(coach => (
                <CoachCard
                  key={coach.id}
                  coach={{
                    ...coach,
                    club: {
                      id: team.club_id,
                      name: team.club_name,
                      short_name: team.club_name,
                      badge_url: team.badge_url,
                      badge_color: team.badge_color
                    }
                  }}
                  onEdit={() => setEditCoach(coach)}
                  onRelease={() => handleReleaseCoach(coach)}
                  onSign={() => openSigningModal({
                    ...coach,
                    club: {
                      id: team.club_id,
                      name: team.club_name,
                      short_name: team.short_name,
                      badge_url: team.badge_url,
                      badge_color: team.badge_color,
                    },
                  }, 'coach')}
                />
              ))}
            </div>
            {(team.coaches || []).length === 0 && (
              <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">
                No coaches in team.
              </div>
            )}
          </div>
        )}

        {activeSection === 'roster' && <div className={`player-card-grid transition-opacity ${processing ? 'opacity-50' : 'opacity-100'}`}>
          {[...(team.roster || [])].sort((a,b) => b.ovr - a.ovr).map(p => {
            const player = {
              ...p,
              club: {
                id: team.club_id,
                name: team.club_name,
                short_name: team.club_name,
                badge_url: team.badge_url,
                badge_color: team.badge_color
              }
            }
            return (
              <PlayerCard 
                key={player.id} 
                player={player} 
                onClick={() => setProfilePlayer(player)}
                onEdit={() => openPlayerEditor(player)}
                onDelete={() => openReleaseModal(player)} 
                deleteLabel="Release"
                onSign={() => openSigningModal(player)}
              />
            )
          })}
        </div>}
        
        {activeSection === 'roster' && (team.roster?.length || 0) === 0 && (
          <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">
            No players in roster.
          </div>
        )}

        {activeSection === 'lineup' && (
          <div className={`transition-opacity ${processing ? 'pointer-events-none opacity-50' : ''}`}>
            {/* Coaches Section */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Coaches</span>
                <span className="text-sm text-gray-400">{(team.coaches || []).length} / 2</span>
              </div>
              {(team.coaches || []).length === 0 ? (
                <div className="flex min-h-10 items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 text-sm text-gray-300">
                  No Coaches Assigned
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {Object.entries(getCoachEffects(team.coaches || []).ratings).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-slate-50 px-2 py-2 text-center">
                        <div className="text-[10px] font-bold text-gray-400">{key}</div>
                        <div className="font-heading text-sm font-black text-[#0A1318]">{Math.round(value)}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-gray-400">The head coach provides the full effect. An assistant only adds up to 20% of skills above 70, so one good coach is enough and a second coach is a smaller upgrade—not double power.</p>
                  {(team.coaches || []).map((coach, coachIndex) => {
                    const roleLabel = coachIndex === 0 ? 'Head Coach' : 'Assistant Coach'
                    const roleBadge = coachIndex === 0 ? 'HC' : 'AC'
                    const flagCode = FIFA_NATIONS.find(n => n.name === coach.nationality)?.code
                    const tier = getOVRTier(coach.ovr || 70)
                    return (
                      <div
                        key={coach.id || coachIndex}
                        className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-gray-100 bg-white shadow-xs hover:border-gray-200 transition-colors"
                      >
                        {/* Stacked Up/Down Reorder Control */}
                        <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 -ml-1 pr-0.5">
                          <button
                            type="button"
                            disabled={coachIndex === 0}
                            onClick={(e) => { e.stopPropagation(); moveCoach(coachIndex, coachIndex - 1) }}
                            aria-label={`Move ${coach.name} up`}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-[#FD5461] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer"
                          >
                            <ChevronUp size={15} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            disabled={coachIndex === (team.coaches || []).length - 1}
                            onClick={(e) => { e.stopPropagation(); moveCoach(coachIndex, coachIndex + 1) }}
                            aria-label={`Move ${coach.name} down`}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-[#FD5461] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer"
                          >
                            <ChevronDown size={15} strokeWidth={2.5} />
                          </button>
                        </div>

                        {/* OVR Badge */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0 ${TIER_STYLES[tier]}`}>
                          {coach.ovr}
                        </div>

                        {/* Photo Avatar */}
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
                          {coach.photo_url ? (
                            <img src={coach.photo_url} alt={coach.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-gray-500 text-sm">
                              {coach.name?.charAt(0) ?? 'C'}
                            </div>
                          )}
                        </div>

                        {/* Coach Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-semibold text-[#0A1318] truncate">{coach.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {team.badge_url ? (
                              <img src={team.badge_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                            ) : (
                              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm text-[5px] font-bold uppercase text-white" style={{ backgroundColor: team.badge_color || '#0A1318' }}>
                                {(team.short_name || team.club_name || 'CLB').slice(0, 3)}
                              </span>
                            )}
                            <span className="text-xs font-semibold uppercase tracking-wide text-[#FD5461]">
                              {roleBadge}
                            </span>
                            {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-2.5 w-4 object-cover rounded-[2px] ring-1 ring-black/10 ml-0.5" alt="" />}
                            {coach.age && <span className="text-xs text-gray-400">{coach.age} yrs</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {[{ title: `Starting ${matchSize}`, start: 0, count: matchSize }, { title: `Substitutes · ${Math.max(0, displayRoster.length - matchSize)}`, start: matchSize, count: Math.max(7, displayRoster.length - matchSize) }].map((section, sectionIndex) => (
              <div key={section.title} className={sectionIndex ? 'mt-6' : ''}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">{section.title}</span>
                  {!sectionIndex && <span className="text-sm text-gray-400">{Math.min(displayRoster.length, matchSize)} / {matchSize}</span>}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: section.count }, (_, localIndex) => {
                    const playerIndex = section.start + localIndex
                    const player = displayRoster[playerIndex]
                    if (!player) return <div key={`empty-${section.start}-${localIndex}`} onDragOver={event => event.preventDefault()} onDrop={() => playerIndex < (team.roster?.length || 0) && dropPlayerAt(playerIndex)} className="flex min-h-10 items-center rounded-xl border border-dashed border-gray-200 px-4 text-sm text-gray-300">Empty</div>
                    const offset = animOffsets[player.id] || 0
                    return (
                      <div
                        key={player.id}
                        data-player-index={playerIndex}
                        draggable
                        onDragStart={(e) => {
                          setDraggedPlayerIndex(playerIndex)
                          e.dataTransfer.setData('text/plain', String(playerIndex))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault()
                          if (draggedPlayerIndex != null && draggedPlayerIndex !== playerIndex) {
                            setDragTargetIndex(playerIndex)
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          if (draggedPlayerIndex != null && draggedPlayerIndex !== playerIndex && dragTargetIndex !== playerIndex) {
                            setDragTargetIndex(playerIndex)
                          }
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault()
                          if (dragTargetIndex === playerIndex) {
                            setDragTargetIndex(null)
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedPlayerIndex(null)
                          setDragTargetIndex(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          dropPlayerAt(playerIndex)
                        }}
                        onTouchStart={event => startMobilePlayerDrag(playerIndex, event)}
                        onTouchEnd={endMobilePlayerDrag}
                        onTouchCancel={endMobilePlayerDrag}
                        onTouchMove={moveMobilePlayerDrag}
                        style={{
                          transform: `translate3d(0, ${offset}px, 0)`,
                          transition: offset ? 'none' : 'transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1), border-color 200ms, background-color 200ms, box-shadow 200ms',
                        }}
                        className={`relative flex min-h-[40px] items-center rounded-xl border px-3 py-1.5 transition-all duration-300 ease-in-out cursor-grab active:cursor-grabbing hover:border-gray-200 ${
                          draggedPlayerIndex === playerIndex
                            ? 'scale-[0.98] border-[#FD5461] opacity-60 shadow-lg ring-2 ring-[#FD5461]/30 bg-white'
                            : dragTargetIndex === playerIndex
                            ? 'scale-[1.01] border-blue-500 bg-blue-50/60 ring-2 ring-blue-400/50 shadow-md z-20'
                            : 'border-gray-100 bg-white'
                        }`}
                      >
                        {dragTargetIndex === playerIndex && (
                          <div className="absolute -top-2.5 right-4 z-30 flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-heading font-black uppercase text-white shadow-md animate-bounce">
                            Swap Target
                          </div>
                        )}
                      {/* Stacked Up/Down Reorder Control */}
                      <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 -ml-1 pr-0.5">
                        <button
                          type="button"
                          disabled={playerIndex === 0}
                          onClick={(e) => { e.stopPropagation(); movePlayer(playerIndex, playerIndex - 1) }}
                          aria-label={`Move ${player.name} up`}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-[#FD5461] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer"
                        >
                          <ChevronUp size={15} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          disabled={playerIndex >= (team.roster?.length || 0) - 1}
                          onClick={(e) => { e.stopPropagation(); movePlayer(playerIndex, playerIndex + 1) }}
                          aria-label={`Move ${player.name} down`}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-[#FD5461] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer"
                        >
                          <ChevronDown size={15} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* OVR Badge (Placed on the left before Photo Avatar) */}
                      <div className="flex-shrink-0 ml-1 mr-0.5">
                        <OvrBadge value={player.ovr} size="sm" />
                      </div>

                      <button type="button" onClick={() => openRosterPlayer(player)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5 pl-2 text-left">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
                          {player.photo_url
                            ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center font-medium text-gray-400 text-xs">{player.name?.charAt(0)}</div>
                          }
                        </div>

                        {/* Name + Flag + Position */}
                        <div className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate text-sm font-bold text-[#0A1318]">
                            {player.name}
                            {sectionIndex === 0 && localIndex === 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FD5461] text-[10px] font-black text-white flex-shrink-0 shadow-xs" title="Captain">C</span>
                            )}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                            <PositionBadge position={player.position} />
                            {(() => {
                              const code = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
                              return code ? <img src={`https://flagcdn.com/${code}.svg`} className="h-3.5 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" alt={player.nationality} title={player.nationality} /> : null
                            })()}
                            {player.age && <span className="text-xs text-gray-400">{player.age} yrs</span>}
                          </span>
                        </div>
                      </button>
                      <div className="hidden sm:flex ml-3 shrink-0 items-center gap-1.5">
                        {sectionIndex === 0
                          ? <Button variant="outline" size="sm" disabled={(team.roster?.length || 0) <= matchSize} onClick={() => movePlayer(playerIndex, matchSize)}>To bench</Button>
                          : <Button variant="outline" size="sm" onClick={() => movePlayer(playerIndex, Math.max(0, matchSize - 1))}>Make starter</Button>}
                        <Button variant="ghost" size="sm" aria-label={`Edit ${player.name}`} title="Edit player" onClick={() => openPlayerEditor(player)}><Pencil size={16} /></Button>
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            ))}
          </div>
        )}

        {false && (
          <div className={`transition-opacity ${processing ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-gray-500">Starting 5</span><span className="text-xs text-gray-400">{Math.min(team.roster.length, 5)} / 5</span></div>
            <div className="mb-6 space-y-2">{Array.from({ length: 5 }, (_, playerIndex) => {
              const player = team.roster[playerIndex]
              if (!player) return <div key={`starter-empty-${playerIndex}`} className="flex min-h-16 items-center rounded-2xl border border-dashed border-gray-200 px-4 text-sm text-gray-300">Empty</div>
              return <div key={player.id} className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
                {player.photo_url ? <img src={player.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-400">{player.name?.charAt(0)}</span>}
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0A1318]">{player.name}</div><div className="mt-0.5 text-xs text-gray-500">{player.position} · OVR {player.ovr}</div></div>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} up`} disabled={playerIndex === 0} onClick={() => movePlayer(playerIndex, playerIndex - 1)}><ArrowUp size={16} /></Button>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} down`} disabled={playerIndex >= team.roster.length - 1} onClick={() => movePlayer(playerIndex, playerIndex + 1)}><ArrowDown size={16} /></Button>
                <Button variant="outline" size="sm" disabled={team.roster.length <= 5} onClick={() => movePlayer(playerIndex, 5)}>To bench</Button>
              </div>
            })}</div>
            <div className="mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-gray-200" /><span className="text-xs font-medium text-gray-400">Substitutes · {Math.max(0, team.roster.length - 5)}</span><div className="h-px flex-1 bg-gray-200" /></div>
            <div className="space-y-2">{Array.from({ length: Math.max(7, team.roster.length - 5) }, (_, localIndex) => {
              const playerIndex = localIndex + 5
              const player = team.roster[playerIndex]
              if (!player) return <div key={`sub-empty-${localIndex}`} className="flex min-h-16 items-center rounded-2xl border border-dashed border-gray-200 px-4 text-sm text-gray-300">Empty</div>
              return <div key={player.id} className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
                {player.photo_url ? <img src={player.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-400">{player.name?.charAt(0)}</span>}
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0A1318]">{player.name}</div><div className="mt-0.5 text-xs text-gray-500">{player.position} · OVR {player.ovr}</div></div>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} up`} onClick={() => movePlayer(playerIndex, playerIndex - 1)}><ArrowUp size={16} /></Button>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} down`} disabled={playerIndex >= team.roster.length - 1} onClick={() => movePlayer(playerIndex, playerIndex + 1)}><ArrowDown size={16} /></Button>
                <Button variant="outline" size="sm" onClick={() => movePlayer(playerIndex, 4)}>Make starter</Button>
              </div>
            })}</div>
          </div>
        )}

        {activeSection === 'finance' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Club Balance</div>
                <div className={`mt-1 font-heading text-2xl font-black ${team.budget < 0 ? 'text-red-600' : 'text-[#0A1318]'}`}>
                  {team.budget < 0 ? `-$${(Math.abs(team.budget) / 1_000_000).toFixed(1)}M` : `$${(team.budget / 1_000_000).toFixed(1)}M`}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditTeam(team)} className="flex items-center gap-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-wider">
                <Pencil size={14} /> Adjust Budget
              </Button>
            </div>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-heading text-base font-black uppercase text-[#0A1318]">Contracts</h2>
                <p className="mt-0.5 text-xs text-gray-400">Wages are deducted when the next season starts. A 1-season contract expires after that payment.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5"><div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Next season payroll</div><div className="mt-1 text-base font-bold text-[#0A1318]">{formatCurrency(annualPayroll)}</div></div>
                  <div className={`rounded-xl px-3 py-2.5 ${expiringContracts.length ? 'bg-red-50' : 'bg-gray-50'}`}><div className={`text-[10px] font-bold uppercase tracking-wider ${expiringContracts.length ? 'text-[#FD5461]' : 'text-gray-400'}`}>Expiring</div><div className="mt-1 text-base font-bold text-[#0A1318]">{expiringContracts.length} contract{expiringContracts.length === 1 ? '' : 's'}</div></div>
                  <div className="col-span-2 rounded-xl bg-gray-50 px-3 py-2.5 sm:col-span-1"><div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">After payroll</div><div className={`mt-1 text-base font-bold ${team.budget - annualPayroll < 0 ? 'text-red-600' : 'text-[#0A1318]'}`}>{formatCurrency(team.budget - annualPayroll)}</div></div>
                </div>
                <p className="mt-3 text-[11px] text-gray-400">Renew anytime. Choose 1–10 seasons and adjust the wage before confirming; one annual wage is charged now.</p>
              </div>
              <div className="overflow-x-auto">
                <div className="divide-y divide-gray-100 sm:hidden">
                  {contractRows.map(({ person, kind, contract }) => {
                    const flagCode = FIFA_NATIONS.find(nation => nation.name === person.nationality)?.code
                    return <div key={`mobile-${kind}-${person.id}`} className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {person.photo_url ? <img src={person.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-black/5" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-400">{person.name?.charAt(0)}</span>}
                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0A1318]">{person.name}</div><div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-gray-400">{flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} alt={person.nationality || ''} className="h-3 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" />}<span className="truncate">{person.nationality || 'Unknown'}</span><span>·</span>{kind === 'coach' ? <span>Coach</span> : <PositionBadge position={person.position} />}</div></div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${contract.seasonsRemaining <= 1 ? 'bg-red-50 text-[#FD5461]' : contract.seasonsRemaining === 2 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>{contract.seasonsRemaining} season{contract.seasonsRemaining === 1 ? '' : 's'}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3"><div><div className="text-sm font-semibold tabular-nums text-[#0A1318]">{formatCurrency(contract.annualWage)}</div><div className="text-[10px] text-gray-400">per season</div></div><Button size="sm" variant="outline" disabled={processing} onClick={() => openRenewalModal(person, kind)}>Renew</Button></div>
                    </div>
                  })}
                </div>
                <table className="hidden w-full border-collapse text-left text-xs sm:table">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3 sm:px-5">Person</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Role</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Club</th>
                      <th className="px-3 py-3">Contract</th>
                      <th className="px-3 py-3 text-right">Wage</th>
                      <th className="w-20 px-4 py-3 sm:px-5"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {contractRows.map(({ person, kind, contract }) => {
                      const flagCode = FIFA_NATIONS.find(nation => nation.name === person.nationality)?.code
                      const role = kind === 'coach' ? 'Coach' : person.position || 'Player'
                      return <tr key={`${kind}-${person.id}`} className="transition-colors hover:bg-gray-50/60">
                        <td className="px-4 py-3 sm:px-5">
                          <div className="flex min-w-[150px] items-center gap-3">
                            {person.photo_url ? <img src={person.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/5" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-400">{person.name?.charAt(0)}</span>}
                            <div className="min-w-0">
                              <div className="max-w-[180px] truncate text-sm font-semibold text-[#0A1318]">{person.name}</div>
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
                                {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} alt={person.nationality || ''} className="h-3 w-5 rounded-[2px] object-cover ring-1 ring-black/10" />}
                                <span className="truncate">{person.nationality || 'Unknown'}</span>
                                {person.age && <span>· {person.age} yrs</span>}
                                <span className="sm:hidden">· {role}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">{kind === 'coach' ? <span className="inline-flex items-center gap-1.5 font-semibold text-gray-600"><ShieldCheck size={14} /> Coach</span> : <PositionBadge position={person.position} />}</td>
                        <td className="hidden px-4 py-3 lg:table-cell"><span className="flex items-center gap-2 whitespace-nowrap">{team.badge_url ? <img src={team.badge_url} alt="" className="h-6 w-6 object-contain" /> : <span className="h-6 w-6 rounded-md" style={{ backgroundColor: team.badge_color || '#34414A' }} />}<span className="max-w-[140px] truncate text-gray-600">{team.club_name}</span></span></td>
                        <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ${contract.seasonsRemaining <= 1 ? 'bg-red-50 text-[#FD5461]' : contract.seasonsRemaining === 2 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>{contract.seasonsRemaining} season{contract.seasonsRemaining === 1 ? '' : 's'}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right"><div className="text-sm font-semibold tabular-nums text-[#0A1318]">{formatCurrency(contract.annualWage)}</div><div className="text-[10px] text-gray-400">per season</div></td>
                        <td className="px-4 py-3 text-right sm:px-5"><Button size="sm" variant="outline" disabled={processing} title={`Edit ${person.name}'s contract`} onClick={() => openRenewalModal(person, kind)}>Renew</Button></td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
              <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-black uppercase text-[#0A1318]">Financial Ledger</h2>
                  <p className="mt-0.5 text-xs text-gray-400">Complete transaction history, season info, and running balance for {team.club_name}.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">{clubFinancialLogs.length} Records</span>
              </div>

              {(() => {
                const pageSize = 10
                const totalPages = Math.ceil(clubFinancialLogs.length / pageSize) || 1
                const currentPage = Math.min(financePage, totalPages)
                const startIndex = (currentPage - 1) * pageSize
                const paginatedLogs = clubFinancialLogs.slice(startIndex, startIndex + pageSize)

                return (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 font-semibold uppercase tracking-wider">
                            <th className="py-3 px-4 w-24">Season</th>
                            <th className="py-3 px-4 w-32">Date & Time</th>
                            <th className="py-3 px-4 w-32">Category</th>
                            <th className="py-3 px-4 min-w-[180px]">Description & Details</th>
                            <th className="py-3 px-4 w-20 text-center">Type</th>
                            <th className="py-3 px-4 w-28 text-right">Amount</th>
                            <th className="py-3 px-4 w-32 text-right">Balance After</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paginatedLogs.map(log => {
                            const formattedDate = log.date
                              ? new Date(log.date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                              : '—'
                            const balanceAfter = log.runningBalance
                            return (
                              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">
                                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                    {log.seasonLabel || 'Season 1'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-gray-400 font-mono whitespace-nowrap">{formattedDate}</td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                    {log.category}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-sm text-[#0A1318]">{log.title}</div>
                                </td>
                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    log.type === 'expense' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {log.type === 'expense' ? 'Expense' : 'Income'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <span className={`font-heading text-sm font-bold tabular-nums ${
                                    log.type === 'expense' ? 'text-red-600' : 'text-emerald-600'
                                  }`}>
                                    {log.type === 'expense' ? '-' : '+'}${((log.amount || 0) / 1_000_000).toFixed(1)}M
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <span className={`font-heading text-sm font-black tabular-nums ${
                                    balanceAfter < 0 ? 'text-red-600' : 'text-[#0A1318]'
                                  }`}>
                                    {balanceAfter < 0 ? `-$${(Math.abs(balanceAfter) / 1_000_000).toFixed(1)}M` : `$${(balanceAfter / 1_000_000).toFixed(1)}M`}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                          {!paginatedLogs.length && (
                            <tr>
                              <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                                No financial transactions logged yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">
                          Showing {startIndex + 1} - {Math.min(startIndex + pageSize, clubFinancialLogs.length)} of {clubFinancialLogs.length} records
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={currentPage <= 1}
                            onClick={() => setFinancePage(p => Math.max(1, p - 1))}
                            className="rounded-lg text-xs"
                          >
                            Previous
                          </Button>
                          <span className="px-2 text-xs font-semibold text-gray-600">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={currentPage >= totalPages}
                            onClick={() => setFinancePage(p => Math.min(totalPages, p + 1))}
                            className="rounded-lg text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </section>
          </div>
        )}

        {activeSection === 'history' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-base font-semibold">Competition history</h2></div>
              <div className="grid grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)] border-b border-gray-100 bg-white px-5 py-3 text-xs font-medium text-gray-500"><span>Season</span><span>League</span><span>Cup</span></div>
              <div className="divide-y divide-gray-100">
                {competitionHistory.map(entry => <div key={entry.number} className="grid min-h-20 grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-5 py-4"><span className="text-sm font-semibold">Season {entry.number}</span>{entry.league ? <span className="min-w-0"><span className="block truncate text-xs text-gray-500">{entry.league.name}</span><span className="mt-1 block text-sm font-semibold text-[#0A1318]">{entry.league.result}</span></span> : <span className="text-sm text-gray-300">—</span>}{entry.cup ? <span className="min-w-0"><span className="block truncate text-xs text-gray-500">{entry.cup.name}</span><span className={`mt-1 block text-sm font-semibold ${entry.cup.result === 'Champion' ? 'text-[#FD5461]' : 'text-[#0A1318]'}`}>{entry.cup.result}</span></span> : <span className="text-sm text-gray-300">—</span>}</div>)}
                {!competitionHistory.length && <div className="px-5 py-10 text-center text-sm text-gray-400">No competition history yet.</div>}
              </div>
            </section>
            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-base font-semibold">Club match records</h2></div>
                <div className="grid divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="p-5"><div className="text-xs font-medium text-gray-500">Most goals scored in a match</div><MatchRecordSummary record={highestScoringMatch} emptyLabel="No completed match yet" /></div>
                  <div className="p-5"><div className="text-xs font-medium text-gray-500">Biggest defeat</div><MatchRecordSummary record={biggestDefeat} emptyLabel="No defeat recorded" /></div>
                </div>
              </section>
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-base font-semibold">Club player records</h2><div className="mt-3 flex gap-1.5">{[{ id: 'goals', label: 'Goals' }, { id: 'assists', label: 'Assists' }, { id: 'mvps', label: 'MVP Awards' }].map(option => <button key={option.id} onClick={() => setClubRecordMetric(option.id)} className={`min-h-9 cursor-pointer rounded-full px-4 text-xs font-medium transition-colors ${clubRecordMetric === option.id ? 'bg-[#FD5461] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'}`}>{option.label}</button>)}</div></div>
                <div className="divide-y divide-gray-100">{clubPlayerRecords.map((record, index) => <div key={record.player.id} className="flex min-h-16 items-center gap-3 px-5 py-3"><span className="w-5 text-center text-xs font-medium text-gray-400">{index + 1}</span>{record.player.photo_url ? <img src={record.player.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">{record.player.name?.charAt(0)}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{record.player.name}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">{record.currentClub ? <>{record.currentClub.badge_url ? <img src={record.currentClub.badge_url} alt="" className="h-4 w-4 shrink-0 object-contain" /> : <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[6px] font-semibold text-white" style={{ backgroundColor: record.currentClub.badge_color || '#34414A' }}>{(record.currentClub.short_name || record.currentClub.club_name).slice(0, 2).toUpperCase()}</span>}<span className="truncate">{record.currentClub.club_name}</span></> : <span>Free Agent</span>}</span></span><span className="text-base font-semibold tabular-nums text-[#FD5461]">{record.value}</span></div>)}</div>
              </section>
            </div>
          </div>
        )}
      </div>
      <Modal open={Boolean(editTeam)} onClose={() => setEditTeam(null)} title="Edit Club">
        {editTeam && <ClubForm identityLocked initialValues={{ name: editTeam.club_name, short_name: editTeam.short_name || editTeam.club_name.slice(0, 3).toUpperCase(), badge: editTeam.badge_url ? { preview: editTeam.badge_url } : null, budget: editTeam.budget || 0 }} onSubmit={handleBudgetUpdate} loading={processing} />}
      </Modal>
      <Modal open={clubManagerOpen} onClose={() => !processing && setClubManagerOpen(false)} title="Manage Clubs">
        <div className="flex h-[min(65dvh,560px)] min-h-0 flex-col">
          <p className="mb-4 shrink-0 text-sm text-gray-500">Choose clubs from the master Clubs page. Removing a club releases every player in its roster to this save's Free Agents.</p>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 hide-scrollbar">
            {loadingClubs ? <div className="py-12 text-center text-sm text-gray-400">Loading clubs...</div> : masterClubs.map(club => {
              const selected = managedClubIds.includes(String(club.id))
              const currentTeam = saveData.teams.find(item => String(item.club_id) === String(club.id))
              return <button type="button" key={club.id} onClick={() => toggleManagedClub(club.id)} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.99] ${selected ? 'border-[#FD5461] bg-[#FD5461]/5' : 'border-gray-200 hover:bg-slate-50'}`}>
                {club.badge_url ? <img src={club.badge_url} alt="" className="h-10 w-10 shrink-0 object-contain" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-semibold text-white" style={{ backgroundColor: club.badge_color || '#0A1318' }}>{(club.short_name || club.name).slice(0, 3).toUpperCase()}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#0A1318]">{club.name}</span><span className="mt-0.5 block text-xs text-gray-500">{currentTeam ? `${currentTeam.roster?.length || 0} players in this save` : 'Available from master data'}</span></span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${selected ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>{selected ? <Check size={17} strokeWidth={2.5} /> : <Plus size={17} />}</span>
              </button>
            })}
          </div>
          <div className="mt-5 shrink-0 border-t border-gray-100 bg-white pt-4"><Button className="w-full" onClick={saveManagedClubs} disabled={processing || loadingClubs || !managedClubIds.length}>{processing ? 'Saving...' : `Save ${managedClubIds.length} clubs`}</Button></div>
        </div>
      </Modal>
      <PlayerProfileModal player={profilePlayer} open={Boolean(profilePlayer)} onClose={() => requestLeavePlayerEditor('close')} onEdit={openPlayerEditor} onRelease={openReleaseModal} historyLoader={loadSavePlayerHistory} editing={Boolean(editPlayer)} onBackEdit={() => requestLeavePlayerEditor('back')} editContent={editPlayer ? <PlayerForm key={editPlayer.id} initialValues={editPlayerInitial} onSubmit={handlePlayerUpdate} onDirtyChange={setEditDirty} loading={processing} clubs={[{ id: team.club_id, name: team.club_name, short_name: team.short_name, badge_url: team.badge_url, badge_color: team.badge_color }]} /> : null} />
      <Modal open={Boolean(discardAction)} onClose={() => setDiscardAction(null)} title="Discard unsaved changes?">
        <p className="text-sm text-gray-500">Your edits have not been saved. If you go back now, these changes will be lost.</p>
        <div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={() => setDiscardAction(null)}>Keep editing</Button><Button onClick={confirmDiscardPlayerChanges}>Discard changes</Button></div>
      </Modal>

      {/* Sign Player Modal */}
      <Modal open={!!signingPlayer} onClose={() => { setSigningPlayer(null); setSigningClubId('') }} title={signingKind === 'coach' ? 'Sign Coach' : 'Sign Player'} width="max-w-md">
        {signingPlayer && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 flex items-center justify-between gap-3 border border-gray-100">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Photo avatar */}
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
                  {signingPlayer.photo_url ? (
                    <img src={signingPlayer.photo_url} alt={signingPlayer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-base">
                      {signingPlayer.name?.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name + flag + club + age */}
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#0A1318] truncate">{signingPlayer.name}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {(() => {
                      const code = FIFA_NATIONS.find(n => n.name === signingPlayer.nationality)?.code
                      return code ? <img src={`https://flagcdn.com/${code}.svg`} alt={signingPlayer.nationality} className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10" /> : null
                    })()}
                    {signingPlayer.club ? (
                      <span className="flex items-center gap-1.5 text-xs text-gray-600">
                        {signingPlayer.club.badge_url ? (
                          <img src={signingPlayer.club.badge_url} alt="" className="h-4 w-4 object-contain shrink-0" />
                        ) : null}
                        <span>{signingPlayer.club.name}</span>
                      </span>
                    ) : <FreeAgentIcon size={20} />}
                    {signingPlayer.age && <span className="text-xs text-gray-400">{signingPlayer.age} yrs</span>}
                  </div>
                </div>
              </div>

              {/* OVR & Position Badge */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <OvrBadge value={signingPlayer.ovr} size="md" />
                <PositionBadge position={signingKind === 'coach' ? 'COACH' : signingPlayer.position} />
              </div>
            </div>

            <ClubSelect
              label="Select Club"
              value={signingClubId}
              onChange={setSigningClubId}
              clubs={[
                ...(signingPlayer.club_id || signingPlayer.club?.id ? [{
                  id: 'free_agent',
                  name: 'Free Agent',
                  short_name: 'FA',
                }] : []),
                ...saveData.teams.filter(t => t.club_id !== (signingPlayer.club_id || signingPlayer.club?.id)).map(t => ({
                  ...t,
                  id: t.club_id,
                  name: signingKind === 'coach'
                    ? `${t.club_name}  ·  $${formatCurrency(t.budget)}  ·  ${t.coaches?.length || 0}/2 coaches`
                    : `${t.club_name}  ·  $${formatCurrency(t.budget)}  ·  ${t.roster?.length || 0} players`,
                  short_name: t.short_name || t.club_name.slice(0, 3).toUpperCase(),
                  disabled: t.budget < 0 || (signingKind === 'coach' && (t.coaches?.length || 0) >= 2),
                }))
              ]}
            />

            <div>
              <label className="mb-1 block text-xs font-heading font-bold uppercase tracking-wider text-gray-500">Transfer Fee</label>
              <div className="flex items-center gap-1.5">
                {[-10, -5].map(amount => <button key={amount} type="button" onClick={() => { const value = Math.max(0, agreedFee + amount * 1_000_000); setAgreedFee(value); setFeeDisplay((value / 1_000_000).toFixed(1)) }} className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">{amount}</button>)}
                <div className="relative min-w-[90px] flex-1"><input type="number" min="0" step="0.1" value={feeDisplay} onChange={event => { setFeeDisplay(event.target.value); setAgreedFee(Math.max(0, Math.round(Number(event.target.value || 0) * 1_000_000))) }} onBlur={() => setFeeDisplay((agreedFee / 1_000_000).toFixed(1))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-center font-heading font-bold focus:border-[#FD5461] focus:outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">M</span></div>
                {[5, 10].map(amount => <button key={amount} type="button" onClick={() => { const value = agreedFee + amount * 1_000_000; setAgreedFee(value); setFeeDisplay((value / 1_000_000).toFixed(1)) }} className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+{amount}</button>)}
              </div>
            </div>

            {signingClubId !== 'free_agent' && <ContractTermsPanel seasons={contractSeasons} onSeasonsChange={setContractSeasons} annualWage={annualWage} suggestedWage={suggestedWage} wageCustomized={wageCustomized} onAnnualWageChange={value => { setAnnualWage(value); setWageCustomized(true) }} onResetWage={() => { setAnnualWage(suggestedWage); setWageCustomized(false) }} />}

            {signingClubId === 'free_agent' && (
              <p className="text-sm font-medium text-[#FD5461]">Current club receives: ${formatCurrency(agreedFee)}</p>
            )}

            {(() => {
              const selectedTeam = saveData.teams.find(t => t.club_id === signingClubId)
              if (!selectedTeam) return null
              const budgetAfter = selectedTeam.budget - agreedFee
              return (
                <p className={`text-sm font-medium ${budgetAfter < 0 ? 'text-red-500 font-bold' : 'text-[#FD5461]'}`}>
                  Budget after signing: {budgetAfter < 0 ? `-$${formatCurrency(Math.abs(budgetAfter))}` : `$${formatCurrency(budgetAfter)}`}
                </p>
              )
            })()}

            <Button
              className="w-full justify-center py-4 text-base"
              onClick={handleSign}
              disabled={!signingClubId || processing}
            >
              {processing ? 'Processing...' : signingClubId === 'free_agent' ? 'Confirm External Sale' : 'Confirm Signing'}
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(renewingContract)} onClose={() => setRenewingContract(null)} title="Renew Contract" width="max-w-xl">
        {renewingContract && (() => {
          const { person, kind, current } = renewingContract
          const flagCode = FIFA_NATIONS.find(nation => nation.name === person.nationality)?.code
          const defaultWage = annualWageFor(person)
          return <div className="space-y-5">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
              {person.photo_url ? <img src={person.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-black/5" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-semibold text-gray-400">{person.name?.charAt(0)}</span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-[#0A1318]">{person.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} alt={person.nationality || ''} className="h-3.5 w-6 rounded-[2px] object-cover ring-1 ring-black/10" />}
                  <span>{person.nationality || 'Unknown'}</span>
                  <span>·</span>
                  {kind === 'coach' ? <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> Coach</span> : <PositionBadge position={person.position} />}
                  {person.age && <><span>·</span><span>{person.age} yrs</span></>}
                </div>
              </div>
              <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-gray-400">Current</div><div className="mt-1 text-sm font-semibold">{current.seasonsRemaining} season{current.seasonsRemaining === 1 ? '' : 's'} · {formatCurrency(current.annualWage)}</div></div>
            </div>
            <ContractTermsPanel seasons={renewalSeasons} onSeasonsChange={setRenewalSeasons} annualWage={renewalWage} suggestedWage={defaultWage} wageCustomized={renewalWageCustomized} paymentLabel="charged now" onAnnualWageChange={value => { setRenewalWage(value); setRenewalWageCustomized(true) }} onResetWage={() => { setRenewalWage(defaultWage); setRenewalWageCustomized(false) }} />
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-sm"><span className="text-gray-500">Pay now</span><span className="font-semibold tabular-nums text-[#0A1318]">{formatCurrency(renewalWage)}</span></div>
            <Button className="w-full justify-center py-3" disabled={processing} onClick={renewContract}>{processing ? 'Saving...' : 'Confirm Renewal'}</Button>
          </div>
        })()}
      </Modal>

      {/* Release Confirmation Modal */}
      <Modal open={Boolean(releasingPlayer)} onClose={() => setReleasingPlayer(null)} title="Release Player" width="max-w-md">
        {releasingPlayer && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-3.5">
              {releasingPlayer.photo_url ? (
                <img src={releasingPlayer.photo_url} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-black/5" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-gray-400 font-bold text-lg">
                  {releasingPlayer.name?.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-heading text-base font-black text-[#0A1318]">{releasingPlayer.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                  <PositionBadge position={releasingPlayer.position} />
                  <span>OVR {releasingPlayer.ovr}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Current Market Value:</span>
                <span className="font-semibold text-gray-900">${formatCurrency(releasingPlayer.market_value || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-medium">
                <span>Release Refund Rate:</span>
                <span className="font-bold">70%</span>
              </div>
              <div className="border-t border-rose-200/60 pt-2 flex justify-between text-sm font-bold text-rose-700">
                <span>Refunded to Budget:</span>
                <span>+${formatCurrency(Math.round((releasingPlayer.market_value || 0) * 0.7))}</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Releasing this player will transfer them to Free Agents and refund 70% of their current market value to your club budget.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1 justify-center py-3"
                onClick={() => setReleasingPlayer(null)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1 justify-center py-3"
                onClick={handleConfirmRelease}
                disabled={processing}
              >
                {processing ? 'Releasing...' : 'Confirm Release'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Edit Coach Modal */}
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
    </div>
  )
}
