import { NextRequest, NextResponse } from 'next/server'
import prodPool from '@/lib/prod-db'
import { REGIONS, DEFAULT_REGION } from '@/lib/elite-config'
import { redis, K } from '@/lib/redis'

// GET /api/elite/analysis?region_id=3&date_from=2026-04-01&date_to=2026-04-08
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const regionId = Number(searchParams.get('region_id') ?? DEFAULT_REGION)
  const region = REGIONS[regionId]
  if (!region) return NextResponse.json({ error: 'Region not found' }, { status: 404 })

  const subRegionIds = region.sub_region_ids
  const ids = await redis.smembers(K.ELITE_DRIVERS)
  const eliteIds = ids.map(Number)

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

    const [namesRes, demandRes, supplyRes] = await Promise.all([
      prodPool.query<{ id: string; name: string }>(
        `SELECT id, name->>'uz' AS name FROM sub_regions WHERE id = ANY($1) ORDER BY name->>'uz'`,
        [subRegionIds]
      ),
      // Demand: seat-based car equivalents per departure_sub_region
      // Sum all seats (full_seat=3, otherwise seat_variants.capacity), CEIL(total/3) = cars needed
      prodPool.query<{ sub_region_id: string; demand: string }>(
        `SELECT o.departure_sub_region_id AS sub_region_id,
                CEIL(SUM(CASE WHEN o.is_full_seat_offer THEN 3 ELSE COALESCE(sv.capacity, 1) END)::numeric / 3)::int AS demand
         FROM offers o
         LEFT JOIN seat_variants sv ON sv.id = o.seat_variants_id
         WHERE o.driver_offer = false
           AND o.departure_sub_region_id = ANY($1)
           AND o.deleted_at IS NULL
           AND (o.created_at + INTERVAL '5 hours')::date BETWEEN $2::date AND $3::date
         GROUP BY o.departure_sub_region_id`,
        [subRegionIds, dateFrom, dateTo]
      ),
      eliteIds.length > 0
        ? prodPool.query<{ sub_region_id: string; supply: string }>(
            `SELECT di.sub_region_id, COUNT(*) AS supply
             FROM driver_infos di
             WHERE di.customer_id = ANY($1)
               AND di.sub_region_id = ANY($2)
             GROUP BY di.sub_region_id`,
            [eliteIds, subRegionIds]
          )
        : { rows: [] as { sub_region_id: string; supply: string }[] },
    ])

    const demandMap = new Map(demandRes.rows.map(r => [Number(r.sub_region_id), Number(r.demand)]))
    const supplyMap = new Map(supplyRes.rows.map(r => [Number(r.sub_region_id), Number(r.supply)]))

    const result = namesRes.rows.map(sr => {
      const id = Number(sr.id)
      const demand = demandMap.get(id) ?? 0
      const supply = supplyMap.get(id) ?? 0
      return { sub_region_id: id, name: sr.name, demand, supply, gap: demand - supply }
    }).sort((a, b) => b.gap - a.gap)

    return NextResponse.json({ date_from: dateFrom, date_to: dateTo, rows: result })
  } catch (err) {
    console.error('elite/analysis GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
