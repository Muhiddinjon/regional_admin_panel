import prodPool from '@/lib/prod-db'
import { redis, K } from '@/lib/redis'
import { REGIONS, DEFAULT_REGION, ANDIJON_CITY_SUB_IDS, ANDIJON_CITY_GOAL } from '@/lib/elite-config'

async function getKPIs() {
  const region = REGIONS[DEFAULT_REGION]
  const subRegionIds = region.sub_region_ids
  const ids = await redis.smembers(K.ELITE_DRIVERS)
  const eliteIds = ids.map(Number)
  const eliteTotal = eliteIds.length

  // Today in Tashkent (UTC+5)
  const todayRes = await prodPool.query<{ today: string }>(
    `SELECT (NOW() + INTERVAL '5 hours')::date::text AS today`
  )
  const today = todayRes.rows[0].today

  const [eliteActiveRes, inactiveRes, todayOrdersRes, cityOrdersRes, ccLogRes, monthOrdersRes] = await Promise.all([
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

    // Andijon city (sub_region_id=39) shu oy done orderlar
    prodPool.query<{ city_done: string; city_today: string }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE (created_at + INTERVAL '5 hours')::date
             >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date
         ) AS city_done,
         COUNT(*) FILTER (
           WHERE (created_at + INTERVAL '5 hours')::date = $2::date
         ) AS city_today
       FROM orders
       WHERE status != 'rejected'
         AND (departure_sub_region_id = ANY($1) OR arrival_sub_region_id = ANY($1))`,
      [ANDIJON_CITY_SUB_IDS, today]
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

    // Shu oy Andijon done/rejected + elite/regular breakdown + net reject
    prodPool.query<{ total_done: string; total_rejected: string; elite_done: string; elite_rejected: string; net_total_rejected: string; net_elite_rejected: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'rejected') AS total_done,
         COUNT(*) FILTER (WHERE status = 'rejected') AS total_rejected,
         COUNT(*) FILTER (WHERE status != 'rejected' AND driver_id = ANY($2)) AS elite_done,
         COUNT(*) FILTER (WHERE status = 'rejected' AND driver_id = ANY($2)) AS elite_rejected,
         COUNT(*) FILTER (
           WHERE status = 'rejected'
           AND NOT EXISTS (
             SELECT 1 FROM orders o2
             WHERE o2.customer_id = orders.customer_id
               AND o2.status != 'rejected'
               AND (o2.departure_sub_region_id = ANY($1) OR o2.arrival_sub_region_id = ANY($1))
               AND (o2.created_at + INTERVAL '5 hours')::date
                     >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date
           )
         ) AS net_total_rejected,
         COUNT(*) FILTER (
           WHERE status = 'rejected'
             AND driver_id = ANY($2)
             AND NOT EXISTS (
               SELECT 1 FROM orders o2
               WHERE o2.customer_id = orders.customer_id
                 AND o2.status != 'rejected'
                 AND (o2.departure_sub_region_id = ANY($1) OR o2.arrival_sub_region_id = ANY($1))
                 AND (o2.created_at + INTERVAL '5 hours')::date
                       >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date
             )
         ) AS net_elite_rejected
       FROM orders
       WHERE (departure_sub_region_id = ANY($1) OR arrival_sub_region_id = ANY($1))
         AND (created_at + INTERVAL '5 hours')::date
           >= DATE_TRUNC('month', NOW() + INTERVAL '5 hours')::date`,
      [subRegionIds, eliteIds]
    ),
  ])

  const cc = ccLogRes.rows[0]
  const city = cityOrdersRes.rows[0]
  const mo = monthOrdersRes.rows[0]

  // Remaining days in current month (Tashkent)
  const todayDate = new Date(today)
  const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0)
  const daysLeft = monthEnd.getDate() - todayDate.getDate() + 1
  const dayOfMonth = todayDate.getDate()
  const cityDone = Number(city.city_done)
  const cityToday = Number(city.city_today)
  const totalDays = monthEnd.getDate()
  const expectedByNow = Math.round((dayOfMonth / totalDays) * ANDIJON_CITY_GOAL)
  const diffFromPlan = cityDone - expectedByNow
  const dailyRunRate = daysLeft > 0 ? Math.ceil((ANDIJON_CITY_GOAL - cityDone) / daysLeft) : 0

  return {
    eliteActive: Number(eliteActiveRes.rows[0].count),
    eliteTotal,
    inactiveElite: Number(inactiveRes.rows[0].count),
    todayOrders: Number(todayOrdersRes.rows[0].count),
    ccTotal: Number(cc.total),
    ccToRm: Number(cc.to_rm),
    ccToPm: Number(cc.to_pm),
    allEliteTotal: eliteTotal,
    cityDone,
    cityToday,
    daysLeft,
    dayOfMonth,
    dailyRunRate,
    expectedByNow,
    diffFromPlan,
    monthTotalDone: Number(mo.total_done),
    monthTotalRejected: Number(mo.total_rejected),
    monthEliteDone: Number(mo.elite_done),
    monthEliteRejected: Number(mo.elite_rejected),
    netTotalRejected: Number(mo.net_total_rejected),
    netEliteRejected: Number(mo.net_elite_rejected),
  }
}

