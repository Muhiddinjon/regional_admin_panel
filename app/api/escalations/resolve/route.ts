import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase-db'

export async function POST(request: Request) {
  const { id } = await request.json()
  const { error } = await supabase
    .from('escalations')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
