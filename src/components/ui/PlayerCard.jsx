import { STATS_BY_POSITION, POSITION_LABELS, normalizeStats } from '../../utils/stats'
import { formatCurrency } from '../../utils/currency'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import StatBar from './StatBar'
import Button from './Button'
import FreeAgentIcon from './FreeAgentIcon'
import OvrBadge from './OvrBadge'

const POS_COLORS = {
  GK:  '#f59e0b',
  DEF: '#3b82f6',
  MF:  '#22c55e',
  FWD: '#FD5461',
}

function getFlagCode(nationality) {
  return FIFA_NATIONS.find(n => n.name === nationality)?.code ?? null
}

function PlayerAvatar({ photoUrl, name, size = 'md' }) {
  const s = size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'
  if (photoUrl) {
    return (
      <div className={`${s} rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200`}>
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${s} rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 ring-1 ring-gray-200`}>
      <span className="font-medium text-gray-400 text-sm">{name?.charAt(0)?.toUpperCase()}</span>
    </div>
  )
}

function ClubBadge({ club }) {
  if (!club) return null
  
  if (club.is_national) {
    const code = FIFA_NATIONS.find(n => n.name === club.name)?.code || club.short_name?.toLowerCase()
    return (
      <div className="w-8 h-5.5 rounded overflow-hidden bg-gray-100 ring-1 ring-black/5 shadow-sm">
        <img src={`https://flagcdn.com/${code}.svg`} alt={club.name} className="w-full h-full object-cover" />
      </div>
    )
  }

  if (club.badge_url) {
    return (
      <div className="w-6 h-6 rounded flex-shrink-0 overflow-hidden bg-white ring-1 ring-gray-100">
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain" />
      </div>
    )
  }
  return (
    <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-[8px] font-bold shadow-sm"
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>
      {club.short_name?.slice(0, 1)}
    </div>
  )
}

export default function PlayerCard({ player, onClick, onEdit, onDelete, onSign, deleteLabel = 'Del', compact = false }) {
  const posColor = POS_COLORS[player.position] ?? '#6b7280'
  const statKeys = STATS_BY_POSITION[player.position]
  const normalizedStats = normalizeStats(player.stats)
  const flagCode = getFlagCode(player.nationality)

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <PlayerAvatar photoUrl={player.photo_url} name={player.name} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{player.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {flagCode && (
                <img src={`https://flagcdn.com/${flagCode}.svg`} alt={player.nationality}
                  className="h-3 w-[18px] flex-shrink-0 rounded-sm object-cover shadow-sm ring-1 ring-black/10" />
              )}
              {player.club && <ClubBadge club={player.club} />}
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <OvrBadge value={player.ovr} size="sm" />
            <span className="text-[9px] font-semibold tracking-wider uppercase" style={{ color: posColor }}>
              {player.position === 'GK' ? 'GK' : player.position === 'DEF' ? 'DF' : player.position === 'MF' ? 'MF' : 'FW'}
            </span>
          </div>
        </div>
      </button>
    )
  }

  return (
    <article
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick(event)
      } : undefined}
      className="relative h-full w-full text-left bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 shadow-sm"
    >
      <div className="flex h-full flex-col p-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <PlayerAvatar photoUrl={player.photo_url} name={player.name} size="lg" />

          <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
            {/* name + flag + club */}
            <div className="min-w-0 pt-0.5">
              <div className="text-base font-semibold text-gray-900 leading-tight truncate">{player.name}</div>
              <div className="flex items-center gap-1.5 mt-3">
                {flagCode && (
                  <img src={`https://flagcdn.com/${flagCode}.svg`} alt={player.nationality}
                    className="h-4 w-6 flex-shrink-0 rounded-sm object-cover shadow-sm ring-1 ring-black/10" />
                )}
                {player.club
                  ? <ClubBadge club={player.club} />
                  : <FreeAgentIcon size={24} />
                }
                <span className="text-xs text-gray-400">{player.age} yrs</span>
              </div>
            </div>
            {/* OVR + position */}
            <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
              <OvrBadge value={player.ovr} size="md" />
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: posColor }}>
                {player.position === 'GK' ? 'GK' : player.position === 'DEF' ? 'DF' : player.position === 'MF' ? 'MF' : 'FW'}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 my-4" />

        {/* Stats */}
        <div className="space-y-2">
          {statKeys.map((key) => (
            <StatBar key={key} label={key} value={normalizedStats[key]} dense />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {onEdit && <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>}
            {onDelete && <Button variant="ghost" size="sm" onClick={onDelete}>{deleteLabel}</Button>}
            {onSign && <Button size="sm" onClick={onSign}>Sign</Button>}
          </div>
          <span className="text-sm font-semibold text-gray-700">${formatCurrency(player.market_value)}</span>
        </div>
      </div>
    </article>
  )
}
