import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDraftSaves, deleteDraftState } from '../../services/draftSave'

export default function DraftSavesPage() {
  const [saves, setSaves] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function loadSaves() {
    setLoading(true)
    try {
      const data = await getDraftSaves()
      setSaves(data || [])
    } catch (err) {
      console.error('Failed to load saves', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSaves()
  }, [])

  function handleCreateNew() {
    const name = window.prompt("Enter a name for your new Draft Save:")
    if (name && name.trim() !== '') {
      navigate(`/draft/setup?name=${encodeURIComponent(name.trim())}`)
    }
  }

  function handleLoad(saveId) {
    navigate(`/draft/${saveId}`)
  }

  async function handleDelete(e, saveId) {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this save? This cannot be undone.')) {
      try {
        await deleteDraftState(saveId)
        await loadSaves()
      } catch (err) {
        alert('Failed to delete save')
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-heading font-black text-[#0A1318] uppercase tracking-wider mb-2">Draft Mode Saves</h1>
        <p className="text-gray-500 text-sm">Play locally or share your save to play with friends!</p>
      </div>

      <div className="flex justify-end mb-6">
        <button 
          onClick={handleCreateNew}
          className="px-6 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
        >
          + Create New Save
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 font-heading font-bold uppercase tracking-widest">Loading saves...</div>
      ) : saves.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="font-heading font-black text-lg text-gray-400 uppercase tracking-wide">No Saves Found</h2>
          <p className="text-gray-400 text-sm mt-2">Create a new save to start drafting your dream league.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {saves.map(save => (
            <div
              key={save.id}
              onClick={() => handleLoad(save.id)}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between group"
            >
              <div className="mb-4">
                <h2 className="font-heading font-black text-lg text-[#0A1318] uppercase tracking-wide truncate mb-1">
                  {save.name}
                </h2>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{save.teams?.length || 0} Teams</span>
                  <span>•</span>
                  <span>{new Date(save.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <button
                  onClick={(e) => handleDelete(e, save.id)}
                  className="p-2 text-gray-300 hover:text-[#FD5461] hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Save"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
                <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 font-heading font-black text-[10px] uppercase tracking-widest group-hover:bg-[#0A1318] group-hover:text-white transition-colors">
                  Load Save
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
