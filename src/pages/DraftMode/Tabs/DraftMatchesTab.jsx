import { useState, useEffect, useMemo } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { DEFAULT_CUP_MATCH_PRIZES, DEFAULT_CUP_PRIZES, DEFAULT_LEAGUE_PRIZES, updateDraftCupPrizeSettings, updateDraftSeasonPrizeSettings, updateDraftState } from '../../../services/draftSave'
import { generateMockRoster, generateSchedule, simulateMatch } from '../../../utils/draftLogic'
import { applySeasonalPlayerAdjustments } from '../../../utils/playerGrowth'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import LeagueSetupModal from '../../../components/matches/LeagueSetupModal'
import LeagueStandingsTable from '../../../components/draft/LeagueStandingsTable'
import AnimatedTabs from '../../../components/ui/AnimatedTabs'
import SegmentedControl from '../../../components/ui/SegmentedControl'
import { FIFA_NATIONS } from '../../../utils/fifaNations'
import { ArrowDown, ArrowUp, Banknote, CalendarClock, Crown, Eye, Medal, Play, Settings2, Trophy } from 'lucide-react'
import ResultScore from '../../../components/draft/ResultScore'
import PlayerProfileModal from '../../../components/players/PlayerProfileModal'

import OvrBadge from '../../../components/ui/OvrBadge'
import AllStarIcon from '../../../components/ui/AllStarIcon'

// --- HELPER COMPONENTS ---

function PlayerIdentity({ player }) {
  const flagCode = FIFA_NATIONS.find(nation => nation.name === player?.nationality)?.code
  const club = player?.club
  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-gray-500">
      {club?.badge_url
        ? <img src={club.badge_url} alt="" className="h-4 w-4 shrink-0 object-contain" />
        : club
          ? <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[7px] font-medium uppercase text-white" style={{ backgroundColor: club.badge_color || '#0A1318' }}>{(club.short_name || club.name || 'CLB').slice(0, 2)}</span>
          : null}
      {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} alt={player?.nationality || ''} title={player?.nationality || ''} className="h-3 w-[18px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" />}
    </div>
  )
}

const PODIUM_STYLES = [
  { row: '', badge: 'bg-[#FD5461] text-white shadow-sm shadow-red-200', value: 'text-[#0A1318]' },
  { row: '', badge: 'bg-[#0A1318] text-white shadow-sm shadow-gray-200', value: 'text-[#0A1318]' },
  { row: '', badge: 'border-2 border-[#FD5461] bg-white text-[#FD5461]', value: 'text-[#0A1318]' },
]

function previousPlayerRanks(season, statKey) {
  const playedWeeks = (season?.matches || []).filter(week => week.matches?.some(match => match.played)).map(week => week.week)
  const latestWeek = playedWeeks.length ? Math.max(...playedWeeks) : null
  if (latestWeek == null) return new Map()
  const totals = {}
  ;(season.matches || []).filter(week => week.week < latestWeek).forEach(week => week.matches?.filter(match => match.played).forEach(match => {
    ;(match.events || []).forEach(event => {
      const playerId = statKey === 'topScorers' && event.type === 'goal' ? event.player?.id
        : statKey === 'topAssists' && event.type === 'goal' ? event.assist?.id
          : statKey === 'mostFouls' && event.type === 'foul' ? event.player?.id : null
      if (playerId != null) totals[playerId] = (totals[playerId] || 0) + 1
    })
    if (statKey === 'mostMvps' && match.mvp?.id != null) totals[match.mvp.id] = (totals[match.mvp.id] || 0) + 1
  }))
  return new Map(Object.entries(totals).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([id], index) => [String(id), index + 1]))
}

