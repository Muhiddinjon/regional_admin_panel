'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

type Price = {
  id: string
  subregion: string
  is_center: boolean
  price_to_tashkent: number
  difference_from_center: number
  last_updated: string
}

export default function PricesPage() {
  const [prices, setPrices] = useState<Price[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/prices').then((r) => r.json()).then(setPrices)
  }, [])

  function startEdit(price: Price) {
    setEditingId(price.id)
    setEditValue(String(price.price_to_tashkent))
  }

  async function saveEdit(price: Price) {
    setSaving(true)
    const res = await fetch('/api/prices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: price.id, price_to_tashkent: Number(editValue) }),
    })
    const updated = await res.json()
    setPrices((prev) => prev.map((p) => (p.id === price.id ? updated : p)))
    setEditingId(null)
    setSaving(false)
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-gray-900 mb-6">Narxlar</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Subregion</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Narx (UZS)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Markaz farqi</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Oxirgi yangilangan</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prices.map((price) => (
              <tr key={price.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{price.subregion}</span>
                  {price.is_center && (
                    <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Markaz</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === price.id ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-32 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span className="text-gray-700">{Number(price.price_to_tashkent).toLocaleString()}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {price.difference_from_center === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className={price.difference_from_center > 0 ? 'text-green-600' : 'text-red-600'}>
                      {price.difference_from_center > 0 ? '+' : ''}
                      {Number(price.difference_from_center).toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(price.last_updated)}</td>
                <td className="px-4 py-3">
                  {editingId === price.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(price)} disabled={saving} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                        Saqlash
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">
                        Bekor
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(price)} className="text-xs text-gray-500 hover:text-blue-600 hover:underline">
                      O'zgartirish
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Yuklanmoqda...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
