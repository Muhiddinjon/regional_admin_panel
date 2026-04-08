import { NextRequest, NextResponse } from 'next/server'
import prodPool from '@/lib/prod-db'
import { REGIONS } from '@/lib/elite-config'
import { redis, K } from '@/lib/redis'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params
  const region = REGIONS[Number(regionId)]
  if (!region) return NextResponse.json({ error: 'Region not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const subRegionIds = region.sub_region_ids
  const ids = await redis.smembers(K.ELITE_DRIVERS)
  const eliteIds = ids.map(Number)
  const eliteTotal = eliteIds.length

  let dateFrom = searchParams.get('date_from')
  let dateTo = searchParams.get('date_to')

  try {
    if (!dateFrom || !dateTo) {
      const nowRes = await prodPool.query<{ df: string; dt: string }>(`
        SELECT
          DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date::text AS df,
          (NOW() + INTERVAL '5 hours')::date::text AS dt
      `)
      dateFrom = dateFrom ?? nowRes.rows[0].df
      dateTo = dateTo ?? nowRes.rows[0].dt
    }

    // eliteIds to'g'ridan config dan (stable IDs)

    // Andijon = departure OR arrival sub_region, done = status != 'rejected'
    const statsRes = await prodPool.query<{
      total_done: string
      elite_done: string
      total_rejected: string
      elite_rejected: string
      active_drivers: string
      elite_active: string
      net_total_rejected: string
      net_elite_rejected: string
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'rejected') AS total_done,
        COUNT(*) FILTER (WHERE status != 'rejected' AND driver_id = ANY($3)) AS elite_done,
        COUNT(*) FILTER (WHERE status = 'rejected') AS total_rejected,
        COUNT(*) FILTER (WHERE status = 'rejected' AND driver_id = ANY($3)) AS elite_rejected,
        COUNT(DISTINCT driver_id) FILTER (WHERE status != 'rejected') AS active_drivers,
        COUNT(DISTINCT driver_id) FILTER (WHERE status != 'rejected' AND driver_id = ANY($3)) AS elite_active,
        COUNT(*) FILTER (
          WHERE status = 'rejected'
          AND NOT EXISTS (
            SELECT 1 FROM orders o2
            WHERE o2.customer_id = orders.customer_id
              AND o2.status != 'rejected'
              AND (o2.departure_sub_region_id = ANY($1) OR o2.arrival_sub_region_id = ANY($1))
              AND (o2.created_at + INTERVAL '5 hours')::date BETWEEN $2::date AND $4::date
          )
        ) AS net_total_rejected,
        COUNT(*) FILTER (
          WHERE status = 'rejected'
            AND driver_id = ANY($3)
            AND NOT EXISTS (
              SELECT 1 FROM orders o2
              WHERE o2.customer_id = orders.customer_id
                AND o2.status != 'rejected'
                AND (o2.departure_sub_region_id = ANY($1) OR o2.arrival_sub_region_id = ANY($1))
                AND (o2.created_at + INTERVAL '5 hours')::date BETWEEN $2::date AND $4::date
            )
        ) AS net_elite_rejected
      FROM orders
      WHERE (departure_sub_region_id = ANY($1) OR arrival_sub_region_id = ANY($1))
        AND (created_at + INTERVAL '5 hours')::date BETWEEN $2::date AND $4::date
    `, [subRegionIds, dateFrom, eliteIds, dateTo])

    const s = statsRes.rows[0]
    const totalDone = Number(s.total_done)
    const eliteDone = Number(s.elite_done)
    const regularDone = totalDone - eliteDone
    const eliteActive = Number(s.elite_active)
    const netTotalRejected = Number(s.net_total_rejected)
    const netEliteRejected = Number(s.net_elite_rejected)
    const netRegularRejected = netTotalRejected - netEliteRejected

    // Daily breakdown
    const dailyRes = await prodPool.query<{
      day: string
      total_done: string
      elite_done: string
      total_rejected: string
    }>(`
      SELECT
        (created_at + INTERVAL '5 hours')::date::text AS day,
        COUNT(*) FILTER (WHERE status != 'rejected') AS total_done,
        COUNT(*) FILTER (WHERE status != 'rejected' AND driver_id = ANY($3)) AS elite_done,
        COUNT(*) FILTER (WHERE status = 'rejected') AS total_rejected
      FROM orders
      WHERE (departure_sub_region_id = ANY($1) OR arrival_sub_region_id = ANY($1))
        AND (created_at + INTERVAL '5 hours')::date BETWEEN $2::date AND $4::date
      GROUP BY day
      ORDER BY day
    `, [subRegionIds, dateFrom, eliteIds, dateTo])

    // Top 10 elite drivers
    const topEliteRes = await prodPool.query<{
      driver_id: number
      first_name: string | null
      last_name: string | null
      phone_number: string | null
      done_orders: string
    }>(`
      SELECT
        o.driver_id,
        c.first_name, c.last_name, c.phone_number,
        COUNT(*) FILTER (WHERE o.status != 'rejected') AS done_orders
      FROM orders o
      LEFT JOIN customers c ON c.id = o.driver_id
      WHERE (o.departure_sub_region_id = ANY($1) OR o.arrival_sub_region_id = ANY($1))
        AND (o.created_at + INTERVAL '5 hours')::date BETWEEN $2::date AND $4::date
        AND o.driver_id = ANY($3)
      GROUP BY o.driver_id, c.first_name, c.last_name, c.phone_number
      ORDER BY done_orders DESC
      LIMIT 10
    `, [subRegionIds, dateFrom, eliteIds, dateTo])

    return NextResponse.json({
      date_from: dateFrom,
      date_to: dateTo,
      region: region.name,
      total_done: totalDone,
      elite_done: eliteDone,
      regular_done: regularDone,
      elite_share: totalDone > 0 ? Math.round((eliteDone / totalDone) * 100 * 10) / 10 : 0,
      total_rejected: netTotalRejected,
      elite_rejected: netEliteRejected,
      regular_rejected: netRegularRejected,
      reject_rate: totalDone + netTotalRejected > 0
        ? Math.round((netTotalRejected / (totalDone + netTotalRejected)) * 100 * 10) / 10
        : 0,
      elite_reject_rate: eliteDone + netEliteRejected > 0
        ? Math.round((netEliteRejected / (eliteDone + netEliteRejected)) * 100 * 10) / 10
        : 0,
      regular_reject_rate: regularDone + netRegularRejected > 0
        ? Math.round((netRegularRejected / (regularDone + netRegularRejected)) * 100 * 10) / 10
        : 0,
      active_drivers: Number(s.active_drivers),
      elite_active: eliteActive,
      elite_total: eliteTotal,
      coverage: Math.round((eliteActive / eliteTotal) * 100),
      daily: dailyRes.rows.map((r) => ({
        day: r.day,
        total_done: Number(r.total_done),
        elite_done: Number(r.elite_done),
        regular_done: Number(r.total_done) - Number(r.elite_done),
        total_rejected: Number(r.total_rejected),
      })),
      top_elite: topEliteRes.rows.map((r) => ({
        driver_id: r.driver_id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Nomalum',
        phone_number: r.phone_number,
        done_orders: Number(r.done_orders),
      })),
    })
  } catch (err) {
    console.error('Reports API error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
