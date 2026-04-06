import { NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const ids = await redis.zrange(K.RM_REPORTS, 0, -1, { rev: true })
    if (!ids || ids.length === 0) return NextResponse.json([])
    const reports = await Promise.all((ids as string[]).slice(0, 30).map(id => redis.hgetall(K.RM_REPORT(id))))
    return NextResponse.json(reports.filter(Boolean))
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const d = await request.json()
  try {
    const id = uuidv4()
    const report = {
      id,
      week_number: d.week_number,
      week_start: d.week_start,
      week_end: d.week_end,
      rm_name: d.rm_name,
      done_orders: d.done_orders,
      prev_done_orders: d.prev_done_orders,
      active_drivers: d.active_drivers,
      elite_reject_rate: d.elite_reject_rate || '',
      general_reject_rate: d.general_reject_rate || '',
      kval_drivers: d.kval_drivers,
      nekval_drivers: d.nekval_drivers,
      elite_active: d.elite_active,
      elite_total: d.elite_total,
      elite_coverage: d.elite_total > 0 ? Math.round((d.elite_active / d.elite_total) * 100) : '',
      elite_checkins_done: d.elite_checkins_done,
      cc_escalations_received: d.cc_escalations_received,
      cc_escalations_resolved: d.cc_escalations_resolved,
      cc_escalations_to_ops: d.cc_escalations_to_ops,
      notes: d.notes || '',
      created_at: new Date().toISOString(),
    }

    const weekScore = new Date(d.week_start).getTime()
    await Promise.all([
      redis.hset(K.RM_REPORT(id), report),
      redis.zadd(K.RM_REPORTS, { score: weekScore, member: id }),
    ])

    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
