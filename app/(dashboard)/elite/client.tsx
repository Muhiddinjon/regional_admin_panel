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

type CallRecord = { driver_id: string; called_at: string; result: string; note?: string }
type PmRecord = { driver_id: string; called_at: string }
type FilterType = 'all' | 'active' | 'call' | 'remove' | 'diamond' | 'no_diamond'
type SortCol = 'done_month' | 'total_done' | 'reject_rate' | 'avg_rating' | 'inactive_days'

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

export default function EliteClient({ role }: { role: string }) {
  const isPm = role === 'pm'

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

  // Edit call state
  const [editCallId, setEditCallId] = useState<number | null>(null)
  const [editResult, setEditResult] = useState<string>('')
  const [editNote, setEditNote] = useState('')

  // Edit PM state
  const [editPmId, setEditPmId] = useState<number | null>(null)

  // Search
  const [search, setSearch] = useState('')

  // Pagination
  const PAGE_SIZE = 25
  const [page, setPage] = useState(1)

  // Sort state
  const [sortCol, setSortCol] = useState<SortCol>('inactive_days')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addDriverId, setAddDriverId] = useState('')
  const [addTier, setAddTier] = useState('A')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  function loadData() {
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
  }

  useEffect(() => { loadData() }, [])

  function openCall(driverId: number) {
    setOpenCallId(driverId)
    setSelectedResult(null)
    setCallNote('')
  }

  function openEditCall(driverId: number, currentResult: string, currentNote: string) {
    setEditCallId(driverId)
    setEditResult(currentResult)
    setEditNote(currentNote)
    setOpenCallId(null)
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

  async function saveEditCall(driverId: number) {
    if (!editResult) return
    setSaving(driverId)
    setEditCallId(null)
    try {
      const res = await fetch('/api/elite-calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, result: editResult, note: editNote || undefined }),
      })
      if (!res.ok) throw new Error('Xatolik')
      const saved: { called_at: string } = await res.json()
      const key = String(driverId)
      setCallMap((prev) => new Map(prev).set(key, { driver_id: key, called_at: saved.called_at, result: editResult }))
    } catch { /* silent */ } finally {
      setSaving(null)
    }
  }

  async function saveEditPm(driverId: number) {
    setSaving(driverId)
    setEditPmId(null)
    try {
      const res = await fetch('/api/elite-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, result: 'pm_escalated' }),
      })
      if (!res.ok) throw new Error('Xatolik')
      const saved: { called_at: string } = await res.json()
      const key = String(driverId)
      setPmMap((prev) => new Map(prev).set(key, { driver_id: key, called_at: saved.called_at }))
    } catch { /* silent */ } finally {
      setSaving(null)
    }
  }

  async function cancelPm(driverId: number) {
    setSaving(driverId)
    setEditPmId(null)
    try {
      await fetch('/api/elite-calls', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId }),
      })
      const key = String(driverId)
      setPmMap((prev) => { const m = new Map(prev); m.delete(key); return m })
    } catch { /* silent */ } finally {
      setSaving(null)
    }
  }

  async function addDriver() {
    const id = parseInt(addDriverId, 10)
    if (!id) { setAddError("Driver ID kiritilmadi"); return }
    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch('/api/elite-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: id, tier: addTier, added_by: 'admin' }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Xatolik'); return }
      setShowAddModal(false)
      setAddDriverId('')
      setAddTier('A')
      loadData()
    } catch { setAddError('Server xatosi') } finally { setAddLoading(false) }
  }

  async function removeDriver(driverId: number, name: string) {
    if (!confirm(`"${name}" ni elite dan chiqarasizmi?`)) return
    try {
      const res = await fetch('/api/elite-manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId }),
      })
      if (!res.ok) throw new Error('Xatolik')
      loadData()
    } catch { alert("O'chirishda xatolik") }
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  function sortIndicator(col: SortCol) {
    if (sortCol !== col) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const callCount = drivers.filter((d) => d.inactive_days >= 8 && d.inactive_days < 15).length
  const removeCount = drivers.filter((d) => d.inactive_days >= 15).length
  const diamondCount = drivers.filter((d) => d.has_priority).length
  const noDiamondCount = drivers.filter((d) => !d.has_priority).length

  const searchDigits = search.replace(/\D/g, '')
  const filtered = drivers
    .filter((d) => {
      if (filter === 'active') return d.inactive_days < 8
      if (filter === 'call') return d.inactive_days >= 8 && d.inactive_days < 15
      if (filter === 'remove') return d.inactive_days >= 15
      if (filter === 'diamond') return d.has_priority
      if (filter === 'no_diamond') return !d.has_priority
      return true
    })
    .filter((d) => {
      if (!searchDigits) return true
      return d.phone_number?.replace(/\D/g, '').includes(searchDigits)
    })
    .sort((a, b) => {
      const aVal = a[sortCol] ?? 0
      const bVal = b[sortCol] ?? 0
      const diff = (aVal as number) - (bVal as number)
      return sortDir === 'asc' ? diff : -diff
    })

  const filters: { key: FilterType; label: string; badge?: number; badgeColor?: string }[] = [
    { key: 'all', label: 'Barcha' },
    { key: 'active', label: 'Faol (< 8 kun)' },
    { key: 'call', label: 'Call qilish (8–14 kun)', badge: callCount, badgeColor: 'bg-orange-100 text-orange-700' },
    { key: 'remove', label: 'Chetlatish (≥ 15 kun)', badge: removeCount, badgeColor: 'bg-red-100 text-red-700' },
    { key: 'diamond', label: '💎 Diamond', badge: diamondCount, badgeColor: 'bg-blue-100 text-blue-700' },
    { key: 'no_diamond', label: '⬡ Diamond kutmoqda', badge: noDiamondCount, badgeColor: 'bg-gray-100 text-gray-600' },
  ]

  return (
    <div className="p-6" onClick={() => { setOpenCallId(null); setSelectedResult(null); setCallNote(''); setEditCallId(null); setEditPmId(null) }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Elite-50 Driverlar</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {drivers.length} ta driver · {drivers.filter((d) => d.done_month > 0).length} ta shu oy faol · {diamondCount} ta diamond
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPm && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddModal(true); setAddError(null) }}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              + Driver qo&apos;shish
            </button>
          )}
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Andijon</span>
        </div>
      </div>

      {/* Add modal (pm only) */}
      {isPm && showAddModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-gray-900 text-base">Driver qo&apos;shish</h2>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Driver ID</label>
              <input
                type="number"
                placeholder="Masalan: 377087"
                value={addDriverId}
                onChange={(e) => setAddDriverId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-black placeholder:text-gray-400"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Tier</label>
              <select
                value={addTier}
                onChange={(e) => setAddTier(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-black"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddModal(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              >
                Bekor
              </button>
              <button
                onClick={addDriver}
                disabled={addLoading}
                className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {addLoading ? '...' : "Qo'shish"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Telefon raqam bo'yicha..."
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-blue-400 w-52"
          onClick={(e) => e.stopPropagation()}
        />
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1) }}
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-8">#</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Ism Familya</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Telefon</th>
                <th
                  className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                  onClick={() => toggleSort('done_month')}
                >
                  Done (oy){sortIndicator('done_month')}
                </th>
                <th
                  className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                  onClick={() => toggleSort('total_done')}
                >
                  Done (jami){sortIndicator('total_done')}
                </th>
                <th
                  className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                  onClick={() => toggleSort('reject_rate')}
                >
                  Reject%{sortIndicator('reject_rate')}
                </th>
                <th
                  className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                  onClick={() => toggleSort('avg_rating')}
                >
                  Reyting{sortIndicator('avg_rating')}
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Oxirgi order</th>
                <th
                  className="px-3 py-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
                  onClick={() => toggleSort('inactive_days')}
                >
                  Inaktiv{sortIndicator('inactive_days')}
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Harakat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((driver, idx) => {
                const badge = getInactiveBadge(driver.inactive_days)
                const name = [driver.first_name, driver.last_name].filter(Boolean).join(' ') || '—'
                const key = String(driver.id)
                const call = callMap.get(key)
                const pm = pmMap.get(key)
                const isCallGroup = driver.inactive_days >= 8 && driver.inactive_days < 15
                const isRemoveGroup = driver.inactive_days >= 15
                const isOpen = openCallId === driver.id
                const isEditCall = editCallId === driver.id
                const isEditPm = editPmId === driver.id
                const isSaving = saving === driver.id

                return (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">
                      <span className="flex items-center gap-1.5">
                        {driver.has_priority && <span title="Diamond driver">💎</span>}
                        {name}
                      </span>
                    </td>
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
                      <div className="flex items-center gap-2">
                        {(isCallGroup || isRemoveGroup) && (
                          <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Call bloki */}
                            <div className="flex flex-col gap-0.5">
                              {call && !isEditCall && (
                                <>
                                  <div className="flex items-center gap-1">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_BADGE[call.result]}`}>
                                      {RESULT_LABEL[call.result]}
                                    </span>
                                    <button
                                      onClick={() => openEditCall(driver.id, call.result, call.note || '')}
                                      className="text-xs text-gray-400 hover:text-blue-600 transition"
                                      title="Tahrirlash"
                                    >
                                      ✎
                                    </button>
                                  </div>
                                  <span className="text-gray-400 text-xs">{formatDate(call.called_at)}</span>
                                  {call.note && (
                                    <span className="text-gray-400 text-xs italic truncate max-w-[140px]" title={call.note}>{call.note}</span>
                                  )}
                                </>
                              )}

                              {/* Edit call dropdown */}
                              {isEditCall && (
                                <div className="absolute z-10 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex flex-col gap-2 min-w-[200px]">
                                  <div className="flex flex-col gap-1">
                                    {CALL_RESULTS.map((r) => (
                                      <button
                                        key={r.key}
                                        onClick={() => setEditResult(r.key)}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-medium text-left transition border-2 ${
                                          editResult === r.key
                                            ? 'border-blue-400 ' + r.color
                                            : 'border-transparent ' + r.color
                                        }`}
                                      >
                                        {editResult === r.key ? '✓ ' : ''}{r.label}
                                      </button>
                                    ))}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Izoh (ixtiyoriy)..."
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full outline-none focus:border-blue-400 bg-white text-black placeholder:text-gray-400"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setEditCallId(null)}
                                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex-1"
                                    >
                                      Bekor
                                    </button>
                                    <button
                                      disabled={!editResult}
                                      onClick={() => saveEditCall(driver.id)}
                                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 flex-1"
                                    >
                                      Saqlash
                                    </button>
                                  </div>
                                </div>
                              )}

                              {!call && !isEditCall && (
                                <button
                                  disabled={isSaving}
                                  onClick={() => isOpen ? (setOpenCallId(null), setSelectedResult(null), setCallNote('')) : openCall(driver.id)}
                                  className="text-xs px-2 py-0.5 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-40 w-fit"
                                >
                                  {isSaving ? '...' : '📞 Call'}
                                </button>
                              )}

                              {call && !isEditCall && (
                                <button
                                  disabled={isSaving}
                                  onClick={() => isOpen ? (setOpenCallId(null), setSelectedResult(null), setCallNote('')) : openCall(driver.id)}
                                  className="text-xs px-2 py-0.5 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-40 w-fit"
                                >
                                  {isSaving ? '...' : '↺ Call'}
                                </button>
                              )}

                              {/* New call dropdown */}
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
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full outline-none focus:border-blue-400 bg-white text-black placeholder:text-gray-400"
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
                            {pm && !isEditPm ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-purple-600 font-medium whitespace-nowrap">
                                  PM ✓ {formatDate(pm.called_at)}
                                </span>
                                <button
                                  onClick={() => setEditPmId(driver.id)}
                                  className="text-xs text-gray-400 hover:text-purple-600 transition"
                                  title="Qayta yuborish"
                                >
                                  ✎
                                </button>
                              </div>
                            ) : isEditPm ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => cancelPm(driver.id)}
                                  disabled={isSaving}
                                  className="text-xs px-2 py-0.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-40"
                                >
                                  Bekor qilish
                                </button>
                                <button
                                  onClick={() => saveEditPm(driver.id)}
                                  disabled={isSaving}
                                  className="text-xs px-2 py-0.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-40"
                                >
                                  Qayta yuborish
                                </button>
                                <button
                                  onClick={() => setEditPmId(null)}
                                  className="text-xs px-2 py-0.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={isSaving}
                                onClick={() => saveAction(driver.id, 'pm_escalated')}
                                className="text-xs px-2 py-0.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-40 whitespace-nowrap"
                              >
                                PM ga yo&apos;naltir
                              </button>
                            )}
                          </div>
                        )}

                        {!isCallGroup && !isRemoveGroup && (
                          <span className="text-gray-300 text-xs">—</span>
                        )}

                        {/* O'chirish tugmasi (pm only) */}
                        {isPm && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeDriver(driver.id, name) }}
                            className="text-xs px-2 py-0.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition ml-auto"
                            title="Elite dan chiqarish"
                          >
                            O&apos;chirish
                          </button>
                        )}
                      </div>
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
            {filtered.length > PAGE_SIZE && (
              <tfoot>
                <tr className="border-t border-gray-100">
                  <td colSpan={10} className="px-4 py-3">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page === 1}
                        className="text-sm px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                      >
                        ←
                      </button>
                      <span className="text-sm text-gray-600">
                        {page} / {Math.ceil(filtered.length / PAGE_SIZE)}
                      </span>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
                        className="text-sm px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                      >
                        →
                      </button>
                      <span className="text-xs text-gray-400">{filtered.length} ta</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
