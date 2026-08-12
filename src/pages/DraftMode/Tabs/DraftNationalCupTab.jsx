import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Check, Play, Trophy } from 'lucide-react'
import { createDraftNationalCup } from '../../../services/draftSave'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { FIFA_NATIONS } from '../../../utils/fifaNations'

const flagCode = name => FIFA_NATIONS.find(item => item.name === name)?.code
const roundNames = { 1: 'Quarter Finals', 2: 'Semi Finals', 3: 'Final' }

function Flag({ name }) {
  const code = flagCode(name)
  return code ? <img src={`https://flagcdn.com/w80/${code}.png`} alt="" className="h-9 w-12 rounded-lg object-cover ring-1 ring-black/10" /> : <span className="flex h-9 w-12 items-center justify-center rounded-lg bg-[#0A1318] text-xs font-bold text-white">{name.slice(0, 3).toUpperCase()}</span>
}

export default function DraftNationalCupTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const navigate = useNavigate()
  const [setupOpen, setSetupOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const seasons = saveData.settings?.seasons || []
  const season = [...seasons].reverse().find(item => item.status === 'completed') || seasons.find(item => item.status === 'active')
  const cups = saveData.settings?.nationalCups || []
  const cup = cups.find(item => item.status === 'active') || cups.at(-1)
  const nations = useMemo(() => {
    const count = {}
    ;[...(saveData.freeAgents || []), ...(saveData.teams || []).flatMap(team => team.roster || [])].forEach(player => { if (player.nationality) count[player.nationality] = (count[player.nationality] || 0) + 1 })
    return Object.entries(count).filter(([, total]) => total >= Number(season?.matchSize || 5)).sort((a, b) => b[1] - a[1])
  }, [saveData, season?.matchSize])
  const participant = id => cup?.participants?.find(item => item.id === id)

  async function createCup() {
    setSaving(true)
    try {
      const next = await createDraftNationalCup(saveId, selected)
      setSaveData(next)
      setSetupOpen(false)
    } finally { setSaving(false) }
  }

  function play(match, index, round) {
    navigate('/matches/draft/prematch', { state: {
      homeClub: participant(match.home), awayClub: participant(match.away), nationalMode: true,
      duration: 5, matchSize: cup.matchSize, returnPath: `/draft/${saveId}/national-cup`,
      saveId, nationalCupRound: round, matchIndex: index,
    } })
  }

  if (!season?.nationalCupEnabled) return <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm"><Trophy size={32} className="mx-auto text-gray-300" /><h2 className="mt-4 font-heading text-2xl font-black uppercase">No National Cup</h2><p className="mx-auto mt-2 max-w-md text-sm text-gray-500">This tournament is optional. Turn it on when creating the next season; the season can finish normally without it.</p></div>

  if (!cup) return <><div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm"><Trophy size={32} className="mx-auto text-[#FD5461]" /><h2 className="mt-4 font-heading text-2xl font-black uppercase">National Cup</h2><p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Choose 8 countries. Every match uses the season's {season.matchSize || 5}-player format.</p><div className="mt-7"><Button onClick={() => setSetupOpen(true)}>Select 8 teams</Button></div></div><Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Select National Teams" width="max-w-3xl"><div className="grid gap-2 sm:grid-cols-2">{nations.map(([name, count]) => { const active = selected.includes(name); return <button key={name} onClick={() => setSelected(value => active ? value.filter(item => item !== name) : value.length < 8 ? [...value, name] : value)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${active ? 'border-[#FD5461] bg-red-50' : 'border-gray-200 bg-white'}`}><Flag name={name} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="text-xs text-gray-400">{count} players</span></span>{active && <Check size={18} className="text-[#FD5461]" />}</button>})}</div><Button onClick={createCup} disabled={selected.length !== 8 || saving} className="mt-5 w-full">{saving ? 'Creating...' : `Create tournament · ${selected.length}/8`}</Button></Modal></>

  return <div className="space-y-5"><div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4"><div><div className="font-heading text-lg font-black uppercase">National Cup {cup.number}</div><div className="text-xs text-gray-500">Season {cup.seasonId} · {cup.matchSize} players</div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${cup.status === 'completed' ? 'bg-red-50 text-[#FD5461]' : 'bg-gray-100 text-gray-600'}`}>{cup.status === 'completed' ? `${participant(cup.champion)?.name} winner` : roundNames[cup.round]}</span></div><div className="grid gap-4 lg:grid-cols-3">{[1,2,3].map(round => <section key={round} className="rounded-2xl border border-gray-200 bg-white p-3"><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">{roundNames[round]}</h3><div className="space-y-3">{(cup.rounds?.[round] || []).map((match, index) => <article key={index} className="overflow-hidden rounded-xl border border-gray-200"><div className="space-y-2 p-3">{[match.home, match.away].map(id => { const team = participant(id); return <div key={id} className="flex items-center gap-2"><Flag name={team?.name || id} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{team?.name || id}</span>{match.played && <span className="font-semibold tabular-nums">{id === match.home ? match.homeScore : match.awayScore}</span>}</div>})}</div>{cup.status === 'active' && cup.round === round && !match.played && <button onClick={() => play(match, index, round)} className="flex w-full items-center justify-center gap-2 border-t border-gray-100 py-2 text-xs font-semibold text-[#FD5461]"><Play size={14} />Play match</button>}</article>)}</div></section>)}</div></div>
}
