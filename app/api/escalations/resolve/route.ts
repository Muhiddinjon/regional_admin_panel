import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: Request) {
  const { id } = await request.json()
  await pool.query(
    `UPDATE escalations SET status = 'resolved', resolved_at = NOW() WHERE id = $1`,
    [id]
  )
  return NextResponse.json({ ok: true })
}
