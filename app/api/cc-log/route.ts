import { NextRequest, NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const dates = await redis.zrange(K.CC_LOGS, 0, -1, { rev: true })
    if (!dates || dates.length === 0) return NextResponse.json([])

    const logs = await Promise.all(
      (dates as string[]).slice(0, 60).map(date => redis.hgetall(K.CC_LOG(date)))
    )
    return NextResponse.json(logs.filter(Boolean))
  } catch (err) {
    console.error('CC log GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      date, cc_name,
      total_incoming = 0, client_calls = 0, regular_driver_calls = 0,
      elite_driver_calls = 0, resolved_by_cc = 0, escalated_to_rm = 0,
      escalated_to_pm = 0, outgoing_inactive = 0, outgoing_inactive_responded = 0,
      outgoing_onboarding = 0, notes = '',
    } = body

    if (!date || !cc_name) {
      return NextResponse.json({ error: 'date va cc_name majburiy' }, { status: 400 })
    }

    const id = uuidv4()
    const log = {
      id, date, cc_name,
      total_incoming, client_calls, regular_driver_calls, elite_driver_calls,
      resolved_by_cc, escalated_to_rm, escalated_to_pm,
      outgoing_inactive, outgoing_inactive_responded, outgoing_onboarding,
      notes,
    }

    await Promise.all([
      redis.hset(K.CC_LOG(date), log),
      redis.zadd(K.CC_LOGS, { score: new Date(date).getTime(), member: date }),
    ])

    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    console.error('CC log POST error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
