'use client'

import { useEffect, useState, useCallback } from 'react'

type ReportData = {
  date_from: string
  date_to: string
  region: string
  total_done: number
  elite_done: number
  regular_done: number
  elite_share: number
  total_rejected: number
  reject_rate: number
  active_drivers: number
  elite_active: number
  elite_total: number
  coverage: number
  daily: {
    day: string
    total_done: number
    elite_done: number
    regular_done: number
    total_rejected: number
  }[]
  top_elite: {
    driver_id: number
    name: string
    phone_number: string | null
    done_orders: number
  }[]
}

function toLocalDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getTashkentToday(): string {
  const now = new Date()
  const tzOffset = 5 * 60 // UTC+5
  const tashkentNow = new Date(now.getTime() + tzOffset * 60 * 1000)
  return tashkentNow.toISOString().split('T')[0]
}

function getTashkentMonthStart(): string {
  const today = getTashkentToday()
  return today.slice(0, 7) + '-01'
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

type Preset = '7d' | '30d' | 'month' | 'custom'

export default function ReportsPage() {
  const today = getTashkentToday()
  const monthStart = getTashkentMonthStart()

  const [preset, setPreset] = useState<Preset>('month')
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo, setDateTo] = useState(today)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback((from: string, to: string) => {
    setLoading(true)
    setError(null)
    fetch(`/api/reports/auto/3?date_from=${from}&date_to=${to}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchReport(dateFrom, dateTo)
  }, []) // eslint-disable-line

  function applyPreset(p: Preset) {
    setPreset(p)
    const t = getTashkentToday()
    if (p === '7d') {
      const f = toLocalDate(new Date(new Date(t).getTime() - 6 * 86400000))
      setDateFrom(f); setDateTo(t); fetchReport(f, t)
    } else if (p === '30d') {
      const f = toLocalDate(new Date(new Date(t).getTime() - 29 * 86400000))
      setDateFrom(f); setDateTo(t); fetchReport(f, t)
    } else if (p === 'month') {
      const f = getTashkentMonthStart()
      setDateFrom(f); setDateTo(t); fetchReport(f, t)
    }
    // 'custom' — just switch mode, don't fetch yet
  }

  function handleCustomApply() {
    fetchReport(dateFrom, dateTo)
  }

  const presets: { key: Preset; label: string }[] = [
    { key: '7d', label: 'So\'nggi 7 kun' },
    { key: '30d', label: 'So\'nggi 30 kun' },
    { key: 'month', label: 'Shu oy' },
    { key: 'custom', label: 'Boshqa' },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">Hisobotlar</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Andijon · Avtomatik</span>
      </div>

      {/* Date picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                preset === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}

          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">—</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCustomApply}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Ko'rsatish
              </button>
            </div>
          )}
        </div>

        {data && !loading && (
          <p className="text-xs text-gray-400 mt-2">
            {fmtDate(data.date_from)} – {fmtDate(data.date_to)} · {data.region}
          </p>
        )}
      </div>

      {loading && <div className="text-center py-16 text-gray-400">Yuklanmoqda...</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
          Xatolik: {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Jami done (Andijon)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_done.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Elite done</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {data.elite_done.toLocaleString()}
                <span className="text-sm font-normal text-gray-400 ml-1">({data.elite_share}%)</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Oddiy driver done</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">{data.regular_done.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Reject rate</p>
              <p className={`text-2xl font-bold mt-1 ${data.reject_rate >= 25 ? 'text-red-600' : 'text-gray-900'}`}>
                {data.reject_rate}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Faol driverlar (jami)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.active_drivers.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Elite coverage</p>
              <p className={`text-2xl font-bold mt-1 ${data.coverage < 50 ? 'text-red-600' : data.coverage < 80 ? 'text-orange-600' : 'text-green-600'}`}>
                {data.elite_active}/{data.elite_total}
                <span className="text-sm font-normal ml-1">({data.coverage}%)</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Jami rejected</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">{data.total_rejected.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Elite ulushi</p>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${data.elite_share}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.elite_share}% Elite · {100 - data.elite_share}% Oddiy</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Daily breakdown table */}
            {data.daily.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">Kunlik taqsimot</p>
                </div>
                <div className="overflow-y-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Kun</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Jami</th>
                        <th className="px-4 py-2 text-right font-medium text-blue-600">Elite</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Oddiy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...data.daily].reverse().map((row) => (
                        <tr key={row.day} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600">{fmtDate(row.day)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-900">{row.total_done}</td>
                          <td className="px-4 py-2 text-right text-blue-700 font-medium">{row.elite_done}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{row.regular_done}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top elite drivers */}
            {data.top_elite.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">Top Elite driverlar</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500 w-8">#</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Ism</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Telefon</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Done</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.top_elite.map((d, i) => (
                      <tr key={d.driver_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{d.name}</td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{d.phone_number ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold text-blue-700">{d.done_orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
