import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/prod-db'

const TC_ID = 2 // Toshkent City region_id
const r15k = (n: number) => Math.ceil(n / 15000) * 15000

// GET /api/price-setup/city-ref
// ?from_region_id=4  → single route
// ?all=true          → all X → Toshkent City routes
export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get('all') === 'true'
  const fromId = Number(req.nextUrl.searchParams.get('from_region_id'))

  if (!all && !fromId) return NextResponse.json({ found: false })

  const client = await pool.connect()
  try {
    const SUB_REGION_TYPE = 'App\\Models\\SubRegion'
    const seatParams: (string | number)[] = all ? [TC_ID] : [fromId, TC_ID]
    const subParams: (string | number)[] = all ? [TC_ID, SUB_REGION_TYPE] : [fromId, TC_ID, SUB_REGION_TYPE]
    const tcParam = all ? '$1' : '$2'
    const typeParam = all ? '$2' : '$3'
    const regionFilter = all ? '' : 'AND br.departure_region_id = $1'

    // 1. Seat pricings
    const seatsRes = await client.query<{
      departure_region_id: number; tariff_id: string | null
      seat_variant_id: string; min_price: number; available: boolean
    }>(`
      SELECT br.departure_region_id, br.tariff_id,
        sp.seat_variant_id, sp.min_price::int, sp.available
      FROM base_routes br
      JOIN seat_pricings sp ON sp.base_route_id = br.id AND sp.deleted_at IS NULL
      WHERE br.arrival_region_id = ${tcParam} AND br.deleted_at IS NULL
        ${regionFilter}
      ORDER BY br.departure_region_id, br.tariff_id NULLS LAST, sp.seat_variant_id
    `, seatParams)

    if (!seatsRes.rows.length) {
      return NextResponse.json(all ? { routes: {} } : { found: false })
    }

    // 2. Sub-region additional prices (all tariffs, including delivery)
    const subsRes = await client.query<{
      departure_region_id: number; tariff_id: string | null
      attribute_id: string; name: string; region_id: string; price: number; status: boolean
    }>(`
      SELECT br.departure_region_id, br.tariff_id, bra.attribute_id,
        COALESCE(sr.name->>'uz', sr.name->>'en') AS name,
        sr.region_id, bra.price::int, bra.status
      FROM base_route_attributes bra
      JOIN base_routes br ON br.id = bra.base_route_id
      LEFT JOIN sub_regions sr ON sr.id = bra.attribute_id
      WHERE br.arrival_region_id = ${tcParam}
        AND br.deleted_at IS NULL
        AND bra.attribute_type = ${typeParam}
        AND bra.deleted_at IS NULL
        ${regionFilter}
      ORDER BY br.departure_region_id, br.tariff_id NULLS LAST, sr.region_id, bra.price DESC
    `, subParams)

    // 3. Region names
    const regRes = await client.query<{ id: number; name: string }>(`
      SELECT id, name->>'uz' AS name FROM regions ORDER BY id
    `)
    const regNames: Record<number, string> = {}
    for (const r of regRes.rows) regNames[r.id] = r.name

    // Group by departure_region_id
    const routesMap: Record<number, {
      from_region_id: number
      from_region_name: string
      seats: Record<string, { variant: number; price: number; available: boolean }[]>
      departure_subs: Record<string, { id: string; name: string; price: number; status: boolean }[]>
      tariff_active: Record<string, boolean>
      std_base: number
      eco_base: number
    }> = {}

    for (const r of seatsRes.rows) {
      const rid = Number(r.departure_region_id)
      if (!routesMap[rid]) {
        routesMap[rid] = {
          from_region_id: rid,
          from_region_name: regNames[rid] ?? `Region ${rid}`,
          seats: {},
          departure_subs: {},
          tariff_active: {},
          std_base: 0,
          eco_base: 0,
        }
      }
      const tid = r.tariff_id ?? 'delivery'
      if (!routesMap[rid].seats[tid]) routesMap[rid].seats[tid] = []
      if (!(tid in routesMap[rid].tariff_active)) {
        routesMap[rid].tariff_active[tid] = true
      }
      routesMap[rid].seats[tid].push({
        variant: Number(r.seat_variant_id),
        price: Number(r.min_price),
        available: Boolean(r.available),
      })
    }

    // Add sub-regions grouped by tariff_id
    for (const r of subsRes.rows) {
      const rid = Number(r.departure_region_id)
      if (!routesMap[rid]) continue
      if (Number(r.region_id) !== Number(rid)) continue
      const tid = r.tariff_id ?? 'delivery'
      if (!routesMap[rid].departure_subs[tid]) routesMap[rid].departure_subs[tid] = []
      // Also populate tariff_active for delivery (not in seatsRes)
      if (!(tid in routesMap[rid].tariff_active)) {
        routesMap[rid].tariff_active[tid] = true
      }
      // Full price = base (variant-1 seat price for this tariff) + bra.price delta
      const base = routesMap[rid].seats[tid]?.find(s => s.variant === 1)?.price ?? 0
      routesMap[rid].departure_subs[tid].push({
        id: r.attribute_id,
        name: r.name,
        price: Number(r.price) + base,
        status: Boolean(r.status),
      })
    }

    // Calculate std_base and eco_base (unchanged)
    for (const rid of Object.keys(routesMap).map(Number)) {
      const std1 = routesMap[rid].seats['1']?.find(s => s.variant === 1)
      routesMap[rid].std_base = std1?.price ?? 0
      routesMap[rid].eco_base = r15k(routesMap[rid].std_base * 3 / 4)
    }

    if (!all) {
      const data = routesMap[fromId]
      return NextResponse.json(data ? { found: true, ...data } : { found: false })
    }

    return NextResponse.json({ routes: routesMap })
  } finally {
    client.release()
  }
}
