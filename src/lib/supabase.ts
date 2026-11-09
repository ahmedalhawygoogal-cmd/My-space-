import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null

export function assertOnline(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('offline')
  }
}

export function throwIfError<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw res.error
  return res
}
