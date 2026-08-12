import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getDraftSaves, createDraftState, deleteDraftState } from '../../services/draftSave'
import CareerSetupWizard from './CareerSetupWizard'
import { generateInitialDraft } from '../../utils/draftLogic'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

const MAX_SAVE_SLOTS = 5

export default function DraftSavesPage() {
  const [saves, setSaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  useEffect(() => {
    if (searchParams.get('name')) setCreateOpen(true)
  }, [searchParams])

  async function loadSaves() {
    setLoading(true)
    try {
      const data = await getDraftSaves()
      setSaves((data || []).slice(0, MAX_SAVE_SLOTS))
    } catch (err) {
      console.error('Failed to load saves', err)
      toast.error(err.message || 'Failed to load career saves')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSaves()
  }, [])

  function handleCreateNew() {
    setCreateOpen(true)
  }

  async function handleSetupComplete({ name, clubs, freeAgents, coaches, prizes, matchSize }) {
    try {
      const { newTeams, remainingPlayers, remainingCoaches } = generateInitialDraft(clubs, freeAgents, undefined, coaches, matchSize)
      const teams = newTeams.map(team => {
        const originalClub = clubs.find(c => String(c.id) === String(team.club_id))
        return {
          ...team,
          short_name: originalClub?.short_name || team.short_name || team.club_name?.slice(0, 3).toUpperCase(),
          stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 },
        }
      })
      const saveId = await createDraftState({
        name,
        settings: {
          matchSize,
          startingBudgets: Object.fromEntries(teams.map(team => [team.club_id, team.budget])),
          ...(prizes ? {
            customPrizes: prizes.prizeSettings,
            customCupPrizes: prizes.cupPrizeSettings,
            customCupMatchPrizes: prizes.cupMatchPrizes,
            hasLeague: prizes.hasLeague,
            hasCup: prizes.hasCup,
          } : {}),
        },
        teams,
        freeAgents: remainingPlayers,
        freeAgentsCoaches: remainingCoaches,
        currentWeek: 1,
      })
      setCreateOpen(false)
      navigate(`/draft/${saveId}/overview`)
    } catch (err) {
      console.error('Failed to create career save', err)
      toast.error(err.message || 'Failed to create career save')
    }
  }

  function handleLoad(saveId) {
    navigate(`/draft/${saveId}`)
  }

  function handleDelete(event, save) {
    event.stopPropagation()
    setDeleteTarget(save)
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteDraftState(deleteTarget.id)
      setDeleteTarget(null)
      await loadSaves()
      toast.success('Career save deleted')
    } catch (err) {
      console.error('Failed to delete save', err)
      toast.error(err.message || 'Failed to delete career save')
    } finally {
      setDeleting(false)
    }
  }

  const saveSlots = Array.from({ length: MAX_SAVE_SLOTS }, (_, index) => saves[index] ?? null)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-heading font-black text-[#0A1318] uppercase tracking-wider mb-2">Career Saves</h1>
        <p className="text-gray-500 text-sm">Choose a save slot to start a new career or continue playing.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 font-heading font-bold uppercase tracking-widest">Loading saves...</div>
      ) : (
        <div className="space-y-3">
          {saveSlots.map((save, index) => save ? (
            <div
              key={save.id}
              onClick={() => handleLoad(save.id)}
              className="min-h-28 bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm hover:border-[#FD5461] hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-5 group"
            >
              <div>
                <h2 className="font-heading font-black text-lg text-[#0A1318] uppercase tracking-wide truncate mb-1">{save.name}</h2>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{save.teams?.length || 0} Teams</span>
                  <span>•</span>
                  <span>{new Date(save.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(event) => handleDelete(event, save)}
                  aria-label={`Delete ${save.name}`}
                  className="p-2 text-gray-300 hover:text-[#FD5461] hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Save"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
                <span className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 font-heading font-black text-[10px] uppercase tracking-widest group-hover:bg-[#0A1318] group-hover:text-white transition-colors">Load Save</span>
              </div>
            </div>
          ) : (
            <button
              key={`empty-${index}`}
              onClick={handleCreateNew}
              className="h-28 w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 transition-all hover:border-[#FD5461] hover:bg-red-50/30 hover:shadow-sm group cursor-pointer flex items-center"
            >
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl font-light text-gray-400 group-hover:bg-[#FD5461] group-hover:text-white">+</span>
                <div>
                  <div className="font-heading font-black text-sm uppercase tracking-wide text-[#0A1318]">New Career</div>
                  <p className="mt-1 text-xs text-gray-400">Start a new game.</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {createOpen && <CareerSetupWizard open={createOpen} initialName={searchParams.get('name') || ''} onClose={() => setCreateOpen(false)} onComplete={handleSetupComplete} />}
      <Modal open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} title="Delete career save" width="max-w-md">
        <p className="type-body text-gray-600">Delete <strong className="font-medium text-[#0A1318]">{deleteTarget?.name}</strong>? This action cannot be undone.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete save'}</Button>
        </div>
      </Modal>
    </div>
  )
}
