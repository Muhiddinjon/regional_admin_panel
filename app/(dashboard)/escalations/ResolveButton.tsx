'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ResolveButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleResolve() {
    setLoading(true)
    await fetch('/api/escalations/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleResolve}
      disabled={loading}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      {loading ? '...' : 'Hal qilish'}
    </button>
  )
}
