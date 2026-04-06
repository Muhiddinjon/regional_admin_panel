import { NextRequest, NextResponse } from 'next/server'
import supabase from '@/lib/supabase-db'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('elite_calls')
      .select('driver_id, called_at, result')
      .order('called_at', { ascending: false })

    if (error) throw error

    // DISTINCT ON driver_id — JS da deduplicate
    const callMap = new Map<string, { driver_id: string; called_at: string; result: string }>()
    const pmMap = new Map<string, { driver_id: string; called_at: string }>()

    for (const row of (data ?? [])) {
      const key = String(row.driver_id)
      if (row.result === 'pm_escalated') {
        if (!pmMap.has(key)) pmMap.set(key, { driver_id: key, called_at: row.called_at })
      } else {
        if (!callMap.has(key)) callMap.set(key, { driver_id: key, called_at: row.called_at, result: row.result })
      }
    }

    return NextResponse.json({
      calls: Array.from(callMap.values()),
      pm_escalations: Array.from(pmMap.values()),
    })
  } catch (err) {
    console.error('elite-calls GET error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

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

    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('elite_calls')
      .insert({ driver_id, result, note: note || null, called_at: today })
      .select('id, called_at')
      .single()

    if (error) throw error

    // Call bo'lsa — cc_logs outgoing_inactive ni +1 qilamiz
    if (result !== 'pm_escalated') {
      const responded = result === 'answered' ? 1 : 0

      const { data: existing } = await supabase
        .from('cc_logs')
        .select('outgoing_inactive, outgoing_inactive_responded')
        .eq('date', today)
        .single()

      if (existing) {
        await supabase.from('cc_logs').update({
          outgoing_inactive: (existing.outgoing_inactive ?? 0) + 1,
          outgoing_inactive_responded: (existing.outgoing_inactive_responded ?? 0) + responded,
        }).eq('date', today)
      } else {
        await supabase.from('cc_logs').insert({
          date: today,
          outgoing_inactive: 1,
          outgoing_inactive_responded: responded,
        })
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('elite-calls POST error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
