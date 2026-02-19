import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export async function insertScore(nickname, score) {
  if (!supabase) {
    console.warn('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    return { error: { message: 'Supabase not configured' } }
  }
  return supabase.from('scores').insert({ nickname: nickname.trim(), score })
}

export async function fetchLeaderboard(limit = 10) {
  if (!supabase) return { data: [], error: null }
  return supabase
    .from('scores')
    .select('nickname, score, created_at')
    .order('score', { ascending: false })
    .limit(limit)
}
