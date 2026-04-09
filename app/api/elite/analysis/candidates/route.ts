import { NextRequest, NextResponse } from 'next/server'
import prodPool from '@/lib/prod-db'
import { redis, K } from '@/lib/redis'

// GET /api/elite/analysis/candidates?sub_region_id=39
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const subRegionId = Number(searchParams.get('sub_region_id'))
  if (!subRegionId) return NextResponse.json({ error: 'sub_region_id required' }, { status: 400 })

  const [ids, ignoredIds] = await Promise.all([
    redis.smembers(K.ELITE_DRIVERS),
    redis.smembers(K.ELITE_IGNORED),
  ])
  const eliteIds = ids.map(Number)
  const ignoredSet = new Set(ignoredIds.map(Number))

  try {
    const res = await prodPool.query<{
      id: number
      first_name: string | null
      last_name: string | null
      phone_number: string | null
      rating: string | null
      activity_score: string | null
      points: string | null
      done_month: string
      total_done: string
    }>(`
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone_number,
        c.rating,
        c.activity_score,
        c.points,
        COUNT(o.id) FILTER (
          WHERE o.status != 'rejected'
            AND (o.created_at + INTERVAL '5 hours')::date
                >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date
        ) AS done_month,
        COUNT(o.id) FILTER (WHERE o.status != 'rejected') AS total_done
      FROM customers c
      JOIN driver_infos di ON di.customer_id = c.id
      LEFT JOIN orders o ON o.driver_id = c.id
      WHERE c.role_id = '2'
        AND c.status = 'active'
        AND c.deleted_at IS NULL
        AND di.sub_region_id = $1
        AND c.id != ALL($2)
      GROUP BY c.id, c.first_name, c.last_name, c.phone_number, c.rating, c.activity_score, c.points
      ORDER BY done_month DESC, total_done DESC
      LIMIT 50
    `, [subRegionId, eliteIds.length > 0 ? eliteIds : [0]])

    return NextResponse.json(res.rows.map(r => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Nomalum',
      phone_number: r.phone_number,
      rating: r.rating ? Math.round(parseFloat(r.rating) * 10) / 10 : null,
      activity_score: r.activity_score ? Number(r.activity_score) : null,
      points: r.points ? Number(r.points) : null,
      done_month: Number(r.done_month),
      total_done: Number(r.total_done),
      ignored: ignoredSet.has(r.id),
    })))
  } catch (err) {
    console.error('elite/analysis/candidates GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
