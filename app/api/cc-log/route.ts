import { NextRequest, NextResponse } from 'next/server'
import localPool from '@/lib/db'

export async function GET() {
  try {
    const res = await localPool.query(`
      SELECT * FROM cc_logs ORDER BY date DESC LIMIT 60
    `)
    return NextResponse.json(res.rows)
  } catch (err) {
    console.error('CC log GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      date,
      cc_name,
      total_incoming = 0,
      client_calls = 0,
      regular_driver_calls = 0,
      elite_driver_calls = 0,
      resolved_by_cc = 0,
      escalated_to_rm = 0,
      escalated_to_pm = 0,
      outgoing_inactive = 0,
      outgoing_inactive_responded = 0,
      outgoing_onboarding = 0,
      notes = '',
    } = body

    if (!date || !cc_name) {
      return NextResponse.json({ error: 'date va cc_name majburiy' }, { status: 400 })
    }

    const res = await localPool.query(
      `INSERT INTO cc_logs (
        date, cc_name,
        total_incoming, client_calls, regular_driver_calls, elite_driver_calls,
        resolved_by_cc, escalated_to_rm, escalated_to_pm,
        outgoing_inactive, outgoing_inactive_responded, outgoing_onboarding,
        notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        date, cc_name,
        total_incoming, client_calls, regular_driver_calls, elite_driver_calls,
        resolved_by_cc, escalated_to_rm, escalated_to_pm,
        outgoing_inactive, outgoing_inactive_responded, outgoing_onboarding,
        notes,
      ]
    )
    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (err) {
    console.error('CC log POST error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
