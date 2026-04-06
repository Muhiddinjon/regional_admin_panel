import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function GET() {
  const hasUrl = !!process.env.UPSTASH_REDIS_REST_URL
  const hasToken = !!process.env.UPSTASH_REDIS_REST_TOKEN

  try {
    await redis.ping()
    return NextResponse.json({ ok: true, redis: 'connected', hasUrl, hasToken })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), hasUrl, hasToken })
  }
}
