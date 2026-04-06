import { NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'

export async function POST(request: Request) {
  const { id } = await request.json()
  try {
    await redis.hset(K.ESCALATION(id), {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('escalation resolve error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
