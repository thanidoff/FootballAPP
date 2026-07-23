import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

function emptyQuery() {
  const result = { data: [], error: null }
  let query

  query = new Proxy(Promise.resolve(result), {
    get(target, property) {
      if (property === 'then' || property === 'catch' || property === 'finally') {
        return target[property].bind(target)
      }
      if (property === 'single' || property === 'maybeSingle') {
        return () => Promise.resolve({ data: null, error: null })
      }
      return () => query
    },
  })

  return query
}

function createOfflineClient() {
  return {
    from: () => emptyQuery(),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: null } }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
  }
}

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Using the offline compatibility client.',
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createOfflineClient()
