import { NextRequest, NextResponse } from 'next/server'
import prodPool from '@/lib/prod-db'
import { REGIONS } from '@/lib/elite-config'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params
  const region = REGIONS[Number(regionId)]
  if (!region) return NextResponse.json({ error: 'Region not found' }, { status: 404 })

  const driverIds = region.driver_ids
  const eliteTotal = driverIds.length

  try {
    // 1. Driver info — ID lar orqali to'g'ridan (phone o'zgarmaydi, ID stable)
    const canonicalRes = await prodPool.query<{
      id: number
      first_name: string | null
      last_name: string | null
      phone_number: string
      contract_date: string
    }>(
      `SELECT id, first_name, last_name, phone_number,
              (created_at + INTERVAL '5 hours')::date::text AS contract_date
       FROM customers
       WHERE id = ANY($1) AND deleted_at IS NULL`,
      [driverIds]
    )

    const drivers = canonicalRes.rows
    if (drivers.length === 0) return NextResponse.json([])

    // 2. Order stats — done = status != 'rejected'
    const orderStatsRes = await prodPool.query<{
      driver_id: number
      done_month: string
      total_done: string
      rejected_month: string
      last_order_date: string | null
    }>(
      `SELECT
         driver_id,
         COUNT(*) FILTER (
           WHERE status != 'rejected'
             AND (created_at + INTERVAL '5 hours')::date
               >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date
         ) AS done_month,
         COUNT(*) FILTER (WHERE status != 'rejected') AS total_done,
         COUNT(*) FILTER (
           WHERE status = 'rejected'
             AND (created_at + INTERVAL '5 hours')::date
               >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date
         ) AS rejected_month,
         MAX((created_at + INTERVAL '5 hours')::date::text)
           FILTER (WHERE status != 'rejected') AS last_order_date
       FROM orders
       WHERE driver_id = ANY($1)
       GROUP BY driver_id`,
      [driverIds]
    )

    // 3. Last offer posted by driver (driver_offer=true) — ishga chiqib qo'yishi
    const offerStatsRes = await prodPool.query<{
      driver_id: number
      last_offer_date: string | null
    }>(
      `SELECT
         customer_id AS driver_id,
         MAX((created_at + INTERVAL '5 hours')::date::text) AS last_offer_date
       FROM offers
       WHERE customer_id = ANY($1)
         AND driver_offer = true
         AND deleted_at IS NULL
       GROUP BY customer_id`,
      [driverIds]
    )

    // 4. Avg rating
    const ratingRes = await prodPool.query<{
      driver_id: number
      avg_rating: string
    }>(
      `SELECT o.driver_id, AVG(r.rate) AS avg_rating
       FROM order_rates r
       JOIN orders o ON o.id = r.order_id
       WHERE o.driver_id = ANY($1)
         AND r.customer_rate = true
         AND r.deleted_at IS NULL
       GROUP BY o.driver_id`,
      [driverIds]
    )

    // 5. Priority
    const priorityRes = await prodPool.query<{ customer_id: number }>(
      `SELECT customer_id FROM customer_score_reasons
       WHERE customer_id = ANY($1) AND reason_id = 71`,
      [driverIds]
    )

    // 6. Today in Tashkent (UTC+5)
    const todayRes = await prodPool.query<{ today: string }>(
      `SELECT (NOW() + INTERVAL '5 hours')::date::text AS today`
    )
    const today = new Date(todayRes.rows[0].today)

    // pg returns all IDs as strings — normalise to string keys throughout
    const orderMap = new Map(orderStatsRes.rows.map((r) => [String(r.driver_id), r]))
    const offerMap = new Map(offerStatsRes.rows.map((r) => [String(r.driver_id), r]))
    const ratingMap = new Map(ratingRes.rows.map((r) => [String(r.driver_id), r]))
    const prioritySet = new Set(priorityRes.rows.map((r) => String(r.customer_id)))
    const contractMap = new Map(drivers.map((d) => [String(d.id), d.contract_date]))

    const result = drivers.map((driver) => {
      const key = String(driver.id)
      const orders = orderMap.get(key)
      const offers = offerMap.get(key)
      const rating = ratingMap.get(key)

      const doneMonth = orders ? Number(orders.done_month) : 0
      const totalDone = orders ? Number(orders.total_done) : 0
      const rejectedMonth = orders ? Number(orders.rejected_month) : 0

      const rejectRate =
        doneMonth + rejectedMonth > 0
          ? Math.round((rejectedMonth / (doneMonth + rejectedMonth)) * 100 * 10) / 10
          : 0

      const lastOrderDate = orders?.last_order_date ?? null
      const lastOfferDate = offers?.last_offer_date ?? null
      const contractDate = contractMap.get(key) ?? null

      // inactive_days = oxirgi non-rejected order dan, fallback: contract date
      // (offer date faqat ko'rsatish uchun, inaktivlik hisoblashda ishlatilmaydi)
      const baseDate = lastOrderDate ?? contractDate
      const lastActive = baseDate ? new Date(baseDate) : null

      const inactiveDays = lastActive
        ? Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
        : 9999

      const avgRating = rating?.avg_rating
        ? Math.round(Number(rating.avg_rating) * 10) / 10
        : null

      return {
        id: driver.id,
        first_name: driver.first_name,
        last_name: driver.last_name,
        phone_number: driver.phone_number,
        done_month: doneMonth,
        total_done: totalDone,
        rejected_month: rejectedMonth,
        reject_rate: rejectRate,
        last_order_date: lastOrderDate,
        last_offer_date: lastOfferDate,
        inactive_days: inactiveDays,
        avg_rating: avgRating,
        has_priority: prioritySet.has(key),
      }
    })

    result.sort((a, b) => b.inactive_days - a.inactive_days)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Elite API error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
