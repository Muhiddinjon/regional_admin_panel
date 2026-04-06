import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase-db'

export async function GET() {
  const { data, error } = await supabase
    .from('rm_reports')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const d = await request.json()

  const { data, error } = await supabase
    .from('rm_reports')
    .insert({
      week_number: d.week_number,
      week_start: d.week_start,
      week_end: d.week_end,
      rm_name: d.rm_name,
      done_orders: d.done_orders,
      prev_done_orders: d.prev_done_orders,
      andijon_city_trips: 0,
      active_drivers: d.active_drivers,
      elite_reject_rate: d.elite_reject_rate || null,
      general_reject_rate: d.general_reject_rate || null,
      kval_drivers: d.kval_drivers,
      nekval_drivers: d.nekval_drivers,
      elite_active: d.elite_active,
      elite_total: d.elite_total,
      elite_coverage: d.elite_total > 0 ? Math.round((d.elite_active / d.elite_total) * 100) : null,
      elite_checkins_done: d.elite_checkins_done,
      cc_escalations_received: d.cc_escalations_received,
      cc_escalations_resolved: d.cc_escalations_resolved,
      cc_escalations_to_ops: d.cc_escalations_to_ops,
      notes: d.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