function RankBadge({ rank }) {
  const podium = PODIUM_STYLES[rank - 1]
  if (!podium) return <span className="w-7 text-center text-xs font-semibold text-gray-400">{rank}</span>
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${podium.badge}`} aria-label={`Rank ${rank}`}>
      {rank === 1 ? <Crown size={14} strokeWidth={2.5} /> : <Medal size={14} strokeWidth={2.5} />}
    </span>
  )
}

function RankTrend({ change }) {
  if (!change) return null
  const rising = change > 0
  return <span className={`flex shrink-0 items-center gap-0.5 type-caption ${rising ? 'text-green-600' : 'text-[#FD5461]'}`}>{rising ? <ArrowUp size={13} /> : <ArrowDown size={13} />}{Math.abs(change)}</span>
}

export function PrizeSettingsForm({ prizes, setPrizes, cupPrizes, setCupPrizes, cup, locked, payouts, onSave, saving }) {
  const setPlacement = (index, millions) => setPrizes(current => ({
    ...current,
    placements: current.placements.map((value, itemIndex) => itemIndex === index ? Math.max(0, Number(millions) || 0) * 1_000_000 : value),
  }))
  const adjustPlacement = (index, diffMillions) => setPrizes(current => ({
    ...current,
    placements: current.placements.map((value, itemIndex) => itemIndex === index ? Math.max(0, value + diffMillions * 1_000_000) : value),
  }))

  const setAward = (key, millions) => setPrizes(current => ({
    ...current,
    awards: { ...current.awards, [key]: Math.max(0, Number(millions) || 0) * 1_000_000 },
  }))
  const adjustAward = (key, diffMillions) => setPrizes(current => ({
    ...current,
    awards: { ...current.awards, [key]: Math.max(0, (current.awards[key] || 0) + diffMillions * 1_000_000) },
  }))

  const awardRows = [
    ['topScorers', 'Top Scorer', 'Most goals'],
    ['topAssists', 'Top Assists', 'Most assists'],
    ['mostMvps', 'Most MVP', 'Most MVP awards'],
  ]
  const adjustMatchPrize = (key, diffMillions) => setPrizes(current => ({
    ...current,
    matchPrizes: {
      ...(current.matchPrizes || DEFAULT_LEAGUE_PRIZES.matchPrizes),
      [key]: Math.max(0, ((current.matchPrizes?.[key] ?? DEFAULT_LEAGUE_PRIZES.matchPrizes[key]) || 0) + diffMillions * 1_000_000),
    },
  }))

  const setMatchPrize = (key, millions) => setPrizes(current => ({
    ...current,
    matchPrizes: {
      ...(current.matchPrizes || DEFAULT_LEAGUE_PRIZES.matchPrizes),
      [key]: Math.max(0, Number(millions) || 0) * 1_000_000,
    },
  }))

  const matchPrizeRows = [
    ['win', 'Match Win Prize', 'Bonus for winning a league match'],
    ['draw', 'Match Draw Prize', 'Bonus for drawing a league match'],
    ['loss', 'Match Loss Prize', 'Bonus for losing a league match'],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[#0A1318]">Placement prizes</h3>
        <p className="mt-0.5 text-xs text-gray-400">Awarded to clubs based on final league standings.</p>
        <div className="mt-3 space-y-2">
          {prizes.placements.map((amount, index) => (
            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex min-w-0 items-center gap-3">
                <RankBadge rank={index + 1} />
                <span className="truncate text-sm font-semibold">Position {index + 1}</span>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-1.5">
                <button type="button" disabled={locked} onClick={() => adjustPlacement(index, -10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-10</button>
                <button type="button" disabled={locked} onClick={() => adjustPlacement(index, -1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-1</button>
                <span className="relative flex h-9 flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                  <span className="flex items-baseline justify-center w-full">
                    <input
                      disabled={locked}
                      type="text"
                      inputMode="decimal"
                      value={(amount / 1_000_000).toFixed(1)}
                      onFocus={event => event.target.select()}
                      onChange={event => {
                        const raw = event.target.value.replace(/[^0-9.]/g, '')
                        if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                        const millions = Number.parseFloat(raw)
                        if (Number.isFinite(millions)) setPlacement(index, millions)
                      }}
                      className="bg-transparent text-right text-sm font-bold tabular-nums outline-none disabled:bg-transparent min-w-0 flex-1"
                    />
                    <span className="ml-1 text-xs font-bold text-gray-400 shrink-0">M</span>
                  </span>
                </span>
                <button type="button" disabled={locked} onClick={() => adjustPlacement(index, 1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+1</button>
                <button type="button" disabled={locked} onClick={() => adjustPlacement(index, 10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+10</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#0A1318]">Match-by-match prizes</h3>
        <p className="mt-0.5 text-xs text-gray-400">Bonus paid to clubs after every played league match.</p>
        <div className="mt-3 space-y-2">
          {matchPrizeRows.map(([key, label, description]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#FD5461]"><Trophy size={18} /></span>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs text-gray-400">{description}</span>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-1.5">
                <button type="button" disabled={locked} onClick={() => adjustMatchPrize(key, -10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-10</button>
                <button type="button" disabled={locked} onClick={() => adjustMatchPrize(key, -1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-1</button>
                <span className="relative flex h-9 flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                  <span className="flex items-baseline justify-center w-full">
                    <input
                      disabled={locked}
                      type="text"
                      inputMode="decimal"
                      value={(((prizes.matchPrizes?.[key] ?? DEFAULT_LEAGUE_PRIZES.matchPrizes[key]) || 0) / 1_000_000).toFixed(1)}
                      onFocus={event => event.target.select()}
                      onChange={event => {
                        const raw = event.target.value.replace(/[^0-9.]/g, '')
                        if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                        const val = Number.parseFloat(raw)
                        if (Number.isFinite(val)) setMatchPrize(key, val)
                      }}
                      className="bg-transparent text-right text-sm font-bold tabular-nums outline-none disabled:bg-transparent min-w-0 flex-1"
                    />
                    <span className="ml-1 text-xs font-bold text-gray-400 shrink-0">M</span>
                  </span>
                </span>
                <button type="button" disabled={locked} onClick={() => adjustMatchPrize(key, 1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+1</button>
                <button type="button" disabled={locked} onClick={() => adjustMatchPrize(key, 10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+10</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#0A1318]">Player award bonuses</h3>
        <p className="mt-0.5 text-xs text-gray-400">Bonus paid to the player's club at season end.</p>
        <div className="mt-3 space-y-2">
          {awardRows.map(([key, label, description]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#FD5461]"><Banknote size={18} /></span>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs text-gray-400">{description}</span>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-1.5">
                <button type="button" disabled={locked} onClick={() => adjustAward(key, -10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-10</button>
                <button type="button" disabled={locked} onClick={() => adjustAward(key, -1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-1</button>
                <span className="relative flex h-9 flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                  <span className="flex items-baseline justify-center w-full">
                    <input
                      disabled={locked}
                      type="text"
                      inputMode="decimal"
                      value={((prizes.awards[key] || 0) / 1_000_000).toFixed(1)}
                      onFocus={event => event.target.select()}
                      onChange={event => {
                        const raw = event.target.value.replace(/[^0-9.]/g, '')
                        if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                        const millions = Number.parseFloat(raw)
                        if (Number.isFinite(millions)) setAward(key, millions)
                      }}
                      className="bg-transparent text-right text-sm font-bold tabular-nums outline-none disabled:bg-transparent min-w-0 flex-1"
                    />
                    <span className="ml-1 text-xs font-bold text-gray-400 shrink-0">M</span>
                  </span>
                </span>
                <button type="button" disabled={locked} onClick={() => adjustAward(key, 1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+1</button>
                <button type="button" disabled={locked} onClick={() => adjustAward(key, 10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+10</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {locked && <div className="rounded-2xl bg-gray-50 p-4"><p className="text-sm font-semibold">Prizes paid</p><p className="mt-1 text-sm text-gray-500">{payouts?.length || 0} payouts were added to club budgets when this season ended.</p></div>}
      {!locked && <button onClick={onSave} disabled={saving} className="w-full rounded-xl bg-[#FD5461] py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 hover:bg-red-500 disabled:opacity-50">{saving ? 'Saving...' : 'Save prize settings'}</button>}
    </div>
  )
}

function SeasonRewardSummary({ season, cup, allPlayers, teams, onContinue }) {
  return (
    <div className="space-y-6">
      <SeasonPrizeResults season={season} cup={cup} allPlayers={allPlayers} teams={teams} />
      <button onClick={onContinue} className="w-full rounded-xl bg-[#FD5461] py-3 text-sm font-semibold text-white hover:bg-red-500">
        Continue to new season setup
      </button>
    </div>
  )

  /* Kept below temporarily for compatibility with older save snapshots. */
  const settings = {
    placements: season.prizeSettings?.placements || DEFAULT_LEAGUE_PRIZES.placements,
    awards: { ...DEFAULT_LEAGUE_PRIZES.awards, ...(season.prizeSettings?.awards || {}) },
  }
  const rows = (season.standings || []).slice(0, 5).map((standing, index) => ({
    ...standing,
    position: index + 1,
    placementPrize: settings.placements[index] || 0,
    awards: [],
  }))
  const awardLabels = { topScorers: 'Top Scorer', topAssists: 'Top Assists', mostMvps: 'Most MVP' }
  Object.entries(awardLabels).forEach(([key, label]) => {
    const leader = Object.entries(season.stats?.[key] || {}).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]
    if (!leader) return
    const playerId = leader[0]
    const snapshot = season.stats?.playerSnapshots?.[playerId]
    const current = allPlayers.find(player => String(player.id) === String(playerId))
    const player = snapshot ? { ...current, ...snapshot } : current
    const clubId = snapshot?.club?.id || current?.club?.id
    const row = rows.find(item => String(item.club_id) === String(clubId))
    if (row) row.awards.push({ label, playerName: player?.name || 'Unknown player', amount: settings.awards[key] || 0 })
  })
  return (
    <div className="space-y-5">
      <div><h3 className="text-sm font-semibold">Final rewards by club</h3><p className="mt-1 text-sm text-gray-500">League position and player awards are combined into each club's total.</p></div>
      <div className="space-y-2">{rows.map(row => { const total = row.placementPrize + row.awards.reduce((sum, award) => sum + award.amount, 0); return <article key={row.club_id} className="rounded-2xl border border-gray-200 p-4"><div className="flex items-center gap-3"><RankBadge rank={row.position} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{row.club_name}</div><div className="text-xs text-gray-500">Position {row.position} · ${(row.placementPrize / 1_000_000).toFixed(1)}M</div></div><div className="text-right"><div className="text-xs text-gray-400">Total reward</div><div className="text-lg font-bold text-[#FD5461]">${(total / 1_000_000).toFixed(1)}M</div></div></div>{row.awards.length > 0 && <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">{row.awards.map(award => <div key={award.label} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate"><span className="font-medium">{award.label}</span><span className="text-gray-400"> · {award.playerName}</span></span><span className="shrink-0 font-semibold text-green-600">+${(award.amount / 1_000_000).toFixed(1)}M</span></div>)}</div>}</article> })}</div>
      <button onClick={onContinue} className="w-full rounded-xl bg-[#FD5461] py-3 text-sm font-semibold text-white hover:bg-red-500">Continue to new season setup</button>
    </div>
  )
}

function formatPrize(amount) {
  return `$${(Math.max(0, Number(amount) || 0) / 1_000_000).toFixed(1)}M`
}

function PrizeClubBadge({ club, className = 'h-9 w-9' }) {
  const name = club?.club_name || club?.clubName || club?.name || 'Club'
  const shortName = club?.short_name || club?.shortName || name.slice(0, 3).toUpperCase()
  const badgeUrl = club?.badge_url || club?.badgeUrl
  if (badgeUrl) return <img src={badgeUrl} alt="" className={`${className} shrink-0 rounded-lg object-contain`} />
  return <span className={`${className} flex shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold uppercase text-white`} style={{ backgroundColor: club?.badge_color || club?.badgeColor || '#0A1318' }}>{shortName.slice(0, 3)}</span>
}

function SeasonPrizeResults({ season, cup, allPlayers, teams }) {
  const standings = season?.standings || []
  const payouts = season?.prizePayouts || []
  const snapshots = season?.stats?.playerSnapshots || {}
  const teamById = id => teams?.find(team => String(team.club_id) === String(id))
  const placementRows = standings.map((standing, index) => {
    const payout = payouts.find(item => item.type === 'placement' && String(item.clubId) === String(standing.club_id))
    return { ...standing, position: index + 1, amount: payout?.amount ?? season?.prizeSettings?.placements?.[index] ?? 0 }
  })
  const awardDefinitions = [
    { key: 'topScorers', label: 'Top Scorer', unit: 'goals' },
    { key: 'topAssists', label: 'Top Assists', unit: 'assists' },
    { key: 'mostMvps', label: 'Most MVP', unit: 'MVP awards' },
  ]
  const awardRows = awardDefinitions.map(definition => {
    const statEntries = Object.entries(season?.stats?.[definition.key] || {})
    if (!statEntries.length) return null
    let maxVal = -1
    statEntries.forEach(([, val]) => {
      const num = Number(val) || 0
      if (num > maxVal) maxVal = num
    })
    if (maxVal <= 0) return null

    // Find all players tied for the max value and sort by team standings rank
    const tiedLeaders = statEntries.filter(([, val]) => (Number(val) || 0) === maxVal)
    const playersList = tiedLeaders.map(([playerId]) => {
      const current = allPlayers.find(player => String(player.id) === String(playerId))
      const snapshot = snapshots[playerId]
      return snapshot ? { ...current, ...snapshot, club: snapshot.club } : current
    }).filter(Boolean).sort((a, b) => {
      const aClubId = String(a.club?.id || a.club_id || '')
      const bClubId = String(b.club?.id || b.club_id || '')
      const aRank = standings.findIndex(s => String(s.club_id) === aClubId)
      const bRank = standings.findIndex(s => String(s.club_id) === bClubId)
      const aPos = aRank >= 0 ? aRank : 999
      const bPos = bRank >= 0 ? bRank : 999
      if (aPos !== bPos) return aPos - bPos
      return String(a.name || '').localeCompare(String(b.name || ''))
    })

    const firstPlayerId = tiedLeaders[0][0]
    const payout = payouts.find(item => item.type === 'player_award' && String(item.playerId) === String(firstPlayerId) && item.label === definition.label)
    const amount = payout?.amount ?? season?.prizeSettings?.awards?.[definition.key] ?? 0

    return {
      ...definition,
      count: maxVal,
      players: playersList,
      amount,
      isTied: playersList.length > 1,
    }
  }).filter(Boolean)
  const finalMatch = cup?.rounds?.[3]?.[0] || cup?.rounds?.['3']?.[0]
  const cupRows = (cup?.prizePayouts || []).map(row => ({ ...row, club: teamById(row.clubId) || row }))
  const homeClub = finalMatch ? (teamById(finalMatch.home) || { club_name: finalMatch.homeName || finalMatch.home }) : null
  const awayClub = finalMatch ? (teamById(finalMatch.away) || { club_name: finalMatch.awayName || finalMatch.away }) : null
  const championPayout = cupRows.find(row => row.position === 1)

  return (
    <div className="space-y-7">
      <section>
        <div className="mb-3 flex items-center gap-2"><Trophy size={18} className="text-[#FD5461]" /><h3 className="text-base font-semibold text-[#0A1318]">League rewards</h3></div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {placementRows.map(row => <div key={row.club_id} className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0"><RankBadge rank={row.position} /><PrizeClubBadge club={row} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-[#0A1318]">{row.club_name}</div><div className="mt-0.5 text-xs text-gray-500">{row.stats?.PTS || 0} PTS{row.position === 1 ? ' · League winner' : ''}</div></div><span className="shrink-0 text-sm font-semibold text-[#FD5461]">{formatPrize(row.amount)}</span></div>)}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center gap-2"><Crown size={18} className="text-[#FD5461]" /><h3 className="text-base font-semibold text-[#0A1318]">Player awards</h3></div>
        <p className="mb-3 text-sm text-gray-500">Final totals from every league and cup match in this season.</p>
        {awardRows.length ? (
          <div className="space-y-2">
            {awardRows.map(row => (
              <article key={row.key} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3">
                {/* Stacked overlapping avatars if multiple tied winners */}
                <div className="flex shrink-0 items-center -space-x-4">
                  {row.players.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-2 ring-white shadow-xs"
                      style={{ zIndex: row.players.length - idx }}
                    >
                      {p?.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-gray-400">{p?.name?.charAt(0) || '?'}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#FD5461]">
                    {row.label} {row.isTied && <span className="font-normal text-gray-400">(Joint Winners)</span>}
                  </div>
                  <div className="truncate text-sm font-semibold text-[#0A1318]">
                    {row.players.map(p => p.name).join(', ')}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {row.players.map((p, idx) => (
                      <span key={p.id || idx} className="inline-flex items-center gap-1">
                        {idx > 0 && <span className="mr-1 text-gray-300">·</span>}
                        <PlayerIdentity player={p} />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-[#0A1318]">{row.count} {row.unit}</div>
                  <div className="mt-1 text-sm font-semibold text-[#FD5461]">{formatPrize(row.amount)}</div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-50 p-5 text-center text-sm text-gray-500">No player awards were recorded.</div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><Medal size={18} className="text-[#FD5461]" /><h3 className="text-base font-semibold text-[#0A1318]">Cup rewards</h3></div>
          {finalMatch?.played ? <div className="mb-3 rounded-2xl border border-red-100 bg-red-50/50 p-4"><div className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-[#FD5461]">Cup final</div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="flex min-w-0 items-center gap-2"><PrizeClubBadge club={homeClub} /><span className="truncate text-sm font-medium">{homeClub?.club_name || 'Home'}</span></div><div className="text-center"><ResultScore homeScore={finalMatch.homeScore} awayScore={finalMatch.awayScore} winner={String(finalMatch.winner) === String(finalMatch.home) ? 'home' : String(finalMatch.winner) === String(finalMatch.away) ? 'away' : null} />{finalMatch.decidedOnPenalties && <div className="mt-1 text-xs text-gray-500">{finalMatch.penalties?.home}–{finalMatch.penalties?.away} penalties</div>}</div><div className="flex min-w-0 items-center justify-end gap-2"><span className="truncate text-right text-sm font-medium">{awayClub?.club_name || 'Away'}</span><PrizeClubBadge club={awayClub} /></div></div>{championPayout && <div className="mt-3 border-t border-red-100 pt-3 text-center text-sm"><span className="text-gray-500">Winner · </span><span className="font-semibold">{championPayout.clubName}</span><span className="ml-2 font-semibold text-[#FD5461]">{formatPrize(championPayout.amount)}</span></div>}</div> : <div className="mb-3 rounded-2xl bg-gray-50 p-5 text-center text-sm text-gray-500">No completed cup final was recorded for this season.</div>}
        {cupRows.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{cupRows.map(row => <div key={`${row.position}-${row.clubId}`} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5"><RankBadge rank={row.position} /><PrizeClubBadge club={row.club} className="h-8 w-8" /><div className="min-w-0 flex-1 truncate text-sm font-medium">{row.clubName || row.club?.club_name}</div><span className="text-sm font-semibold text-[#FD5461]">{formatPrize(row.amount)}</span></div>)}</div>}
      </section>
    </div>
  )
}

function TopList({ title, icon, itemsMap, allPlayers, playerSnapshots, leaguePlayers = [], teams = [] }) {
  const mapEntries = Object.entries(itemsMap || {})
  const items = (
    mapEntries.length > 0
      ? mapEntries.map(([playerId, count]) => {
          const current = allPlayers.find(player => String(player.id) === String(playerId))
          const snapshot = playerSnapshots?.[playerId]
          const p = snapshot ? { ...current, ...snapshot, club: snapshot.club } : current
          return { player: p, count: Number(count) || 0 }
        }).filter(i => i.player)
      : (leaguePlayers || []).map(player => ({
          player: {
            ...player,
            club: teams.find(t => t.club_id === player.club_id)
          },
          count: 0
        }))
  )
    .sort((a, b) => b.count - a.count || (a.player?.name || '').localeCompare(b.player?.name || ''))

  const displayItems = items.slice(0, 15)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="font-heading font-black text-xs uppercase tracking-widest text-[#0A1318]">{title}</span>
        </div>
      </div>
      {displayItems.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs text-gray-300 font-heading font-bold uppercase tracking-widest">No data yet</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {displayItems.map((item, i) => {
            const ovr = item.player?.ovr_v2 ?? item.player?.ovr
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${PODIUM_STYLES[i]?.row || ''}`}>
                <RankBadge rank={i + 1} />
                {ovr && <OvrBadge value={ovr} size="sm" />}
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center ring-1 ring-black/5">
                  {item.player?.photo_url
                    ? <img src={item.player.photo_url} alt={item.player.name} className="w-full h-full object-cover" />
                    : <span className="text-xs font-heading font-black text-gray-400">{item.player?.name?.charAt(0)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-bold text-xs text-[#0A1318] truncate">{item.player?.name}</div>
                  <PlayerIdentity player={item.player} />
                </div>
                <span className={`font-heading font-black text-xl tabular-nums flex-shrink-0 ${PODIUM_STYLES[i]?.value || 'text-[#0A1318]'}`}>
                  {item.count}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StandingsTable({ standings, championId }) {
  if (!standings || !standings.length) return (
    <div className="text-center py-8 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">No matches yet</div>
  )
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="grid grid-cols-[auto_1fr_repeat(6,auto)] gap-x-3 border-b border-gray-100 px-5 py-3 text-xs font-medium text-gray-500">
        <div className="w-5 text-center">#</div>
        <div>Team</div>
        <div className="w-7 text-center">P</div>
        <div className="w-7 text-center">W</div>
        <div className="w-7 text-center">D</div>
        <div className="w-7 text-center">L</div>
        <div className="w-9 text-center">GD</div>
        <div className="w-9 text-center font-black text-[#0A1318]">PTS</div>
      </div>
      <div className="divide-y divide-gray-50">
        {standings.map((row, i) => {
          const isChamp = championId && row.club_id === championId
          const isTop4 = i < 4
          const isBottom2 = i >= standings.length - 2
          const s = row.stats || {}
          const gd = s.GD || 0
          return (
            <div key={row.club_id}
              className={`grid grid-cols-[auto_1fr_repeat(6,auto)] gap-x-3 px-5 py-3 items-center
                ${isChamp ? 'bg-[#FD5461]/[0.07]' : ''}`}>
              <div className={`w-5 text-center text-[10px] font-heading font-black
                ${i === 0 ? 'text-[#FD5461]' : isTop4 ? 'text-[#0A1318]' : isBottom2 ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {i + 1}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                {row.badge_url ? (
                  <img src={row.badge_url} alt="" className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-5 h-5 rounded bg-gray-200" />
                )}
                <span className="font-heading font-bold text-base text-[#0A1318] truncate">{row.club_name}</span>
                {isChamp && <Trophy size={14} className="shrink-0 text-[#FD5461]" strokeWidth={2.25} />}
              </div>
              <div className="w-7 text-center text-base font-heading font-bold text-gray-500 tabular-nums">{(s.W||0) + (s.D||0) + (s.L||0)}</div>
              <div className="w-7 text-center text-base font-heading font-bold text-gray-500 tabular-nums">{s.W||0}</div>
              <div className="w-7 text-center text-base font-heading font-bold text-gray-500 tabular-nums">{s.D||0}</div>
              <div className="w-7 text-center text-base font-heading font-bold text-gray-500 tabular-nums">{s.L||0}</div>
              <div className={`w-9 text-center text-base font-heading font-bold tabular-nums ${gd > 0 ? 'text-green-600' : gd < 0 ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {gd > 0 ? `+${gd}` : gd}
              </div>
              <div className="w-9 text-center text-base font-heading font-black text-[#0A1318] tabular-nums">{s.PTS||0}</div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#FD5461]" />
          <span className="text-[9px] font-heading font-bold text-gray-400">1st — Champion</span>
        </div>
      </div>
    </div>
  )
}

// --- MAIN COMPONENT ---

export default function DraftMatchesTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [newSeasonSetupOpen, setNewSeasonSetupOpen] = useState(false)
  const [rewardSummaryOpen, setRewardSummaryOpen] = useState(false)
  const [prizeSettingsOpen, setPrizeSettingsOpen] = useState(false)
  const [savingPrizes, setSavingPrizes] = useState(false)
  const [prizeDraft, setPrizeDraft] = useState(DEFAULT_LEAGUE_PRIZES)
  const [cupPrizeDraft, setCupPrizeDraft] = useState(DEFAULT_CUP_PRIZES)
  const [activeTab, setActiveTab] = useState('matches') // matches, standings, stats
  const [desktopStat, setDesktopStat] = useState('topScorers')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  
  const seasons = saveData.settings?.seasons || []
  
  // By default select the active season or the last one
  const [currentSeasonIdx, setCurrentSeasonIdx] = useState(() => {
    const activeIdx = seasons.findIndex(s => s.status === 'active')
    return activeIdx >= 0 ? activeIdx : Math.max(0, seasons.length - 1)
  })

  useEffect(() => {
    if (seasons.length > 0 && !seasons[currentSeasonIdx]) {
      setCurrentSeasonIdx(Math.max(0, seasons.length - 1))
    }
  }, [seasons, currentSeasonIdx])

  const seasonData = seasons[currentSeasonIdx]
  const isActiveSeason = seasonData?.status === 'active'
  const activeSeasonIdx = seasons.findIndex(season => season.status === 'active')
  const seasonCup = (saveData.settings?.cups || []).find(cup => String(cup.seasonId) === String(seasonData?.id))
    || (saveData.settings?.cups || []).find(cup => Number(cup.number) === Number(seasonData?.id))
    || (saveData.settings?.cups || [])[currentSeasonIdx]
    || (saveData.settings?.cups || []).find(cup => cup.status === 'active')
    || (saveData.settings?.cups || []).at(-1)

  function openPrizeSettings() {
    setPrizeDraft({
      placements: Array.isArray(seasonData?.prizeSettings?.placements)
        ? [...seasonData.prizeSettings.placements]
        : [...DEFAULT_LEAGUE_PRIZES.placements],
      awards: {
        ...DEFAULT_LEAGUE_PRIZES.awards,
        ...(seasonData?.prizeSettings?.awards || {}),
      },
      matchPrizes: {
        ...DEFAULT_LEAGUE_PRIZES.matchPrizes,
        ...(seasonData?.prizeSettings?.matchPrizes || {}),
      },
      cupMatchPrizes: {
        ...DEFAULT_CUP_MATCH_PRIZES,
        ...(seasonCup?.matchPrizes || seasonData?.cupMatchPrizes || {}),
      },
    })
    setCupPrizeDraft(Array.isArray(seasonCup?.prizeSettings) ? [...seasonCup.prizeSettings] : [...DEFAULT_CUP_PRIZES])
    setPrizeSettingsOpen(true)
  }

  async function savePrizeSettings() {
    if (!isActiveSeason) return
    setSavingPrizes(true)
    try {
      const updatedPrizeSettings = {
        placements: prizeDraft.placements,
        awards: prizeDraft.awards,
        matchPrizes: prizeDraft.matchPrizes,
      }
      let nextState = await updateDraftSeasonPrizeSettings(saveId, seasonData.id, updatedPrizeSettings)
      nextState = {
        ...nextState,
        settings: {
          ...nextState.settings,
          seasons: nextState.settings.seasons.map(season => String(season.id) === String(seasonData.id) ? { ...season, cupPrizeSettings: [...cupPrizeDraft], cupMatchPrizes: prizeDraft.cupMatchPrizes } : season),
          cups: (nextState.settings.cups || []).map(cup => String(cup.seasonId) === String(seasonData.id) ? { ...cup, matchPrizes: prizeDraft.cupMatchPrizes } : cup),
        },
      }
      await updateDraftState(saveId, nextState)
      if (seasonCup && seasonCup.status !== 'completed') {
        nextState = await updateDraftCupPrizeSettings(saveId, seasonCup.id, cupPrizeDraft)
      }
      setSaveData(nextState)
      setPrizeSettingsOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setSavingPrizes(false)
    }
  }

  const matchesConfig = useMemo(() => {
    const rawMatches = seasonData?.matches || []
    if (!rawMatches.length) return []
    // Ensure Week 11 Super Match is present for existing saves
    if (rawMatches.length === 10) {
      return [
        ...rawMatches,
        {
          week: 11,
          isSuperMatch: true,
          matches: [{
            home: 'place_1',
            away: '__allstars__',
            played: false,
            homeScore: 0,
            awayScore: 0,
            isAllStarMatch: true,
          }]
        }
      ]
    }
    return rawMatches
  }, [seasonData?.matches])
  const currentWeek = saveData.currentWeek || 1
  
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)

  // Keep selectedWeek in sync
  useEffect(() => {
    if (isActiveSeason) {
      setSelectedWeek(currentWeek)
    } else if (matchesConfig.length > 0) {
      setSelectedWeek(matchesConfig[matchesConfig.length - 1].week) // default to last week for past seasons
    }
  }, [currentWeek, isActiveSeason, matchesConfig])

  // Get all players for stats mapping
  const allPlayers = useMemo(() => {
    const players = [...(saveData.freeAgents || [])]
    saveData.teams?.forEach(t => {
      t.roster?.forEach(p => {
        players.push({
          ...p,
          club: { id: t.club_id, short_name: t.club_name }
        })
      })
    })
    return players
  }, [saveData])

  const weekData = matchesConfig.find(w => w.week === selectedWeek)

  async function handleGenerateSchedule(teamIds) {
    setProcessing(true)
    try {
      const schedule = generateSchedule(teamIds)
      
      const selectedIds = new Set(teamIds)
      const newTeams = saveData.teams.map(t => selectedIds.has(t.club_id) ? ({
        ...t,
        stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 }
      }) : t)

      const { updatedTeams, updatedFreeAgents, seasonAdjustments } = applySeasonalPlayerAdjustments(newTeams, saveData.freeAgents || [])

      const newSettings = { ...saveData.settings }
      newSettings.seasons = [{
        id: 1,
        teamIds,
        matches: schedule,
        stats: { topScorers: {}, topAssists: {}, mostMvps: {} },
        seasonAdjustments,
        prizeSettings: { placements: [...DEFAULT_LEAGUE_PRIZES.placements], awards: { ...DEFAULT_LEAGUE_PRIZES.awards } },
        status: 'active'
      }]

      const newSaveData = {
        ...saveData,
        teams: updatedTeams,
        freeAgents: updatedFreeAgents,
        settings: newSettings,
        currentWeek: 1
      }
      
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setSelectedWeek(1)
      setCurrentSeasonIdx(0)
      setSetupOpen(false)
    } catch (err) {
      console.error(err)
      alert('Failed to generate schedule')
    } finally {
      setProcessing(false)
    }
  }

  async function handleStartNewSeason(teamIds) {
    setProcessing(true)
    try {
      const schedule = generateSchedule(teamIds)
      
      // Reset team stats
      const teamMap = new Map(saveData.teams.map(team => [team.club_id, team]))
      const selectedIds = new Set(teamIds)
      const newTeams = [...teamMap.values()].map(t => selectedIds.has(t.club_id) ? ({
        ...t, stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 }
      }) : t)

      const newSettings = { ...saveData.settings }
      const newSeasonId = (newSettings.seasons.length > 0 ? Math.max(...newSettings.seasons.map(s => s.id)) : 0) + 1
      const previousSeason = newSettings.seasons[newSettings.seasons.length - 1]
      const inheritedLeaguePrizes = {
        placements: [...(previousSeason?.prizeSettings?.placements || DEFAULT_LEAGUE_PRIZES.placements)],
        awards: { ...DEFAULT_LEAGUE_PRIZES.awards, ...(previousSeason?.prizeSettings?.awards || {}) },
      }
      const previousCup = [...(newSettings.cups || [])].reverse().find(cup => cup.prizeSettings)
      const inheritedCupPrizes = [...(previousSeason?.cupPrizeSettings || previousCup?.prizeSettings || DEFAULT_CUP_PRIZES)]
      
      const { updatedTeams, updatedFreeAgents, seasonAdjustments } = applySeasonalPlayerAdjustments(newTeams, saveData.freeAgents || [])

      newSettings.seasons.push({
        id: newSeasonId,
        teamIds,
        matches: schedule,
        stats: { topScorers: {}, topAssists: {}, mostMvps: {} },
        seasonAdjustments,
        prizeSettings: inheritedLeaguePrizes,
        cupPrizeSettings: inheritedCupPrizes,
        status: 'active'
      })

      const newSaveData = {
        ...saveData,
        teams: updatedTeams,
        freeAgents: updatedFreeAgents,
        settings: newSettings,
        currentWeek: 1
      }
      
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setCurrentSeasonIdx(newSettings.seasons.length - 1)
      setSelectedWeek(1)
      setNewSeasonSetupOpen(false)
    } catch (err) {
      console.error(err)
      alert('Failed to start new season')
    } finally {
      setProcessing(false)
    }
  }

  function getResolvedTeam(teamId, standings) {
    if (teamId === 'place_1' || teamId === '1st') {
      const topClubId = standings?.[0]?.club_id
      const topTeam = saveData.teams.find(t => t.club_id === topClubId)
      if (topTeam) return topTeam
    }
    if (teamId === '__allstars__' || teamId === 'allstars') {
      // Include ALL players from teams ranked 2nd to 5th
      const otherTeams = (standings || []).slice(1, 5).map(row => saveData.teams.find(t => t.club_id === row.club_id)).filter(Boolean)
      const pool = otherTeams.flatMap(t => (t.roster || []).map(p => ({
        ...p,
        club: p.club || {
          id: t.club_id,
          name: t.club_name,
          club_name: t.club_name,
          short_name: t.short_name || t.club_name?.slice(0, 3).toUpperCase(),
          badge_url: t.badge_url || null,
          badge_color: t.badge_color || null,
        }
      })))
      
      // Default Starting 5: Top 4 outfield players + Top 1 Goalkeeper
      const goalkeepers = pool.filter(p => p.position === 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0))
      const outfields = pool.filter(p => p.position !== 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0))

      const topGk = goalkeepers[0] || pool.sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0]
      const topOutfield = outfields.slice(0, 4)
      const starting5 = [...topOutfield, topGk].filter(Boolean)
      
      const starting5Ids = new Set(starting5.map(p => p.id))
      const substitutes = pool.filter(p => !starting5Ids.has(p.id)).sort((a, b) => (b.ovr || 0) - (a.ovr || 0))
      
      // Complete roster: Starting 5 first, followed by all other players as bench
      const fullRoster = [...starting5, ...substitutes]

      return {
        club_id: '__allstars__',
        club_name: 'League All-Stars',
        short_name: 'ALL',
        badge_color: '#FD5461',
        badge_url: saveData.settings?.allStarBadgeUrl || null,
        is_allstars: true,
        roster: fullRoster,
      }
    }
    return saveData.teams.find(t => t.club_id === teamId)
  }

  function handlePlayMatch(matchIndex, week = selectedWeek) {
    const targetWeek = matchesConfig.find(item => item.week === week)
    if (!targetWeek || !isActiveSeason || week !== currentWeek) return
    const match = targetWeek.matches[matchIndex]
    const homeTeam = getResolvedTeam(match.home, activeStandings)
    const awayTeam = getResolvedTeam(match.away, activeStandings)

    navigate('/matches/draft/prematch', {
      state: {
        homeClub: { id: homeTeam.club_id, name: homeTeam.club_name, short_name: homeTeam.short_name || homeTeam.club_name?.slice(0, 3).toUpperCase(), badge_url: homeTeam.badge_url, badge_color: homeTeam.badge_color, roster: homeTeam.roster },
        awayClub: { id: awayTeam.club_id, name: awayTeam.club_name, short_name: awayTeam.short_name || awayTeam.club_name?.slice(0, 3).toUpperCase(), badge_url: awayTeam.badge_url, badge_color: awayTeam.badge_color, roster: awayTeam.roster },
        duration: 5,
        returnPath: `/draft/${saveId}/matches`,
        saveId,
        currentWeek: week,
        matchIndex
      }
    })
  }

  const leagueTeams = (saveData.teams || []).map(team => ({
    id: team.club_id,
    name: team.club_name,
    short_name: team.short_name || team.club_name?.slice(0, 3).toUpperCase(),
    badge_url: team.badge_url,
    badge_color: team.badge_color,
  }))
  const leaguePlayers = (saveData.teams || []).flatMap(team =>
    (team.roster || []).map(player => ({ ...player, club_id: team.club_id }))
  )

  if (!seasonData || matchesConfig.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Trophy size={32} className="mx-auto text-[#FD5461]" />
          <h2 className="mt-4 font-heading text-2xl font-black uppercase text-[#0A1318]">Create Your League</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">Select 5 clubs. The bottom club is relegated when the season ends.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={openPrizeSettings} className="flex items-center gap-2 rounded-xl text-sm font-semibold">
              <Settings2 size={16} /> Set prizes
            </Button>
            <Button onClick={() => setSetupOpen(true)} disabled={processing}>
              Select 5 clubs
            </Button>
          </div>
        </div>
        <LeagueSetupModal
          open={setupOpen}
          onClose={() => setSetupOpen(false)}
          onCreate={handleGenerateSchedule}
          teams={leagueTeams}
          players={leaguePlayers}
          requiredTeams={5}
        />
        <Modal open={prizeSettingsOpen} onClose={() => setPrizeSettingsOpen(false)} title={`Season 1 prizes`} width="max-w-2xl">
          <PrizeSettingsForm
            prizes={prizeDraft}
            setPrizes={setPrizeDraft}
            cupPrizes={cupPrizeDraft}
            setCupPrizes={setCupPrizeDraft}
            cup={null}
            locked={false}
            payouts={[]}
            onSave={savePrizeSettings}
            saving={savingPrizes}
          />
        </Modal>
      </>
    )
  }

  const existingWeeks = matchesConfig.map(w => w.week)

  // Current Standings Calculation
  const seasonTeamIds = new Set(seasonData.teamIds || saveData.teams.map(t => t.club_id))
  const activeStandings = isActiveSeason ? (saveData.teams || []).filter(t => seasonTeamIds.has(t.club_id)).map(t => ({
    club_id: t.club_id,
    club_name: t.club_name,
    badge_url: t.badge_url,
    badge_color: t.badge_color,
    short_name: t.short_name,
    stats: { ...t.stats }
  })).sort((a, b) => {
    if ((a.stats?.PTS||0) !== (b.stats?.PTS||0)) return (b.stats?.PTS||0) - (a.stats?.PTS||0)
    if ((a.stats?.GD||0) !== (b.stats?.GD||0)) return (b.stats?.GD||0) - (a.stats?.GD||0)
    return (b.stats?.GF||0) - (a.stats?.GF||0)
  }) : (seasonData?.standings || [])

  const championObj = seasonData.champion ? activeStandings.find(s => s.club_id === seasonData.champion) : null
  const desktopStatOptions = [
    { key: 'topScorers', label: 'Goals' }, { key: 'topAssists', label: 'Assists' },
    { key: 'mostMvps', label: 'MVP' }, { key: 'mostFouls', label: 'Fouls' },
  ]
  const desktopStatMap = seasonData.stats?.[desktopStat] || {}
  const desktopLeaders = (
    Object.keys(desktopStatMap).length > 0
      ? Object.entries(desktopStatMap)
          .map(([id, value]) => {
            const current = allPlayers.find(player => String(player.id) === String(id))
            const snapshot = seasonData.stats?.playerSnapshots?.[id]
            return { player: snapshot ? { ...current, ...snapshot, club: snapshot.club } : current, value }
          })
          .filter(item => item.player)
      : leaguePlayers.map(player => ({
          player: {
            ...player,
            club: saveData.teams.find(t => t.club_id === player.club_id)
          },
          value: 0
        }))
  )
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      // Tie-breaker: sort by team position in activeStandings (higher placed team first)
      const aClubId = String(a.player?.club?.id || a.player?.club_id || '')
      const bClubId = String(b.player?.club?.id || b.player?.club_id || '')
      const aRank = activeStandings.findIndex(s => String(s.club_id) === aClubId)
      const bRank = activeStandings.findIndex(s => String(s.club_id) === bClubId)
      const aPos = aRank >= 0 ? aRank : 999
      const bPos = bRank >= 0 ? bRank : 999
      if (aPos !== bPos) return aPos - bPos
      return (a.player?.name || '').localeCompare(b.player?.name || '')
    })
    .slice(0, 25)
  const priorRanks = previousPlayerRanks(seasonData, desktopStat)

  const canGoPrev = currentSeasonIdx > 0
  const canGoNext = currentSeasonIdx < seasons.length - 1

  return (
    <div className="space-y-6">
      {/* Season Header */}
      <div className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 mb-5 sm:gap-4 ${isActiveSeason ? 'border-gray-100 bg-gray-50' : 'border-[#FD5461]/20 bg-[#FD5461]/[0.06]'}`}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[#0A1318] sm:text-base">
          <span className="truncate">Season {seasonData.id}</span>
          {isActiveSeason && <><span className="text-gray-300">·</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FD5461]" />Active</span><span className="text-gray-300">·</span><span>Week {currentWeek} of {matchesConfig.length}</span></>}
          {!isActiveSeason && championObj && <>
            <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />
            <span className="inline-flex min-w-0 items-center gap-2">
              {championObj.badge_url
                ? <img src={championObj.badge_url} alt="" className="h-7 w-7 shrink-0 object-contain" />
                : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[8px] font-semibold text-white" style={{ backgroundColor: championObj.badge_color || '#0A1318' }}>{(championObj.short_name || championObj.club_name).slice(0, 3).toUpperCase()}</span>}
              <span className="truncate font-semibold">{championObj.club_name}</span>
              <span className="rounded-full bg-[#FD5461]/10 px-2.5 py-1 text-xs font-semibold text-[#FD5461]">Winner</span>
            </span>
          </>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={openPrizeSettings} className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label={isActiveSeason ? 'Season prize settings' : 'View locked season prizes'}>
            {isActiveSeason ? <Settings2 size={16} strokeWidth={2.25} /> : <Eye size={16} strokeWidth={2} />}
            <span className="hidden sm:inline">{isActiveSeason ? 'Prizes' : 'View prizes'}</span>
          </button>
          {!isActiveSeason && activeSeasonIdx >= 0 && <button
            type="button"
            onClick={() => setCurrentSeasonIdx(activeSeasonIdx)}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-[#FD5461] px-3.5 text-sm font-semibold text-white shadow-sm shadow-red-500/20 transition-[background-color,transform,box-shadow] hover:bg-red-500 hover:shadow-md hover:shadow-red-500/25 active:scale-[0.98]"
            aria-label="Return to current season"
          >
            <CalendarClock size={16} strokeWidth={2} />
            <span className="hidden sm:inline">Current</span>
          </button>}
          {seasons.length > 1 && (
            <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
              <button onClick={() => canGoPrev && setCurrentSeasonIdx(i => i - 1)} disabled={!canGoPrev}
                aria-label="Previous season"
                className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
              <button onClick={() => canGoNext && setCurrentSeasonIdx(i => i + 1)} disabled={!canGoNext}
                aria-label="Next season"
                className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          {!isActiveSeason && currentSeasonIdx === seasons.length - 1 && (
            <button onClick={() => setRewardSummaryOpen(true)} disabled={processing}
              className="flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl bg-[#FD5461] px-4 text-sm font-semibold text-white shadow-sm shadow-red-500/20 transition-[background-color,box-shadow,transform] hover:bg-red-500 hover:shadow-md hover:shadow-red-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:px-5">
              + New Season
            </button>
          )}
        </div>
      </div>

      {/* Desktop: full league overview in one screen */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(470px,1fr)]">
        <section className="space-y-5">
          {matchesConfig.map(week => (
            <div key={week.week}>
              <div className="mb-2"><span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium ${week.week === currentWeek && isActiveSeason
                ? 'bg-[#FD5461] text-white'
                : (isActiveSeason ? week.week < currentWeek : week.matches.every(match => match.played))
                  ? 'bg-[#FD5461]/10 text-[#FD5461] ring-1 ring-inset ring-[#FD5461]/20'
                  : 'bg-gray-100 text-gray-500'
              }`}>Week {week.week}</span></div>
              <div className="space-y-2">
                {week.matches.map((match, index) => {
                  const home = getResolvedTeam(match.home, activeStandings)
                  const away = getResolvedTeam(match.away, activeStandings)
                  return (
                    <article key={index} className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-[opacity,background-color] duration-200 ${isActiveSeason && week.week > currentWeek ? 'bg-gray-50 opacity-55' : ''}`}>
                      <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {home?.is_allstars || home?.id === '__allstars__' ? (
                            <div className="w-9 h-9 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 p-0.5 flex items-center justify-center">
                              <AllStarIcon size={32} badgeUrl={home?.badge_url} />
                            </div>
                          ) : home?.badge_url ? (
                            <div className="w-9 h-9 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 p-0.5">
                              <img src={home.badge_url} alt="" className="h-full w-full object-contain" />
                            </div>
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading text-[9px] font-black text-white" style={{ backgroundColor: home?.badge_color || '#FD5461' }}>{(home?.short_name || home?.club_name)?.slice(0, 3).toUpperCase()}</span>
                          )}
                          <span className="truncate font-heading text-sm font-black uppercase">{home?.club_name || (match.home === 'place_1' ? '1st Place Team' : 'Home')}</span>
                        </div>
                        <div className="flex items-center justify-center text-center">
                          {match.played ? (
                            <ResultScore homeScore={match.homeScore} awayScore={match.awayScore} compact />
                          ) : isActiveSeason && week.week === currentWeek ? (
                            <Button size="md" variant="secondary" onClick={() => handlePlayMatch(index, week.week)} disabled={processing} className="sm:min-w-32 whitespace-nowrap">
                              <Play size={15} fill="currentColor" />
                              Play<span className="hidden sm:inline"> match</span>
                            </Button>
                          ) : (
                            <span className="type-title-sm text-[#0A1318]">VS</span>
                          )}
                        </div>
                        <div className="flex min-w-0 items-center justify-end gap-3">
                          <span className="truncate text-right font-heading text-sm font-black uppercase">{away?.club_name || (match.away === '__allstars__' ? 'League All-Stars' : 'Away')}</span>
                          {away?.is_allstars || away?.id === '__allstars__' ? (
                            <div className="w-9 h-9 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 p-0.5 flex items-center justify-center">
                              <AllStarIcon size={32} badgeUrl={away?.badge_url} />
                            </div>
                          ) : away?.badge_url ? (
                            <div className="w-9 h-9 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 p-0.5">
                              <img src={away.badge_url} alt="" className="h-full w-full object-contain" />
                            </div>
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading text-[9px] font-black text-white" style={{ backgroundColor: away?.badge_color || '#FD5461' }}>{(away?.short_name || away?.club_name)?.slice(0, 3).toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        <aside className="space-y-6">
          <LeagueStandingsTable standings={activeStandings} championId={seasonData.champion} onTeamClick={row => navigate(`/draft/${saveId}/squads?team=${row.club_id}`)} />
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
            <div className="border-b border-gray-100 p-4">
              <h2 className="font-heading text-lg font-black uppercase text-[#0A1318]">Player Stats</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {desktopStatOptions.map(option => (
                  <button
                    key={option.key}
                    onClick={() => setDesktopStat(option.key)}
                    className={`h-9 cursor-pointer rounded-full px-4 text-xs font-heading font-black uppercase tracking-wider transition-colors ${
                      desktopStat === option.key ? 'bg-[#FD5461] text-white shadow-xs' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-[#0A1318]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-50 bg-white">
              {desktopLeaders.map(({ player, value }, index) => {
                const ovr = player?.ovr_v2 ?? player?.ovr
                return (
                  <button key={player?.id || index} onClick={() => setSelectedPlayer(player)} className={`w-full cursor-pointer flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${PODIUM_STYLES[index]?.row || ''}`}>
                    <RankBadge rank={index + 1} />
                    {ovr && <OvrBadge value={ovr} size="sm" />}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-black text-gray-400 ring-1 ring-black/5">
                      {player?.photo_url ? (
                        <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-heading font-black">{player?.name?.charAt(0) || '?'}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-xs font-bold text-[#0A1318]">{player?.name || 'Unknown'}</span>
                      <PlayerIdentity player={player} />
                    </span>
                    <RankTrend change={priorRanks.has(String(player?.id)) ? priorRanks.get(String(player?.id)) - (index + 1) : 0} />
                    <span className={`font-heading text-xl font-black tabular-nums ${PODIUM_STYLES[index]?.value || 'text-[#0A1318]'}`}>{value}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </aside>
      </div>

      {/* Tabs */}
      <div className="lg:hidden mb-6">
        <SegmentedControl
          ariaLabel="League views"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'matches', label: 'Matches' },
            { id: 'standings', label: 'Standings' },
            { id: 'stats', label: 'Stats' }
          ]}
          className="w-full"
        />
      </div>

      {/* Tab Content */}
      <div key={activeTab} className="lg:hidden ui-tab-content-enter">
      {activeTab === 'standings' && (
        <LeagueStandingsTable standings={activeStandings} championId={seasonData.champion} onTeamClick={row => navigate(`/draft/${saveId}/squads?team=${row.club_id}`)} />
      )}

      {activeTab === 'stats' && (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
          <div className="border-b border-gray-100 p-4">
            <h2 className="font-heading text-lg font-black uppercase text-[#0A1318]">Player Stats</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {desktopStatOptions.map(option => (
                <button
                  key={option.key}
                  onClick={() => setDesktopStat(option.key)}
                  className={`h-9 cursor-pointer rounded-full px-4 text-xs font-heading font-black uppercase tracking-wider transition-colors ${
                    desktopStat === option.key ? 'bg-[#FD5461] text-white shadow-xs' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-[#0A1318]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-50 bg-white">
            {desktopLeaders.map(({ player, value }, index) => {
              const ovr = player?.ovr_v2 ?? player?.ovr
              return (
                <button key={player?.id || index} onClick={() => setSelectedPlayer(player)} className={`w-full cursor-pointer flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${PODIUM_STYLES[index]?.row || ''}`}>
                  <RankBadge rank={index + 1} />
                  {ovr && <OvrBadge value={ovr} size="sm" />}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-black text-gray-400 ring-1 ring-black/5">
                    {player?.photo_url ? (
                      <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-heading font-black">{player?.name?.charAt(0) || '?'}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading text-xs font-bold text-[#0A1318]">{player?.name || 'Unknown'}</span>
                    <PlayerIdentity player={player} />
                  </span>
                  <RankTrend change={priorRanks.has(String(player?.id)) ? priorRanks.get(String(player?.id)) - (index + 1) : 0} />
                  <span className={`font-heading text-xl font-black tabular-nums ${PODIUM_STYLES[index]?.value || 'text-[#0A1318]'}`}>{value}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {activeTab === 'matches' && (
        <>
          {existingWeeks.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide flex-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                {existingWeeks.map(w => {
                  const weekMatches = matchesConfig.find(cw => cw.week === w)?.matches || []
                  const done = weekMatches.every(m => m.played)
                  const isCurrent = w === currentWeek && isActiveSeason
                  return (
                    <button key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full font-heading font-black text-xs uppercase tracking-widest transition-all cursor-pointer border
                        ${selectedWeek === w
                          ? 'bg-[#FD5461] text-white border-[#FD5461] shadow-xs'
                          : done
                            ? 'bg-[#FD5461]/10 text-[#FD5461] border-[#FD5461]/20 hover:bg-[#FD5461]/20'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700'
                        }`}>
                      Wk {w}
                      {done && <span className="ml-1 opacity-70">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {weekData?.matches.map((match, idx) => {
              const homeTeam = getResolvedTeam(match.home, activeStandings)
              const awayTeam = getResolvedTeam(match.away, activeStandings)
              
              return (
                <div key={idx} className={`rounded-2xl border border-gray-100 bg-white overflow-hidden transition-[opacity,box-shadow,background-color] duration-150 shadow-sm ${isActiveSeason && selectedWeek > currentWeek ? 'bg-gray-50 opacity-55' : 'hover:shadow-md'}`}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Home */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {homeTeam?.is_allstars || homeTeam?.id === '__allstars__' ? (
                        <div className="w-9 h-9 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 p-0.5 flex items-center justify-center">
                          <AllStarIcon size={32} badgeUrl={homeTeam?.badge_url} />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-black/5 shadow-sm flex items-center justify-center" style={{ backgroundColor: homeTeam?.badge_url ? 'white' : (homeTeam?.badge_color || '#FD5461') }}>
                          {homeTeam?.badge_url ? (
                            <img src={homeTeam.badge_url} alt="" className="w-full h-full object-contain p-1" />
                          ) : (
                            <span className="font-heading font-black text-white text-xs">{(homeTeam?.short_name || homeTeam?.club_name || '1ST').slice(0, 3).toUpperCase()}</span>
                          )}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{homeTeam?.club_name || (match.home === 'place_1' ? '1st Place Team' : 'Home')}</span>
                        <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{(homeTeam?.short_name || homeTeam?.club_name || '1ST').slice(0,3)}</span>
                      </div>
                    </div>

                    {/* Center */}
                    <div className="flex w-28 flex-shrink-0 flex-col items-center gap-1 sm:w-36">
                      {match.played ? (
                        <ResultScore homeScore={match.homeScore} awayScore={match.awayScore} />
                      ) : isActiveSeason && selectedWeek === currentWeek ? (
                        <Button size="md" variant="secondary" onClick={() => handlePlayMatch(idx)} disabled={processing} className="sm:min-w-28 whitespace-nowrap">
                          <Play size={15} fill="currentColor" /> Play<span className="hidden sm:inline"> match</span>
                        </Button>
                      ) : (
                        <span className="type-title-sm text-[#0A1318]">VS</span>
                      )}
                    </div>

                    {/* Away */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{awayTeam?.club_name || (match.away === '__allstars__' ? 'League All-Stars' : 'Away')}</span>
                        <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{(awayTeam?.short_name || awayTeam?.club_name || 'ALL').slice(0,3)}</span>
                      </div>
                      {awayTeam?.is_allstars || awayTeam?.id === '__allstars__' ? (
                        <div className="w-9 h-9 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 p-0.5 flex items-center justify-center">
                          <AllStarIcon size={32} badgeUrl={awayTeam?.badge_url} />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-black/5 shadow-sm flex items-center justify-center" style={{ backgroundColor: awayTeam?.badge_url ? 'white' : (awayTeam?.badge_color || '#FD5461') }}>
                          {awayTeam?.badge_url ? (
                            <img src={awayTeam.badge_url} alt="" className="w-full h-full object-contain p-1" />
                          ) : (
                            <span className="font-heading font-black text-white text-xs">{(awayTeam?.short_name || awayTeam?.club_name || 'ALL').slice(0, 3).toUpperCase()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        </>
      )}
      </div>
      <LeagueSetupModal
        open={newSeasonSetupOpen}
        onClose={() => setNewSeasonSetupOpen(false)}
        onCreate={handleStartNewSeason}
        initialSelectedIds={(seasonData?.standings || []).slice(0, 4).map(row => row.club_id)}
        teams={leagueTeams.filter(team => team.id !== (seasonData?.standings || []).at(-1)?.club_id)}
        players={leaguePlayers}
        requiredTeams={5}
      />
      <Modal open={prizeSettingsOpen} onClose={() => setPrizeSettingsOpen(false)} title={`Season ${seasonData?.id || ''} prizes`} width="max-w-2xl">
        {isActiveSeason ? <PrizeSettingsForm
          prizes={prizeDraft}
          setPrizes={setPrizeDraft}
          cupPrizes={cupPrizeDraft}
          setCupPrizes={setCupPrizeDraft}
          cup={seasonCup}
          locked={!isActiveSeason}
          payouts={seasonData?.prizePayouts}
          onSave={savePrizeSettings}
          saving={savingPrizes}
        /> : <SeasonPrizeResults season={seasonData} cup={seasonCup} allPlayers={allPlayers} teams={saveData.teams || []} />}
      </Modal>
      <Modal open={rewardSummaryOpen} onClose={() => setRewardSummaryOpen(false)} title={`Season ${seasonData?.id || ''} reward summary`} width="max-w-2xl">
        <SeasonRewardSummary season={seasonData} cup={seasonCup} allPlayers={allPlayers} teams={saveData.teams || []} onContinue={() => { setRewardSummaryOpen(false); setNewSeasonSetupOpen(true) }} />
      </Modal>

      <PlayerProfileModal open={Boolean(selectedPlayer)} player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  )
}
