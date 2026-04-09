'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import DateRangePicker from '@/components/DateRangePicker'

function getTashkentToday(): string {
  const now = new Date()
  const tashkentNow = new Date(now.getTime() + 5 * 60 * 60 * 1000)
  return tashkentNow.toISOString().split('T')[0]
}

function getTashkentMonthStart(): string {
  return getTashkentToday().slice(0, 7) + '-01'
}

function calcDays(from: string, to: string): number {
  const d1 = new Date(from + 'T00:00:00')
  const d2 = new Date(to + 'T00:00:00')
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
}

function fmtAvg(total: number, days: number): string {
  return (total / days).toFixed(1).replace('.', ',')
}

interface SubRegionRow {
  sub_region_id: number
  name: string
  demand: number
  supply: number
  gap: number
}

interface Candidate {
  id: number
  name: string
  phone_number: string | null
  rating: number | null
  activity_score: number | null
  points: number | null
  done_month: number
  total_done: number
  ignored: boolean
}

type SortKey = 'done_month' | 'total_done' | 'rating' | 'activity_score' | 'points'
type SortDir = 'desc' | 'asc'

interface Props {
  role: string
}

export default function AnalysisClient({ role }: Props) {
  const [dateFrom, setDateFrom] = useState(getTashkentMonthStart())
  const [dateTo, setDateTo] = useState(getTashkentToday())
  const [data, setData] = useState<SubRegionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('done_month')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchAnalysis = useCallback((from: string, to: string) => {
    setLoading(true)
    setSelectedId(null)
    setCandidates([])
    fetch(`/api/elite/analysis?region_id=3&date_from=${from}&date_to=${to}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : Array.isArray(d.rows) ? d.rows : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAnalysis(dateFrom, dateTo)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function selectSubRegion(row: SubRegionRow) {
    if (selectedId === row.sub_region_id) {
      setSelectedId(null)
      setCandidates([])
      return
    }
    setSelectedId(row.sub_region_id)
    setLoadingCandidates(true)
    setCandidates([])
    try {
      const res = await fetch(`/api/elite/analysis/candidates?sub_region_id=${row.sub_region_id}`)
      if (res.ok) setCandidates(await res.json())
    } finally {
      setLoadingCandidates(false)
    }
  }

  async function addDriver(candidate: Candidate) {
    if (addingId === candidate.id) return
    setAddingId(candidate.id)
    try {
      const res = await fetch('/api/elite-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: candidate.id, tier: 'A' }),
      })
      if (res.ok) {
        setCandidates(prev => prev.filter(c => c.id !== candidate.id))
        setData(prev => prev.map(r =>
          r.sub_region_id === selectedId
            ? { ...r, supply: r.supply + 1, gap: r.gap - 1 }
            : r
        ))
      } else {
        alert('Xatolik yuz berdi')
      }
    } finally {
      setAddingId(null)
    }
  }

  const canAdd = ['pm', 'rm', 'ops', 'checker'].includes(role)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity
    const bv = b[sortKey] ?? -Infinity
    return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-blue-500 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Sub-region tahlili — Andijon</h1>
          <p className="text-sm text-gray-500 mt-1">
            Talab: kunlik o&apos;rtacha (unique client×route / kunlar) · Taklif: joriy elite driverlar
          </p>
        </div>
        <DateRangePicker
          startDate={dateFrom}
          endDate={dateTo}
          onStartDateChange={setDateFrom}
          onEndDateChange={(d) => { setDateTo(d); if (d) fetchAnalysis(dateFrom, d) }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sub-region</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Talab/kun</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Taklif</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Gap/kun</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Yuklanmoqda...</td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Ma&apos;lumot yo&apos;q</td>
              </tr>
            ) : (
              data.map((row) => {
                const days = calcDays(dateFrom, dateTo)
                const gapAvg = row.demand / days - row.supply
                const color = gapAvg > 5 ? 'text-red-600' : gapAvg > 2 ? 'text-orange-500' : 'text-green-600'
                const fmt = gapAvg.toFixed(1).replace('.', ',')
                const isOpen = selectedId === row.sub_region_id

                return (
                  <Fragment key={row.sub_region_id}>
                    {/* Sub-region row */}
                    <tr
                      onClick={() => selectSubRegion(row)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtAvg(row.demand, days)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.supply}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${color}`}>
                        {gapAvg > 0 ? `+${fmt}` : fmt}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        {isOpen ? '▲' : '▼'}
                      </td>
                    </tr>

                    {/* Inline dropdown — candidates */}
                    {isOpen && (
                      <tr className="border-b border-gray-200">
                        <td colSpan={5} className="p-0">
                          <div className="bg-gray-50 border-t border-gray-100">
                            {loadingCandidates ? (
                              <div className="px-6 py-5 text-center text-sm text-gray-400">Yuklanmoqda...</div>
                            ) : candidates.length === 0 ? (
                              <div className="px-6 py-5 text-center text-sm text-gray-400">Kandidat topilmadi</div>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 bg-gray-100">
                                    <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs">#</th>
                                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Ism</th>
                                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Tel</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-gray-800" onClick={() => toggleSort('rating')}>
                                      Rating<SortIcon col="rating" />
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-gray-800" onClick={() => toggleSort('activity_score')}>
                                      Faollik<SortIcon col="activity_score" />
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-gray-800" onClick={() => toggleSort('points')}>
                                      Ball<SortIcon col="points" />
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-gray-800" onClick={() => toggleSort('done_month')}>
                                      Oy done<SortIcon col="done_month" />
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-gray-800" onClick={() => toggleSort('total_done')}>
                                      Jami done<SortIcon col="total_done" />
                                    </th>
                                    {canAdd && <th className="px-4 py-2.5 w-24"></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedCandidates.map((c, i) => (
                                    <tr key={c.id} className={`border-b border-gray-100 ${c.ignored ? 'opacity-50' : 'hover:bg-white'}`}>
                                      <td className="px-6 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                      <td className="px-4 py-2.5 font-medium text-gray-900">
                                        {c.name}
                                        {c.ignored && <span className="ml-2 text-xs text-red-400 font-normal">Qo&apos;shilmaydi</span>}
                                      </td>
                                      <td className="px-4 py-2.5 text-gray-600 text-xs">{c.phone_number ?? '—'}</td>
                                      <td className="px-4 py-2.5 text-right text-gray-700 text-xs">
                                        {c.rating != null ? c.rating.toFixed(1) : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-gray-700 text-xs">
                                        {c.activity_score != null ? c.activity_score : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-gray-700 text-xs">
                                        {c.points != null ? c.points : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 text-xs">{c.done_month}</td>
                                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{c.total_done}</td>
                                      {canAdd && (
                                        <td className="px-4 py-2.5 text-right">
                                          {!c.ignored && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); addDriver(c) }}
                                              disabled={addingId === c.id}
                                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                            >
                                              {addingId === c.id ? '...' : '+ Elite'}
                                            </button>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
