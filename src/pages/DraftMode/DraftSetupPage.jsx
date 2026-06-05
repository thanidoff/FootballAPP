import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchClubs } from '../../services/clubs'

export default function DraftSetupPage() {
  const [searchParams] = useSearchParams()
  const saveName = searchParams.get('name') || 'Draft Save'
  const navigate = useNavigate()

  const [clubs, setClubs] = useState([])
  const [selectedClubIds, setSelectedClubIds] = useState([])
  const [budgetStr, setBudgetStr] = useState('100000000') // 100M default
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!saveName) {
      navigate('/draft')
      return
    }
    async function load() {
      try {
        const allClubs = await fetchClubs()
        // Only use non-national clubs
        setClubs(allClubs.filter(c => !c.is_national))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [saveName, navigate])

  function toggleClub(id) {
    setSelectedClubIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    )
  }

  function handleContinue() {
    if (selectedClubIds.length < 2) return alert('Please select at least 2 teams.')
    const budget = parseInt(budgetStr, 10)
    if (isNaN(budget) || budget <= 0) return alert('Invalid budget.')

    const selectedClubs = clubs.filter(c => selectedClubIds.includes(c.id))
    
    // Pass data through location state
    navigate(`/draft/roll?name=${encodeURIComponent(saveName)}`, {
      state: {
        clubs: selectedClubs,
        budget: budget
      }
    })
  }

  if (loading) return <div className="p-8 text-center">Loading clubs...</div>

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-heading font-black text-[#0A1318] uppercase tracking-wider mb-2">Setup League</h1>
        <p className="text-gray-500 text-sm">Select participating teams and set their starting budget.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
        <h2 className="font-heading font-black text-lg text-[#0A1318] uppercase tracking-wide mb-4">Starting Budget</h2>
        <input 
          type="number"
          value={budgetStr}
          onChange={e => setBudgetStr(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-[#0A1318] focus:ring-0 transition-colors font-mono mb-3"
        />
        
        <div className="flex flex-wrap gap-2">
          {[-100000000, -50000000, -10000000, -5000000, -1000000, 1000000, 5000000, 10000000, 50000000, 100000000].map(amount => {
            const isPositive = amount > 0;
            const label = `${isPositive ? '+' : ''}${amount / 1000000}M`;
            return (
              <button
                key={amount}
                onClick={() => {
                  const current = parseInt(budgetStr) || 0;
                  const next = Math.max(0, current + amount); // Prevent going below 0
                  setBudgetStr(next.toString());
                }}
                className="px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-colors border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              >
                {label}
              </button>
            )
          })}
        </div>
        
        <div className="text-sm text-gray-400 mt-3 border-t border-gray-50 pt-2">
          Selected: {(parseInt(budgetStr) || 0).toLocaleString()} / {(parseInt(budgetStr) || 0) / 1000000}M
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-lg text-[#0A1318] uppercase tracking-wide">Select Teams ({selectedClubIds.length})</h2>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Min 2 Teams</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {clubs.map(club => {
            const isSelected = selectedClubIds.includes(club.id)
            return (
              <div 
                key={club.id}
                onClick={() => toggleClub(club.id)}
                className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${isSelected ? 'border-[#FD5461] bg-red-50' : 'border-gray-100 hover:border-gray-200'}`}
              >
                {club.badge_url ? (
                  <img src={club.badge_url} alt={club.name} className="w-10 h-10 object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: club.badge_color || '#000' }}>
                    {club.short_name}
                  </div>
                )}
                <div className="text-[10px] font-heading font-bold text-center uppercase tracking-wide truncate w-full">{club.name}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button 
          onClick={handleContinue}
          className="px-8 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors cursor-pointer shadow-lg shadow-red-500/20"
        >
          Continue to Draft →
        </button>
      </div>
    </div>
  )
}
