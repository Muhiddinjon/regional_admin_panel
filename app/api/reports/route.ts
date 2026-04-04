import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(
    `SELECT * FROM rm_reports ORDER BY week_start DESC LIMIT 30`
  )
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const d = await request.json()
  const { rows } = await pool.query(`
    INSERT INTO rm_reports (
      week_number, week_start, week_end, rm_name,
      done_orders, prev_done_orders, andijon_city_trips, active_drivers,
      elite_reject_rate, general_reject_rate, kval_drivers, nekval_drivers,
      elite_active, elite_total, elite_coverage, elite_checkins_done,
      cc_escalations_received, cc_escalations_resolved, cc_escalations_to_ops, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    RETURNING *
  `, [
    d.week_number, d.week_start, d.week_end, d.rm_name,
    d.done_orders, d.prev_done_orders, 0, d.active_drivers,
    d.elite_reject_rate || null, d.general_reject_rate || null,
    d.kval_drivers, d.nekval_drivers,
    d.elite_active, d.elite_total,
    d.elite_total > 0 ? Math.round((d.elite_active / d.elite_total) * 100) : null,
    d.elite_checkins_done,
    d.cc_escalations_received, d.cc_escalations_resolved, d.cc_escalations_to_ops,
    d.notes || null,
  ])
  return NextResponse.json(rows[0])
}
