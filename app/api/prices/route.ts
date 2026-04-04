import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`SELECT * FROM prices ORDER BY subregion`)
  return NextResponse.json(rows)
}

export async function PATCH(request: Request) {
  const { id, price_to_tashkent } = await request.json()

  // Get center price for diff calculation
  const { rows: center } = await pool.query(
    `SELECT price_to_tashkent FROM prices WHERE is_center = true LIMIT 1`
  )
  const centerPrice = center[0]?.price_to_tashkent ?? price_to_tashkent
  const diff = price_to_tashkent - centerPrice

  const { rows } = await pool.query(`
    UPDATE prices
    SET price_to_tashkent = $1,
        difference_from_center = $2,
        last_updated = CURRENT_DATE
    WHERE id = $3
    RETURNING *
  `, [price_to_tashkent, diff, id])

  return NextResponse.json(rows[0])
}
