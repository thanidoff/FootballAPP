import { useEffect, useState } from 'react'
import { fetchMatchEvents as fetchFriendlyEvents } from '../../services/friendlyMatches'

function ClubBadge({ club }) {
  if (!club) return null
  if (club.badge_url) {
    return (
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex-shrink-0">
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-1" />
      </div>
    )
  }
  return (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-heading font-black text-white text-sm flex-shrink-0"
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>
      {club.short_name}
    </div>
  )
}

const EVENT_ICON = { goal: '⚽', assist: '👟', yellow_card: '🟨', red_card: '🟥', mvp: '⭐' }
const EVENT_LABEL = { goal: 'Goal', assist: 'Assist', yellow_card: 'Yellow Card', red_card: 'Red Card', mvp: 'MVP' }

export default function MatchResultModal({ match, open, onClose, fetchEventsFn }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const fetchEvents = fetchEventsFn ?? fetchFriendlyEvents

  useEffect(() => {
    if (!open || !match) return
    setLoading(true)
    fetchEvents(match.id)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [open, match])

  if (!open || !match) return null

  const homeClub = match.home_club
  const awayClub = match.away_club
  const homeEvents = events.filter(ev => ev.club_id === match.home_club_id)
  const awayEvents = events.filter(ev => ev.club_id === match.away_club_id)
  const mvpEvent = events.find(ev => ev.event_type === 'mvp')

  const playedAt = match.played_at
    ? new Date(match.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318]">Match Result</div>
            {playedAt && <div className="text-xs text-gray-400 font-heading font-medium mt-0.5">{playedAt} · {match.duration} min</div>}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl font-bold cursor-pointer">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
          {/* Score Banner */}
          <div className="bg-gray-50 rounded-2xl px-4 py-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-2 flex-1">
                <ClubBadge club={homeClub} />
                <span className="font-heading font-black text-xs uppercase tracking-wide text-[#0A1318] text-center">{homeClub?.short_name}</span>
              </div>
              <div className="flex items-center gap-3 px-4">
                <span className="font-heading font-black text-5xl text-[#0A1318] tabular-nums">{match.home_score ?? 0}</span>
                <span className="font-heading font-black text-2xl text-gray-300">–</span>
                <span className="font-heading font-black text-5xl text-[#0A1318] tabular-nums">{match.away_score ?? 0}</span>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <ClubBadge club={awayClub} />
                <span className="font-heading font-black text-xs uppercase tracking-wide text-[#0A1318] text-center">{awayClub?.short_name}</span>
              </div>
            </div>
            {/* Result label */}
            <div className="text-center mt-3">
              {match.home_score > match.away_score && (
                <span className="text-xs font-heading font-black uppercase tracking-widest text-[#FD5461]">{homeClub?.short_name} Win</span>
              )}
              {match.home_score < match.away_score && (
                <span className="text-xs font-heading font-black uppercase tracking-widest text-[#FD5461]">{awayClub?.short_name} Win</span>
              )}
              {match.home_score === match.away_score && (
                <span className="text-xs font-heading font-black uppercase tracking-widest text-gray-400">Draw</span>
              )}
            </div>
          </div>

          {/* MVP */}
          {mvpEvent && (
            <div className="flex items-center gap-3 bg-amber-50 rounded-2xl px-4 py-3">
              <span className="text-xl">⭐</span>
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {mvpEvent.player?.photo_url
                  ? <img src={mvpEvent.player.photo_url} alt={mvpEvent.player.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-xs">{mvpEvent.player?.name?.charAt(0)}</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-black text-sm text-[#0A1318] truncate">{mvpEvent.player?.name}</div>
                <div className="text-[11px] text-amber-600 font-heading font-bold uppercase tracking-wide">MVP · {mvpEvent.club?.short_name}</div>
              </div>
            </div>
          )}

          {/* Events */}
          {loading && (
            <div className="text-center py-4 text-gray-400 text-xs font-heading font-bold uppercase tracking-widest">Loading events...</div>
          )}

          {!loading && events.filter(ev => ev.event_type !== 'mvp').length > 0 && (
            <div>
              <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-3">Match Events</div>
              <div className="bg-gray-50 rounded-2xl px-4 py-3">
                <div className="grid grid-cols-2 gap-4">
                  {/* Home */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-300">{homeClub?.short_name}</div>
                    {homeEvents.filter(ev => ev.event_type !== 'mvp').length === 0
                      ? <div className="text-[10px] text-gray-300">—</div>
                      : homeEvents.filter(ev => ev.event_type !== 'mvp').map((ev, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-xs leading-none mt-0.5">{EVENT_ICON[ev.event_type]}</span>
                            <div>
                              <span className="font-heading font-bold text-xs text-[#0A1318]">{ev.player?.name ?? '—'}</span>
                              {ev.minute && <span className="text-[10px] text-gray-400 ml-1">{ev.minute}'</span>}
                            </div>
                          </div>
                        ))
                    }
                  </div>
                  {/* Away */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-300">{awayClub?.short_name}</div>
                    {awayEvents.filter(ev => ev.event_type !== 'mvp').length === 0
                      ? <div className="text-[10px] text-gray-300">—</div>
                      : awayEvents.filter(ev => ev.event_type !== 'mvp').map((ev, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-xs leading-none mt-0.5">{EVENT_ICON[ev.event_type]}</span>
                            <div>
                              <span className="font-heading font-bold text-xs text-[#0A1318]">{ev.player?.name ?? '—'}</span>
                              {ev.minute && <span className="text-[10px] text-gray-400 ml-1">{ev.minute}'</span>}
                            </div>
                          </div>
                        ))
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && events.filter(ev => ev.event_type !== 'mvp').length === 0 && (
            <div className="text-center py-2 text-xs text-gray-300 font-heading font-bold uppercase tracking-widest">No events recorded</div>
          )}
        </div>

        <div className="px-5 pb-5 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
