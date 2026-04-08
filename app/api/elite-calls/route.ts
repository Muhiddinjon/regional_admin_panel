import { NextRequest, NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const callMap = new Map<string, { driver_id: string; called_at: string; result: string; note: string }>()
    const pmMap = new Map<string, { driver_id: string; called_at: string }>()

    // Fetch all driver IDs that have a latest call record
    const callKeys = await redis.keys('andijon:elite_call_latest:*')
    const pmKeys = await redis.keys('andijon:elite_pm_latest:*')

    if (callKeys.length > 0) {
      const values = await Promise.all(callKeys.map(k => redis.hgetall(k)))
      for (const v of values) {
        if (v && v.driver_id) {
          callMap.set(String(v.driver_id), {
            driver_id: String(v.driver_id),
            called_at: String(v.called_at),
            result: String(v.result),
            note: String(v.note || ''),
          })
        }
      }
    }

    if (pmKeys.length > 0) {
      const values = await Promise.all(pmKeys.map(k => redis.hgetall(k)))
      for (const v of values) {
        if (v && v.driver_id) {
          pmMap.set(String(v.driver_id), {
            driver_id: String(v.driver_id),
            called_at: String(v.called_at),
          })
        }
      }
    }

    return NextResponse.json({
      calls: Array.from(callMap.values()),
      pm_escalations: Array.from(pmMap.values()),
    })
  } catch (err) {
    console.error('elite-calls GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { driver_id, result, note } = await req.json()
    if (!driver_id || !result) {
      return NextResponse.json({ error: 'driver_id va result majburiy' }, { status: 400 })
    }
    const valid = ['answered', 'no_answer', 'callback']
    if (!valid.includes(result)) {
      return NextResponse.json({ error: "Noto'g'ri result" }, { status: 400 })
    }
    const today = new Date().toISOString().split('T')[0]
    const id = uuidv4()
    const now = new Date().toISOString()
    const callData = { id, driver_id: String(driver_id), result, note: note || '', called_at: today, created_at: now }
    await Promise.all([
      redis.hset(K.ELITE_CALL(id), callData),
      redis.zadd(K.ELITE_CALLS, { score: Date.now(), member: id }),
      redis.hset(K.ELITE_CALL_LATEST(String(driver_id)), { driver_id: String(driver_id), called_at: today, result, note: note || '' }),
    ])
    return NextResponse.json({ id, called_at: today })
  } catch (err) {
    console.error('elite-calls PATCH error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { driver_id, result, note } = await req.json()

    if (!driver_id || !result) {
      return NextResponse.json({ error: 'driver_id va result majburiy' }, { status: 400 })
    }

    const valid = ['answered', 'no_answer', 'callback', 'pm_escalated']
    if (!valid.includes(result)) {
      return NextResponse.json({ error: "Noto'g'ri result" }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const id = uuidv4()
    const now = new Date().toISOString()

    const callData = { id, driver_id: String(driver_id), result, note: note || '', called_at: today, created_at: now }

    await Promise.all([
      redis.hset(K.ELITE_CALL(id), callData),
      redis.zadd(K.ELITE_CALLS, { score: Date.now(), member: id }),
      result === 'pm_escalated'
        ? redis.hset(K.ELITE_PM_LATEST(String(driver_id)), { driver_id: String(driver_id), called_at: today })
        : redis.hset(K.ELITE_CALL_LATEST(String(driver_id)), { driver_id: String(driver_id), called_at: today, result, note: note || '' }),
    ])

    // cc_logs outgoing ni yangilash
    if (result !== 'pm_escalated') {
      const responded = result === 'answered' ? 1 : 0
      const existing = await redis.hgetall(K.CC_LOG(today))

      if (existing && existing.date) {
        await redis.hset(K.CC_LOG(today), {
          outgoing_inactive: (parseInt(String(existing.outgoing_inactive ?? '0')) + 1),
          outgoing_inactive_responded: (parseInt(String(existing.outgoing_inactive_responded ?? '0')) + responded),
        })
      } else {
        await Promise.all([
          redis.hset(K.CC_LOG(today), { date: today, outgoing_inactive: 1, outgoing_inactive_responded: responded }),
          redis.zadd(K.CC_LOGS, { score: new Date(today).getTime(), member: today }),
        ])
      }
    }

    return NextResponse.json({ id, called_at: today })
  } catch (err) {
    console.error('elite-calls POST error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { driver_id } = await req.json()
    if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 })
    await redis.del(K.ELITE_PM_LATEST(String(driver_id)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('elite-calls DELETE error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
