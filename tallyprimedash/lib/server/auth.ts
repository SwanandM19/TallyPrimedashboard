import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { createSupabaseFetch } from '@/lib/supabase/fetch'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type AuthContext = { supabase: SupabaseClient; user: User; userId: string }

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new HttpError(500, 'Server is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  return { url, key }
}

/**
 * Checks the "Authorization: Bearer <token>" header the page sends and returns a Supabase client that acts
 * AS THAT USER (so row level security still applies to everything it does).
 */
export async function requireUser(request: Request): Promise<AuthContext> {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Unauthorized: sign in first.')
  const token = header.slice('Bearer '.length).trim()
  if (token.split('.').length !== 3) throw new HttpError(401, 'Unauthorized: invalid token.')
  const { url, key } = publicConfig()
  const supabase = createClient(url, key, {
    global: { fetch: createSupabaseFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Unauthorized: invalid or expired session.')
  return { supabase, user: data.user, userId: data.user.id }
}

/** Service-role client. SERVER ONLY. Used just to give the designated admin e-mail its admin role. */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new HttpError(500, 'Server is missing SUPABASE_SERVICE_ROLE_KEY (needed once to set up the admin account).')
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status })
  const message = error instanceof Error ? error.message : 'Unexpected error'
  console.error('[cashflow api]', error)
  return Response.json({ error: message }, { status: 500 })
}
