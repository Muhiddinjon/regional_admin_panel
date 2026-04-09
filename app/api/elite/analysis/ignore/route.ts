import { NextRequest, NextResponse } from 'next/server'
import prodPool from '@/lib/prod-db'
import { redis, K } from '@/lib/redis'

// GET /api/elite/analysis/ignore — ignored driverlar ro'yxati
export async function GET() {
  const ids = await redis.smembers(K.ELITE_IGNORED)
  if (!ids || ids.length === 0) return NextResponse.json([])

  const numIds = ids.map(Number).filter(Boolean)
  if (numIds.length === 0) return NextResponse.json([])

  try {
    const res = await prodPool.query<{
      id: number
      first_name: string | null
      last_name: string | null
      phone_number: string | null
      done_month: string
      total_done: string
    }>(`
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone_number,
        COUNT(o.id) FILTER (
          WHERE o.status != 'rejected'
            AND (o.created_at + INTERVAL '5 hours')::date
                >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date
        ) AS done_month,
        COUNT(o.id) FILTER (WHERE o.status != 'rejected') AS total_done
      FROM customers c
      LEFT JOIN orders o ON o.driver_id = c.id
      WHERE c.id = ANY($1)
      GROUP BY c.id, c.first_name, c.last_name, c.phone_number
      ORDER BY done_month DESC, total_done DESC
    `, [numIds])

    return NextResponse.json(res.rows.map(r => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Nomalum',
      phone_number: r.phone_number,
      done_month: Number(r.done_month),
      total_done: Number(r.total_done),
    })))
  } catch (err) {
    console.error('elite/analysis/ignore GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/elite/analysis/ignore  { driver_id: number }
export async function POST(req: NextRequest) {
  const { driver_id } = await req.json()
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 })
  await redis.sadd(K.ELITE_IGNORED, String(driver_id))
  return NextResponse.json({ ok: true })
}

// DELETE /api/elite/analysis/ignore  { driver_id: number }
export async function DELETE(req: NextRequest) {
  const { driver_id } = await req.json()
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 })
  await redis.srem(K.ELITE_IGNORED, String(driver_id))
  return NextResponse.json({ ok: true })
}
