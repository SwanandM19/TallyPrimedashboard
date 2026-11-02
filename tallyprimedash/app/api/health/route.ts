export const dynamic = 'force-dynamic'

/** Open /api/health in the browser to see which settings the server can see. It shows only yes/no, never a value. */
export async function GET() {
  const has = (name: string) => Boolean(process.env[name] && process.env[name]!.trim())
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: has('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: has('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
    ADMIN_EMAIL: has('ADMIN_EMAIL'),
    RESEND_API_KEY_optional: has('RESEND_API_KEY'),
  }
  const ok = checks.NEXT_PUBLIC_SUPABASE_URL && checks.NEXT_PUBLIC_SUPABASE_ANON_KEY && checks.SUPABASE_SERVICE_ROLE_KEY
  return Response.json({ ok, checks })
}
