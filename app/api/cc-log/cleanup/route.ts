import { NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'

// Bir martalik endpoint: cc_name 'test' bo'lgan loglarni topib o'chiradi
export async function GET() {
  try {
    const dates = await redis.zrange(K.CC_LOGS, 0, -1, { rev: true }) as string[]
    const deleted: string[] = []

    for (const date of dates) {
      const log = await redis.hgetall(K.CC_LOG(date))
      if (log && typeof log.cc_name === 'string' && log.cc_name.toLowerCase().includes('test')) {
        await Promise.all([
          redis.zrem(K.CC_LOGS, date),
          redis.del(K.CC_LOG(date)),
        ])
        deleted.push(date)
      }
    }

    return NextResponse.json({ deleted, count: deleted.length })
  } catch (err) {
    console.error('CC log cleanup error:', err)
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
