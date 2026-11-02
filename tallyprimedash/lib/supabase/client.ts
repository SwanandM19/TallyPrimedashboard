'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseFetch } from './fetch'

let client: SupabaseClient | undefined

/** The browser's Supabase client (uses only the PUBLIC anon key). Created on first use. */
export function getSupabase(): SupabaseClient {
  if (client) return client
  // These two must be written exactly like this: Next.js swaps them in when the site is built.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Fill in .env.local (or the Vercel environment variables) and restart.')
  }
  client = createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}
