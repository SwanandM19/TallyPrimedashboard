import { getServiceClient, type AuthContext } from './auth'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin123@gmail.com').trim().toLowerCase()

/**
 * True when the signed-in user is an admin. The one designated, e-mail-verified admin address gets its
 * admin role created automatically on first use (this is the only place the service-role key is used).
 */
export async function isAdmin(context: AuthContext): Promise<boolean> {
  const { data } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId).maybeSingle()
  if (data?.role === 'admin') return true
  const email = context.user.email?.toLowerCase()
  if (email !== ADMIN_EMAIL || !context.user.email_confirmed_at) return false
  const { error } = await getServiceClient().from('user_roles').upsert({ user_id: context.userId, role: 'admin' }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
  return true
}
