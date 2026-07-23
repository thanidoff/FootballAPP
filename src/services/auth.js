import { supabase } from '../lib/supabase'

export async function requireUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user?.id) throw new Error('Please sign in to continue.')
  return data.user.id
}
