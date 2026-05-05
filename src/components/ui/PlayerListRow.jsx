import { FIFA_NATIONS } from '../../utils/fifaNations'
import { formatCurrency } from '../../utils/currency'
import { getOVRTier } from '../../utils/stats'
import FreeAgentIcon from './FreeAgentIcon'
import PositionBadge from './PositionBadge'

const TIER_STYLES = {
  special: { bg: 'bg-[#FD5461]', text: 'text-white' },
  gold:    { bg: 'bg-[#0A1318]', text: 'text-white' },
  silver:  { bg: 'bg-gray-600',  text: 'text-white' },
  bronze:  { bg: 'bg-gray-400',  text: 'text-white' },
}

export default function PlayerListRow({
  player,
  isCaptain,
  isNational,
  onPointerDown,
  isDragging,
  isOver,
  canDrop,
  actions,
}) {
  const flagCode = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
  const club = player.club
  const tier = getOVRTier(player.ovr)
  const ovrStyle = TIER_STYLES[tier]

  const flagImg = flagCode && (
    <img
      src={`https://flagcdn.com/${flagCode}.svg`}
      className="h-3.5 w-6 object-cover rounded-[2px] flex-shrink-0 ring-1 ring-black/10"
      alt=""
    />
  )

  const clubBadge = club ? (
    club.badge_url
      ? <img src={club.badge_url} alt={club.short_name} className="w-5 h-5 object-contain flex-shrink-0" />
      : <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-white text-[7px] font-black" style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>{club.short_name?.slice(0, 1)}</div>
  ) : <FreeAgentIcon size={16} />

  return (
    <div
      className={`bg-white border rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 transition-all
        ${isDragging ? 'opacity-25 scale-[0.98]' : ''}
        ${isOver && canDrop ? 'border-gray-400 ring-2 ring-gray-200' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}
        ${isOver && !canDrop ? 'border-red-300 ring-2 ring-red-100' : ''}`}
    >
      {/* Drag Handle */}
      {onPointerDown && (
        <div 
          onPointerDown={onPointerDown}
          className="flex-shrink-0 text-gray-300 cursor-grab active:cursor-grabbing p-1 -ml-1 hover:text-gray-400 transition-colors touch-none"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="15" x2="20" y2="15" />
          </svg>
        </div>
      )}
      {/* Position */}
      <div className="hidden xs:block">
        <PositionBadge position={player.position} />
      </div>

      {/* OVR box */}
      <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${ovrStyle.bg} ${ovrStyle.text}`}>
        <span className="text-xs sm:text-base font-bold leading-none tabular-nums">{player.ovr}</span>
      </div>

      {/* Photo */}
      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
        {player.photo_url
          ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center font-medium text-gray-400 text-xs sm:text-sm">{player.name.charAt(0)}</div>
        }
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-heading font-bold text-xs sm:text-sm text-[#0A1318] truncate leading-tight">{player.name}</span>
          {isCaptain && (
            <span className="inline-flex items-center justify-center bg-[#FD5461] text-white font-heading font-black text-[8px] tracking-wider w-3.5 h-3.5 rounded-full flex-shrink-0">C</span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
          {isNational ? <>{flagImg}{clubBadge}</> : <>{clubBadge}{flagImg}</>}
          <span className="text-[10px] sm:text-[11px] text-gray-400 whitespace-nowrap">{player.age} yrs</span>
          <div className="xs:hidden">
            <PositionBadge position={player.position} />
          </div>
        </div>
      </div>

      {/* Market value */}
      <span className="hidden sm:block text-sm font-heading font-medium text-gray-500 tabular-nums flex-shrink-0">
        ${formatCurrency(player.market_value)}
      </span>

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  )
}
