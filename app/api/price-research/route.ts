import { NextRequest, NextResponse } from 'next/server'
import { redis, K } from '@/lib/redis'

export interface NRTariffSub {
  id: string
  name: string
  researched: number | null
}

export interface NRTariffSeat {
  variant: number
  target_available: boolean | null
}

export interface NRTariff {
  tariff_id: string
  target_active: boolean | null
  subs: NRTariffSub[]
  seats: NRTariffSeat[]
}

export interface NRData {
  region_id: number
  status: 'draft' | 'confirmed' | 'entered'
  confirmed_at: string | null
  entered_at: string | null
  tariffs: NRTariff[]
  updated_at: string
}

// GET ?region_id=X  → single region from Redis
// GET ?all=true     → all regions overview
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const regionId = searchParams.get('region_id')
  const all = searchParams.get('all')

  if (all === 'true') {
    const regionIds = await redis.zrange(K.NR_INDEX, 0, -1)
    if (!regionIds || regionIds.length === 0) {
      return NextResponse.json({ regions: [] })
    }
    const pipeline = redis.pipeline()
    for (const id of regionIds) {
      pipeline.get(K.NR_DATA(Number(id)))
    }
    const results = await pipeline.exec()
    const regions: NRData[] = []
    for (const raw of results) {
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        regions.push(parsed as NRData)
      }
    }
    return NextResponse.json({ regions })
  }

  if (regionId) {
    const raw = await redis.get(K.NR_DATA(Number(regionId)))
    if (!raw) return NextResponse.json({ found: false })
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return NextResponse.json({ found: true, data })
  }

  return NextResponse.json({ error: 'region_id or all=true required' }, { status: 400 })
}

// POST { region_id, tariffs: NRTariff[] }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { region_id, tariffs } = body

  if (!region_id || !tariffs) {
    return NextResponse.json({ error: 'region_id and tariffs required' }, { status: 400 })
  }

  const existing = await redis.get(K.NR_DATA(Number(region_id)))
  const prev: Partial<NRData> = existing
    ? (typeof existing === 'string' ? JSON.parse(existing) : existing)
    : {}

  const data: NRData = {
    region_id: Number(region_id),
    status: prev.status ?? 'draft',
    confirmed_at: prev.confirmed_at ?? null,
    entered_at: prev.entered_at ?? null,
    tariffs,
    updated_at: new Date().toISOString(),
  }

  await redis.set(K.NR_DATA(Number(region_id)), JSON.stringify(data))
  await redis.zadd(K.NR_INDEX, { score: Number(region_id), member: String(region_id) })

  return NextResponse.json({ ok: true, data })
}

// PATCH { region_id, status: 'confirmed' | 'entered' }
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { region_id, status } = body

  if (!region_id || !status) {
    return NextResponse.json({ error: 'region_id and status required' }, { status: 400 })
  }

  const raw = await redis.get(K.NR_DATA(Number(region_id)))
  if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: NRData = typeof raw === 'string' ? JSON.parse(raw) : raw
  data.status = status
  data.updated_at = new Date().toISOString()

  if (status === 'confirmed') data.confirmed_at = new Date().toISOString()
  else if (status === 'entered') data.entered_at = new Date().toISOString()

  await redis.set(K.NR_DATA(Number(region_id)), JSON.stringify(data))

  return NextResponse.json({ ok: true, data })
}
