import { NextRequest, NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'
import { v4 as uuidv4 } from 'uuid'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')

    if (date) {
      const log = await redis.hgetall(K.CC_LOG(date))
      if (!log || !log.date) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
      return NextResponse.json(log)
    }

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

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const role = cookieStore.get('admin_token')?.value
    if (role !== 'pm') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const {
      date, cc_name,
      total_incoming, client_calls, regular_driver_calls,
      elite_driver_calls, resolved_by_cc, escalated_to_rm,
      escalated_to_pm, outgoing_inactive, outgoing_inactive_responded,
      outgoing_onboarding, notes,
    } = body

    if (!date) return NextResponse.json({ error: 'date majburiy' }, { status: 400 })

    const existing = await redis.hgetall(K.CC_LOG(date))
    if (!existing || !existing.date) {
      return NextResponse.json({ error: 'Log topilmadi' }, { status: 404 })
    }

    const updated: Record<string, unknown> = { ...existing }
    if (cc_name !== undefined) updated.cc_name = cc_name
    if (total_incoming !== undefined) updated.total_incoming = total_incoming
    if (client_calls !== undefined) updated.client_calls = client_calls
    if (regular_driver_calls !== undefined) updated.regular_driver_calls = regular_driver_calls
    if (elite_driver_calls !== undefined) updated.elite_driver_calls = elite_driver_calls
    if (resolved_by_cc !== undefined) updated.resolved_by_cc = resolved_by_cc
    if (escalated_to_rm !== undefined) updated.escalated_to_rm = escalated_to_rm
    if (escalated_to_pm !== undefined) updated.escalated_to_pm = escalated_to_pm
    if (outgoing_inactive !== undefined) updated.outgoing_inactive = outgoing_inactive
    if (outgoing_inactive_responded !== undefined) updated.outgoing_inactive_responded = outgoing_inactive_responded
    if (outgoing_onboarding !== undefined) updated.outgoing_onboarding = outgoing_onboarding
    if (notes !== undefined) updated.notes = notes

    await redis.hset(K.CC_LOG(date), updated)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('CC log PATCH error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const role = cookieStore.get('admin_token')?.value
    if (role !== 'pm') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { date } = await req.json()
    if (!date) return NextResponse.json({ error: 'date majburiy' }, { status: 400 })

    await Promise.all([
      redis.zrem(K.CC_LOGS, date),
      redis.del(K.CC_LOG(date)),
    ])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('CC log DELETE error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
