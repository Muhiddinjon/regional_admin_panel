import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  let role: string | null = null
  if (password === process.env.RM_PASSWORD)           role = 'rm'
  else if (password === process.env.OPS_PASSWORD)     role = 'ops'
  else if (password === process.env.CHECKER_PASSWORD) role = 'checker'

  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, role })
  response.cookies.set('admin_token', role, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
    sameSite: 'lax',
  })
  return response
}
