import { NextRequest, NextResponse } from 'next/server'
import localPool from '@/lib/db'

// GET: har bir driver uchun oxirgi call va oxirgi pm_escalation
export async function GET() {
  try {
    // Har driver uchun: last_call (non-pm) va pm_escalated alohida
    const pmRes = await localPool.query<{
      driver_id: string
      called_at: string
    }>(`
      SELECT DISTINCT ON (driver_id)
        driver_id::text,
        called_at::text
      FROM elite_calls
      WHERE result = 'pm_escalated'
      ORDER BY driver_id, called_at DESC, created_at DESC
    `)

    const callRes = await localPool.query<{
      driver_id: string
      called_at: string
      result: string
    }>(`
      SELECT DISTINCT ON (driver_id)
        driver_id::text,
        called_at::text,
        result
      FROM elite_calls
      WHERE result != 'pm_escalated'
      ORDER BY driver_id, called_at DESC, created_at DESC
    `)

    return NextResponse.json({
      calls: callRes.rows,
      pm_escalations: pmRes.rows,
    })
  } catch (err) {
    console.error('elite-calls GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST: call yoki pm_escalation yozish
export async function POST(req: NextRequest) {
  try {
    const { driver_id, result, note } = await req.json()

    if (!driver_id || !result) {
      return NextResponse.json({ error: 'driver_id va result majburiy' }, { status: 400 })
    }

    const valid = ['answered', 'no_answer', 'callback', 'pm_escalated']
    if (!valid.includes(result)) {
      return NextResponse.json({ error: "Noto'g'ri result" }, { status: 400 })
    }

    const res = await localPool.query<{ id: string; called_at: string }>(`
      INSERT INTO elite_calls (driver_id, result, note)
      VALUES ($1, $2, $3)
      RETURNING id, called_at::text
    `, [driver_id, result, note || null])

    // Call bo'lsa (pm_escalated emas) — cc_logs ga tushsin
    if (result !== 'pm_escalated') {
      const responded = result === 'answered' ? 1 : 0
      await localPool.query(`
        INSERT INTO cc_logs (date, outgoing_inactive, outgoing_inactive_responded)
        VALUES (CURRENT_DATE, 1, $1)
        ON CONFLICT (date) DO UPDATE SET
          outgoing_inactive = cc_logs.outgoing_inactive + 1,
          outgoing_inactive_responded = cc_logs.outgoing_inactive_responded + $1
      `, [responded])
    }

    return NextResponse.json(res.rows[0])
  } catch (err) {
    console.error('elite-calls POST error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
