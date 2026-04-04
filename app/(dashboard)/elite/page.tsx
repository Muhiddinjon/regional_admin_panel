'use client'

import { useEffect, useState } from 'react'

type Driver = {
  id: number
  first_name: string | null
  last_name: string | null
  phone_number: string
  done_month: number
  total_done: number
  rejected_month: number
  reject_rate: number
  last_order_date: string | null
  last_offer_date: string | null
  inactive_days: number
  avg_rating: number | null
  has_priority: boolean
}

type CallRecord = { driver_id: string; called_at: string; result: string }
type PmRecord = { driver_id: string; called_at: string }
type FilterType = 'all' | 'active' | 'call' | 'remove'

const CALL_RESULTS = [
  { key: 'answered', label: 'Javob berdi', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { key: 'no_answer', label: 'Javob bermadi', color: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  { key: 'callback', label: "Qayta qo'ng'iroq", color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
] as const

const RESULT_BADGE: Record<string, string> = {
  answered: 'bg-green-100 text-green-700',
  no_answer: 'bg-gray-100 text-gray-500',
  callback: 'bg-yellow-100 text-yellow-700',
}
const RESULT_LABEL: Record<string, string> = {
  answered: 'Javob berdi',
  no_answer: 'Javob bermadi',
  callback: "Qayta qo'ng'iroq",
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getInactiveBadge(days: number): { label: string; color: string } {
  if (days >= 9999) return { label: 'Hech qachon', color: 'bg-gray-100 text-gray-600' }
  if (days >= 15) return { label: `${days} kun`, color: 'bg-red-100 text-red-700' }
  if (days >= 8) return { label: `${days} kun`, color: 'bg-orange-100 text-orange-700' }
  return { label: `${days} kun`, color: 'bg-green-100 text-green-700' }
}

export default function ElitePage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [callMap, setCallMap] = useState<Map<string, CallRecord>>(new Map())
  const [pmMap, setPmMap] = useState<Map<string, PmRecord>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [openCallId, setOpenCallId] = useState<number | null>(null)
  const [selectedResult, setSelectedResult] = useState<string | null>(null)
  const [callNote, setCallNote] = useState('')
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/elite/3').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
      fetch('/api/elite-calls').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
    ])
      .then(([driverData, callData]: [Driver[], { calls: CallRecord[]; pm_escalations: PmRecord[] }]) => {
        setDrivers(driverData)
        setCallMap(new Map(callData.calls.map((c) => [c.driver_id, c])))
        setPmMap(new Map(callData.pm_escalations.map((p) => [p.driver_id, p])))
        setLoading(false)
      })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  function openCall(driverId: number) {
    setOpenCallId(driverId)
    setSelectedResult(null)
    setCallNote('')
  }

  async function saveAction(driverId: number, result: string, note?: string) {
    setSaving(driverId)
    setOpenCallId(null)
    setSelectedResult(null)
    setCallNote('')
    try {
      const res = await fetch('/api/elite-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, result, note: note || undefined }),
      })
      if (!res.ok) throw new Error('Xatolik')
      const saved: { called_at: string } = await res.json()
      const key = String(driverId)
      if (result === 'pm_escalated') {
        setPmMap((prev) => new Map(prev).set(key, { driver_id: key, called_at: saved.called_at }))
      } else {
        setCallMap((prev) => new Map(prev).set(key, { driver_id: key, called_at: saved.called_at, result }))
      }
    } catch { /* silent */ } finally {
      setSaving(null)
    }
  }

  const callCount = drivers.filter((d) => d.inactive_days >= 8 && d.inactive_days < 15).length
  const removeCount = drivers.filter((d) => d.inactive_days >= 15).length

  const filtered = drivers.filter((d) => {
    if (filter === 'active') return d.inactive_days < 8
    if (filter === 'call') return d.inactive_days >= 8 && d.inactive_days < 15
    if (filter === 'remove') return d.inactive_days >= 15
    return true
  })

  const filters: { key: FilterType; label: string; badge?: number; badgeColor?: string }[] = [
    { key: 'all', label: 'Barcha' },
    { key: 'active', label: 'Faol (< 8 kun)' },
    { key: 'call', label: 'Call qilish (8–14 kun)', badge: callCount, badgeColor: 'bg-orange-100 text-orange-700' },
    { key: 'remove', label: 'Chetlatish (≥ 15 kun)', badge: removeCount, badgeColor: 'bg-red-100 text-red-700' },
  ]

  return (
    <div className="p-6" onClick={() => { setOpenCallId(null); setSelectedResult(null); setCallNote('') }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Elite-50 Driverlar</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {drivers.length} ta driver · {drivers.filter((d) => d.done_month > 0).length} ta shu oy faol
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Andijon</span>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
            {f.badge !== undefined && f.badge > 0 && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-white/20 text-white' : f.badgeColor}`}>
                {f.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-16 text-gray-400">Yuklanmoqda...</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">Xatolik: {error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-8">#</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Ism Familya</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Telefon</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">Done (oy)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">Done (jami)</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">Reject%</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">Reyting</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Oxirgi order</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Inaktiv</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Harakat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((driver, idx) => {
                const badge = getInactiveBadge(driver.inactive_days)
                const name = [driver.first_name, driver.last_name].filter(Boolean).join(' ') || '—'
                const key = String(driver.id)
                const call = callMap.get(key)
                const pm = pmMap.get(key)
                const isCallGroup = driver.inactive_days >= 8 && driver.inactive_days < 15
                const isRemoveGroup = driver.inactive_days >= 15
                const isOpen = openCallId === driver.id
                const isSaving = saving === driver.id

                return (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{name}</td>
                    <td className="px-3 py-3 text-gray-600 font-mono text-xs">{driver.phone_number}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={driver.done_month > 0 ? 'font-semibold text-gray-900' : 'text-gray-400'}>
                        {driver.done_month}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600">{driver.total_done}</td>
                    <td className="px-3 py-3 text-right">
                      {driver.reject_rate > 0 ? (
                        <span className={driver.reject_rate >= 20 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {driver.reject_rate}%
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600">
                      {driver.avg_rating != null ? driver.avg_rating.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{formatDate(driver.last_order_date)}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>

                    {/* Harakat ustuni */}
                    <td className="px-3 py-3">
                      {(isCallGroup || isRemoveGroup) && (
                        <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {/* Call bloki */}
                          <div className="flex flex-col gap-0.5">
                            {call && (
                              <>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_BADGE[call.result]}`}>
                                  {RESULT_LABEL[call.result]}
                                </span>
                                <span className="text-gray-400 text-xs">{formatDate(call.called_at)}</span>
                              </>
                            )}
                            <button
                              disabled={isSaving}
                              onClick={() => isOpen ? (setOpenCallId(null), setSelectedResult(null), setCallNote('')) : openCall(driver.id)}
                              className="text-xs px-2 py-0.5 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-40 w-fit"
                            >
                              {isSaving ? '...' : call ? '↺ Call' : '📞 Call'}
                            </button>

                            {/* Dropdown: natija + izoh + saqlash */}
                            {isOpen && (
                              <div className="absolute z-10 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex flex-col gap-2 min-w-[200px]">
                                <div className="flex flex-col gap-1">
                                  {CALL_RESULTS.map((r) => (
                                    <button
                                      key={r.key}
                                      onClick={() => setSelectedResult(r.key)}
                                      className={`text-xs px-3 py-1.5 rounded-lg font-medium text-left transition border-2 ${
                                        selectedResult === r.key
                                          ? 'border-blue-400 ' + r.color
                                          : 'border-transparent ' + r.color
                                      }`}
                                    >
                                      {selectedResult === r.key ? '✓ ' : ''}{r.label}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  placeholder="Izoh (ixtiyoriy)..."
                                  value={callNote}
                                  onChange={(e) => setCallNote(e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full outline-none focus:border-blue-400 text-black placeholder:text-gray-400"
                                />
                                <button
                                  disabled={!selectedResult}
                                  onClick={() => selectedResult && saveAction(driver.id, selectedResult, callNote)}
                                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Saqlash
                                </button>
                              </div>
                            )}
                          </div>

                          {/* PM ga yo'naltir */}
                          {pm ? (
                            <span className="text-xs text-purple-600 font-medium whitespace-nowrap">
                              PM ✓ {formatDate(pm.called_at)}
                            </span>
                          ) : (
                            <button
                              disabled={isSaving}
                              onClick={() => saveAction(driver.id, 'pm_escalated')}
                              className="text-xs px-2 py-0.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-40 whitespace-nowrap"
                            >
                              PM ga yo'naltir
                            </button>
                          )}
                        </div>
                      )}

                      {!isCallGroup && !isRemoveGroup && (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                    Hech narsa topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
