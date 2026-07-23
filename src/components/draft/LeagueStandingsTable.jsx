import { Trophy } from 'lucide-react'
import CardHeaderAction from '../ui/CardHeaderAction'

function ClubBadge({ team }) {
  if (team?.badge_url) return <img src={team.badge_url} alt="" className="h-7 w-7 shrink-0 object-contain" />
  const label = team?.short_name || team?.club_name || team?.name || 'CLB'
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-heading text-[8px] font-black uppercase text-white" style={{ backgroundColor: team?.badge_color || '#0A1318' }}>{label.slice(0, 3)}</span>
}

export default function LeagueStandingsTable({ standings = [], championId, onFullTable, onTeamClick, emptyContent }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="type-title-sm text-[#0A1318]">League Table</h2>
        {onFullTable && <CardHeaderAction onClick={onFullTable}>Full table</CardHeaderAction>}
      </header>
      {standings.length ? <>
        <div className="type-body-sm grid grid-cols-[24px_minmax(135px,1fr)_repeat(4,30px)_38px_38px] items-center gap-1 bg-gray-50 px-5 py-3 font-medium text-gray-500">
          <span className="text-center">#</span><span>Team</span><span className="text-center">P</span><span className="text-center">W</span><span className="text-center">D</span><span className="text-center">L</span><span className="text-center">GD</span><span className="text-right text-[#0A1318]">PTS</span>
        </div>
        <div className="divide-y divide-gray-50">
          {standings.map((row, index) => {
            const stats = row.stats || {}
            const gd = stats.GD || 0
            const isChampion = Boolean(championId && row.club_id === championId)
            const Wrapper = onTeamClick ? 'button' : 'div'
            return <Wrapper key={row.club_id} {...(onTeamClick ? { type: 'button', onClick: () => onTeamClick(row), title: `View ${row.club_name} squad` } : {})} className={`grid w-full grid-cols-[24px_minmax(135px,1fr)_repeat(4,30px)_38px_38px] items-center gap-1 px-5 py-3 text-left transition-[background-color,box-shadow] duration-200 ${isChampion ? 'bg-[#FD5461]/[0.07]' : ''} ${onTeamClick ? 'cursor-pointer hover:bg-[#FD5461]/[0.06] focus-visible:z-10 focus-visible:bg-[#FD5461]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FD5461]/40' : ''}`}>
              <span className={`text-center text-xs font-bold ${index === 0 || index === standings.length - 1 ? 'text-[#FD5461]' : 'text-gray-400'}`}>{index + 1}</span>
              <span className="flex min-w-0 items-center gap-2.5"><ClubBadge team={row} /><span className="truncate text-sm font-semibold text-[#0A1318]">{row.club_name}</span>{isChampion && <Trophy size={14} className="shrink-0 text-[#FD5461]" strokeWidth={2.25} />}</span>
              <span className="text-center text-sm font-semibold tabular-nums text-gray-500">{(stats.W || 0) + (stats.D || 0) + (stats.L || 0)}</span>
              <span className="text-center text-sm font-semibold tabular-nums text-gray-500">{stats.W || 0}</span><span className="text-center text-sm font-semibold tabular-nums text-gray-500">{stats.D || 0}</span><span className="text-center text-sm font-semibold tabular-nums text-gray-500">{stats.L || 0}</span>
              <span className={`text-center text-sm font-semibold tabular-nums ${gd > 0 ? 'text-green-600' : gd < 0 ? 'text-[#FD5461]' : 'text-gray-400'}`}>{gd > 0 ? `+${gd}` : gd}</span><span className="text-right text-sm font-black tabular-nums text-[#0A1318]">{stats.PTS || 0}</span>
            </Wrapper>
          })}
        </div>
        {championId && <footer className="flex items-center gap-1.5 border-t border-gray-50 px-5 py-2.5"><span className="h-2 w-2 rounded-full bg-[#FD5461]" /><span className="text-xs font-medium text-gray-500">1st — Champion</span></footer>}
      </> : emptyContent || <div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-gray-400">No matches yet.</div>}
    </section>
  )
}
