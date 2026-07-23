import { useEffect, useState } from 'react'
import { Cloud, LogIn } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { migrateLocalDraftSavesToCloud } from '../../services/draftSave'

export default function AuthWrapper({ children }) {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [cloudReady, setCloudReady] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setCloudReady(false)
      return
    }
    let active = true
    migrateLocalDraftSavesToCloud()
      .catch(err => console.error('Local career migration failed', err))
      .finally(() => { if (active) setCloudReady(true) })
    return () => { active = false }
  }, [session])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else if (mode === 'signup' && !result.data.session) {
      setMessage('Check your email to confirm the account, then sign in.')
    }
  }

  if (loading || (session && !cloudReady)) return null
  if (!isSupabaseConfigured || session) return children

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1318] p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl animate-modal-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FD5461] shadow-lg shadow-[#FD5461]/30">
            <Cloud className="text-white" size={26} />
          </div>
          <h1 className="text-2xl font-semibold text-[#0A1318]">
            {mode === 'login' ? 'Continue your game' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-gray-500">Your career saves sync securely across devices.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={event => { setEmail(event.target.value); setError('') }}
            className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3.5 outline-none transition-all focus:border-[#FD5461] focus:ring-2 focus:ring-[#FD5461]/15"
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={event => { setPassword(event.target.value); setError('') }}
            className={`w-full rounded-xl border bg-white px-5 py-3.5 outline-none transition-all focus:ring-2 focus:ring-[#FD5461]/15 ${error ? 'border-[#FD5461]' : 'border-gray-200 focus:border-[#FD5461]'}`}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
          {error && <p className="text-sm text-[#FD5461]">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          <button disabled={loading} type="submit" className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FD5461] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#FD5461]/20 transition-all hover:bg-[#ee4654] active:scale-[0.98] disabled:opacity-50">
            <LogIn size={17} /> {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }} className="w-full cursor-pointer text-sm text-gray-600 transition-colors hover:text-[#0A1318]">
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
