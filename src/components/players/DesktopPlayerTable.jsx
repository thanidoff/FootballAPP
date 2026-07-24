import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import { STAT_LABELS, normalizeStats } from '../../utils/stats'
import { formatCurrency } from '../../utils/currency'
import Button from '../ui/Button'
import FreeAgentIcon from '../ui/FreeAgentIcon'
import OvrBadge from '../ui/OvrBadge'
import PositionBadge from '../ui/PositionBadge'

const GRID_COLUMNS = '64px minmax(200px,1.6fr) repeat(6,minmax(46px,.5fr)) 90px 184px'

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown size={14} strokeWidth={1.8} />
  return direction === 'desc'
    ? <ArrowDown size={14} strokeWidth={2.25} />
    : <ArrowUp size={14} strokeWidth={2.25} />
}

function ClubBadge({ club }) {
  if (!club) return <FreeAgentIcon size={17} />
  if (club.badge_url) return <img src={club.badge_url} alt="" className="h-5 w-5 shrink-0 object-contain" />
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[7px] font-semibold text-white" style={{ backgroundColor: club.badge_color || '#64748b' }}>{(club.short_name || club.name || 'C').slice(0, 1)}</span>
}

export default function DesktopPlayerTable({ players, statColumns, sortKey, sortDirection, onSort, onProfile, onEdit, onDelete, onSign, signDisabled }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white lg:block">
      <div className="grid items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500" style={{ gridTemplateColumns: GRID_COLUMNS }}>
        <button type="button" onClick={() => onSort('OVR')} className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1 transition-colors hover:text-[#0A1318] ${sortKey === 'OVR' ? 'text-[#FD5461]' : ''}`}>
          OVR <SortIcon active={sortKey === 'OVR'} direction={sortDirection} />
        </button>
        <span>Player</span>
        {statColumns.map(stat => (
          <button key={stat} type="button" onClick={() => onSort(stat)} title={`Sort by ${STAT_LABELS[stat]}`} className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1 transition-colors hover:text-[#0A1318] ${sortKey === stat ? 'text-[#FD5461]' : ''}`}>
            {stat} <SortIcon active={sortKey === stat} direction={sortDirection} />
          </button>
        ))}
        <span className="text-right">Value</span>
        <span className="text-right">Actions</span>
      </div>

      <div className="divide-y divide-gray-100">
        {players.map(player => {
          const flagCode = FIFA_NATIONS.find(nation => nation.name === player.nationality)?.code
          const normalizedStats = normalizeStats(player.stats)
          return (
            <div
              key={player.id}
              role="button"
              tabIndex={0}
              onClick={() => onProfile(player)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onProfile(player) }}
              className="grid min-h-[76px] cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FD5461]/30"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              <span className="flex justify-center"><OvrBadge value={player.ovr} size="sm" /></span>
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-medium text-gray-400 ring-1 ring-gray-200">
                  {player.photo_url ? <img src={player.photo_url} alt="" className="h-full w-full object-cover" /> : player.name?.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#0A1318]">{player.name}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <ClubBadge club={player.club} />
                    {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} alt={player.nationality} className="h-3.5 w-6 rounded-[2px] object-cover ring-1 ring-black/10" />}
                    <span className="text-xs text-gray-400">{player.age} yrs</span>
                    <PositionBadge position={player.position} />
                  </span>
                </span>
              </span>
              {statColumns.map(stat => {
                const value = normalizedStats[stat]
                return <span key={stat} className="text-center text-sm font-medium tabular-nums text-gray-600">{value}</span>
              })}
              <span className="text-right text-sm font-medium tabular-nums text-gray-600">${formatCurrency(player.market_value)}</span>
              <span className="flex items-center justify-end gap-1" onClick={event => event.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(player)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(player.id)}>Del</Button>
                <Button size="sm" className="w-[72px] justify-center" onClick={() => onSign(player)} disabled={signDisabled}>{player.club_id ? 'Transfer' : 'Sign'}</Button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
