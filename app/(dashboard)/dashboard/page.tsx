import prodPool from '@/lib/prod-db'
import { redis, K } from '@/lib/redis'
import { REGIONS, DEFAULT_REGION } from '@/lib/elite-config'

const allEliteTotal = Object.values(REGIONS).reduce((sum, r) => sum + r.driver_ids.length, 0)

async function getKPIs() {
  const region = REGIONS[DEFAULT_REGION]
  const subRegionIds = region.sub_region_ids
  const eliteIds = region.driver_ids
  const eliteTotal = eliteIds.length

  // Today in Tashkent (UTC+5)
  const todayRes = await prodPool.query<{ today: string }>(
    `SELECT (NOW() + INTERVAL '5 hours')::date::text AS today`
  )
  const today = todayRes.rows[0].today

  const [eliteActiveRes, inactiveRes, todayOrdersRes, ccLogRes] = await Promise.all([
    // Elite faol shu oy (≥1 non-rejected order)
    prodPool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT driver_id) AS count
       FROM orders
       WHERE driver_id = ANY($1)
         AND status != 'rejected'
         AND (created_at + INTERVAL '5 hours')::date
           >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date`,
      [eliteIds]
    ),

    // Inaktiv elite: 15+ kun (faqat orders bo'yicha)
    prodPool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM (
         SELECT u.id AS driver_id,
                MAX((o.created_at + INTERVAL '5 hours')::date) AS last_date
         FROM unnest($1::bigint[]) AS u(id)
         LEFT JOIN orders o ON o.driver_id = u.id AND o.status != 'rejected'
         GROUP BY u.id
       ) t
       WHERE t.last_date IS NULL OR ($2::date - t.last_date) >= 15`,
      [eliteIds, today]
    ),

    // Bugungi orderlar Andijon (arrival OR departure), status != rejected
    prodPool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE status != 'rejected'
         AND (departure_sub_region_id = ANY($1) OR arrival_sub_region_id = ANY($1))
         AND (created_at + INTERVAL '5 hours')::date = $2::date`,
      [subRegionIds, today]
    ),

    // Shu oy CC jami murojaatlar (Redis)
    (async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      const monthEnd = Date.now()
      const dates = await redis.zrange(K.CC_LOGS, monthStart, monthEnd, { byScore: true }) as string[]
      const logs = dates.length > 0
        ? await Promise.all(dates.map(d => redis.hgetall(K.CC_LOG(d))))
        : []
      const rows = logs.filter(Boolean)
      return {
        rows: [{
          total: String(rows.reduce((s, r) => s + (Number(r!.total_incoming) || 0), 0)),
          to_rm: String(rows.reduce((s, r) => s + (Number(r!.escalated_to_rm) || 0), 0)),
          to_pm: String(rows.reduce((s, r) => s + (Number(r!.escalated_to_pm) || 0), 0)),
        }]
      }
    })(),
  ])

  const cc = ccLogRes.rows[0]

  return {
    eliteActive: Number(eliteActiveRes.rows[0].count),
    eliteTotal,
    inactiveElite: Number(inactiveRes.rows[0].count),
    todayOrders: Number(todayOrdersRes.rows[0].count),
    ccTotal: Number(cc.total),
    ccToRm: Number(cc.to_rm),
    ccToPm: Number(cc.to_pm),
  }
}

export default async function DashboardPage() {
  let kpis = {
    eliteActive: 0,
    eliteTotal: 49,
    inactiveElite: 0,
    todayOrders: 0,
    ccTotal: 0,
    ccToRm: 0,
    ccToPm: 0,
  }

  try {
    kpis = await getKPIs()
  } catch (err) {
    console.error('Dashboard KPI error:', err)
  }

  const cards = [
    {
      title: 'Elite faol (oy)',
      value: `${kpis.eliteActive} / ${kpis.eliteTotal}`,
      sub: 'Shu oy order qabul qildi',
      color: 'text-blue-700 bg-blue-50',
    },
    {
      title: 'Inaktiv Elite',
      value: kpis.inactiveElite,
      sub: '15+ kun harakatsiz',
      color: 'text-red-700 bg-red-50',
    },
    {
      title: 'Bugungi orderlar',
      value: kpis.todayOrders.toLocaleString(),
      sub: 'Andijon · rejected emas',
      color: 'text-green-700 bg-green-50',
    },
    {
      title: 'CC (shu oy)',
      value: kpis.ccTotal.toLocaleString(),
      sub: `RM: ${kpis.ccToRm} · PM: ${kpis.ccToPm}`,
      color: 'text-purple-700 bg-purple-50',
    },
    {
      title: 'Jami Elite (barcha)',
      value: allEliteTotal,
      sub: `${Object.keys(REGIONS).length} ta region`,
      color: 'text-gray-700 bg-gray-50',
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Andijon · Elite-50</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{card.title}</p>
            <p className={`text-3xl font-bold mt-1 inline-block px-2 py-0.5 rounded-lg ${card.color}`}>
              {card.value}
            </p>
            <p className="text-xs text-gray-400 mt-2">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
