import { NextRequest, NextResponse } from 'next/server'
import prodPool from '@/lib/prod-db'
import { redis, K } from '@/lib/redis'

// POST — driver qo'shish
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { driver_id, tier = 'A', added_by = 'admin' } = body

  const driverIdNum = Number(driver_id)
  if (!driver_id || isNaN(driverIdNum) || driverIdNum <= 0) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 })
  }

  try {
    // DB dan driver info olish
    const res = await prodPool.query<{
      id: number
      first_name: string | null
      last_name: string | null
      phone_number: string
    }>(
      `SELECT id, first_name, last_name, phone_number
       FROM customers
       WHERE id = $1 AND deleted_at IS NULL`,
      [driverIdNum]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    const driver = res.rows[0]
    const id = String(driverIdNum)

    // Redis ga yozish
    await redis.sadd(K.ELITE_DRIVERS, id)
    await redis.hset(K.ELITE_DRIVER(id), {
      id,
      first_name: driver.first_name ?? '',
      last_name: driver.last_name ?? '',
      phone_number: driver.phone_number,
      tier,
      added_by,
      added_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, driver_id })
  } catch (err) {
    console.error('elite-manage POST error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// DELETE — driver o'chirish
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { driver_id } = body

  const driverIdNum = Number(driver_id)
  if (!driver_id || isNaN(driverIdNum) || driverIdNum <= 0) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 })
  }

  try {
    const id = String(driverIdNum)
    await redis.srem(K.ELITE_DRIVERS, id)
    await redis.del(K.ELITE_DRIVER(id))

    return NextResponse.json({ success: true, driver_id })
  } catch (err) {
    console.error('elite-manage DELETE error:', err)
    return NextResponse.json({ error: 'Redis error' }, { status: 500 })
  }
}