export default async function DashboardPage() {
  let kpis = {
    eliteActive: 0,
    eliteTotal: 0,
    inactiveElite: 0,
    todayOrders: 0,
    ccTotal: 0,
    ccToRm: 0,
    ccToPm: 0,
    allEliteTotal: 0,
    cityDone: 0,
    cityToday: 0,
    daysLeft: 0,
    dayOfMonth: 1,
    dailyRunRate: 0,
    expectedByNow: 0,
    diffFromPlan: 0,
    monthTotalDone: 0,
    monthTotalRejected: 0,
    monthEliteDone: 0,
    monthEliteRejected: 0,
    netTotalRejected: 0,
    netEliteRejected: 0,
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
      value: kpis.allEliteTotal,
      sub: `${Object.keys(REGIONS).length} ta region`,
      color: 'text-gray-700 bg-gray-50',
    },
  ]

  const cityPct = ANDIJON_CITY_GOAL > 0 ? Math.round((kpis.cityDone / ANDIJON_CITY_GOAL) * 100) : 0
  const barColor = cityPct >= 80 ? 'bg-green-500' : cityPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const expectedPct = ANDIJON_CITY_GOAL > 0 ? Math.round((kpis.expectedByNow / ANDIJON_CITY_GOAL) * 100) : 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Andijon · Elite-50</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
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

      {/* Andijon city April tracker */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Aprel maqsadi — Andijon (shahar + 4 tuman)</p>
            <p className="text-xs text-gray-400 mt-0.5">Maqsad: {ANDIJON_CITY_GOAL.toLocaleString()} order</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${cityPct >= 80 ? 'text-green-600' : cityPct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {kpis.cityDone.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">{cityPct}% bajarildi</p>
          </div>
        </div>

        {/* Progress bar + plan marker */}
        <div className="relative mb-1">
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(cityPct, 100)}%` }}
            />
          </div>
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-gray-500 rounded"
            style={{ left: `calc(${Math.min(expectedPct, 100)}% - 1px)` }}
          />
        </div>
        <div className="relative h-4 mb-2">
          <span
            className="absolute text-[10px] text-gray-400 -translate-x-1/2"
            style={{ left: `${Math.min(expectedPct, 100)}%` }}
          >
            ▲ plan: {kpis.expectedByNow}
          </span>
        </div>

        {/* Plan vs Actual */}
        <div className="flex items-center gap-3 text-xs mb-3 px-1">
          <span className="text-gray-400">Plan: <b className="text-gray-600">{kpis.expectedByNow}</b></span>
          <span className="text-gray-400">Hozir: <b className="text-gray-800">{kpis.cityDone}</b></span>
          <span className={kpis.diffFromPlan >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
            {kpis.diffFromPlan >= 0 ? `+${kpis.diffFromPlan} oldinda` : `${kpis.diffFromPlan} orqada`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-400">Bugun</p>
            <p className="text-base font-semibold text-gray-800">{kpis.cityToday}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Qolgan kunlar</p>
            <p className="text-base font-semibold text-gray-800">{kpis.daysLeft}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Kerakli kunlik temp</p>
            <p className={`text-base font-semibold ${kpis.dailyRunRate > 0 && kpis.cityToday < kpis.dailyRunRate ? 'text-red-600' : 'text-gray-800'}`}>
              {kpis.dailyRunRate > 0 ? kpis.dailyRunRate : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Shu oy orderlar breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
        <p className="text-sm font-semibold text-gray-800 mb-3">Shu oy orderlar — Andijon</p>
        {(() => {
          const netRegularRejected = kpis.netTotalRejected - kpis.netEliteRejected
          const regularDone = kpis.monthTotalDone - kpis.monthEliteDone
          const netRejectRate = (kpis.monthTotalDone + kpis.netTotalRejected) > 0
            ? Math.round(kpis.netTotalRejected / (kpis.monthTotalDone + kpis.netTotalRejected) * 100)
            : 0
          const netEliteRejectRate = (kpis.monthEliteDone + kpis.netEliteRejected) > 0
            ? Math.round(kpis.netEliteRejected / (kpis.monthEliteDone + kpis.netEliteRejected) * 100)
            : 0
          const netRegularRejectRate = (regularDone + netRegularRejected) > 0
            ? Math.round(netRegularRejected / (regularDone + netRegularRejected) * 100)
            : 0
          return (
            <div className="grid grid-cols-4 gap-0 text-sm">
              <div className="text-gray-400 font-medium text-xs py-1"></div>
              <div className="text-center text-gray-400 font-medium text-xs py-1">Done</div>
              <div className="text-center text-gray-400 font-medium text-xs py-1">Rejected</div>
              <div className="text-center text-red-400 font-medium text-xs py-1">Reject %</div>

              <div className="text-xs text-gray-500 py-2 border-t border-gray-50">Jami</div>
              <div className="text-center font-semibold text-gray-900 py-2 border-t border-gray-50">{kpis.monthTotalDone.toLocaleString()}</div>
              <div className="text-center font-semibold text-red-500 py-2 border-t border-gray-50">{kpis.netTotalRejected.toLocaleString()}</div>
              <div className={`text-center font-semibold py-2 border-t border-gray-50 ${netRejectRate >= 25 ? 'text-red-600' : 'text-gray-500'}`}>{netRejectRate}%</div>

              <div className="text-xs text-blue-600 py-2 border-t border-gray-50">Elite</div>
              <div className="text-center font-semibold text-blue-700 py-2 border-t border-gray-50">{kpis.monthEliteDone.toLocaleString()}</div>
              <div className="text-center font-semibold text-red-400 py-2 border-t border-gray-50">{kpis.netEliteRejected.toLocaleString()}</div>
              <div className={`text-center font-semibold py-2 border-t border-gray-50 ${netEliteRejectRate >= 25 ? 'text-red-600' : 'text-gray-500'}`}>{netEliteRejectRate}%</div>

              <div className="text-xs text-gray-500 py-2 border-t border-gray-50">Oddiy</div>
              <div className="text-center font-semibold text-gray-700 py-2 border-t border-gray-50">{regularDone.toLocaleString()}</div>
              <div className="text-center font-semibold text-red-300 py-2 border-t border-gray-50">{netRegularRejected.toLocaleString()}</div>
              <div className={`text-center font-semibold py-2 border-t border-gray-50 ${netRegularRejectRate >= 25 ? 'text-red-600' : 'text-gray-500'}`}>{netRegularRejectRate}%</div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
