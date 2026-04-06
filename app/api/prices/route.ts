import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase-db'

export async function GET() {
  const { data, error } = await supabase.from('prices').select('*').order('subregion')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const { id, price_to_tashkent } = await request.json()

  const { data: center } = await supabase
    .from('prices')
    .select('price_to_tashkent')
    .eq('is_center', true)
    .single()

  const centerPrice = center?.price_to_tashkent ?? price_to_tashkent
  const diff = price_to_tashkent - centerPrice

  const { data, error } = await supabase
    .from('prices')
    .update({ price_to_tashkent, difference_from_center: diff, last_updated: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
