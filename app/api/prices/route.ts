import { NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'

const SEED_PRICES = [
  { subregion: 'Andijon', is_center: true, price_to_tashkent: 250000, difference_from_center: 0 },
  { subregion: 'Asaka', is_center: false, price_to_tashkent: 265000, difference_from_center: 15000 },
  { subregion: 'Baliqchi', is_center: false, price_to_tashkent: 260000, difference_from_center: 10000 },
  { subregion: 'Xonobod', is_center: false, price_to_tashkent: 260000, difference_from_center: 10000 },
  { subregion: 'Marhamat', is_center: false, price_to_tashkent: 255000, difference_from_center: 5000 },
  { subregion: 'Shahrixon', is_center: false, price_to_tashkent: 275000, difference_from_center: 25000 },
  { subregion: "Qo'rg'ontepa", is_center: false, price_to_tashkent: 280000, difference_from_center: 30000 },
  { subregion: 'Jalolquduq', is_center: false, price_to_tashkent: 270000, difference_from_center: 20000 },
  { subregion: "Bo'z", is_center: false, price_to_tashkent: 258000, difference_from_center: 8000 },
  { subregion: 'Oltinkol', is_center: false, price_to_tashkent: 262000, difference_from_center: 12000 },
]

async function seedIfEmpty() {
  const count = await redis.zcard(K.PRICES)
  if (count > 0) return
  await Promise.all(
    SEED_PRICES.map(p =>
      Promise.all([
        redis.hset(K.PRICE(p.subregion), { ...p, last_updated: new Date().toISOString() }),
        redis.zadd(K.PRICES, { score: 0, member: p.subregion }),
      ])
    )
  )
}

export async function GET() {
  try {
    await seedIfEmpty()
    const subregions = await redis.zrange(K.PRICES, 0, -1)
    const prices = await Promise.all((subregions as string[]).map(s => redis.hgetall(K.PRICE(s))))
    return NextResponse.json(prices.filter(Boolean).sort((a, b) => String(a!.subregion).localeCompare(String(b!.subregion))))
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { subregion, price_to_tashkent } = await request.json()
  try {
    // Center narxini topish
    const centerData = await redis.hgetall(K.PRICE('Andijon'))
    const centerPrice = centerData ? parseInt(String(centerData.price_to_tashkent)) : price_to_tashkent
    const diff = price_to_tashkent - centerPrice

    await redis.hset(K.PRICE(subregion), {
      price_to_tashkent,
      difference_from_center: diff,
      last_updated: new Date().toISOString(),
    })

    const updated = await redis.hgetall(K.PRICE(subregion))
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
