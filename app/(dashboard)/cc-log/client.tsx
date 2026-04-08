'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CCLog {
  date: string
  cc_name: string
  total_incoming: number
  client_calls: number
  regular_driver_calls: number
  elite_driver_calls: number
  resolved_by_cc: number
  escalated_to_rm: number
  escalated_to_pm: number
  outgoing_inactive: number
  outgoing_inactive_responded: number
  outgoing_onboarding: number
  notes: string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CCLogClient({ logs: initialLogs, role }: { logs: CCLog[]; role: string }) {
  const isPm = role === 'pm'
  const router = useRouter()
  const [logs, setLogs] = useState<CCLog[]>(initialLogs)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(date: string) {
    if (!confirm(`${fmtDate(date)} logni o'chirasizmi?`)) return
    setDeleting(date)
    try {
      const res = await fetch('/api/cc-log', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (!res.ok) throw new Error('Xatolik')
      setLogs((prev) => prev.filter((l) => l.date !== date))
    } catch {
      alert("O'chirishda xatolik")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">CC Log</h1>
        <Link href="/cc-log/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Yangi log
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-500">Sana</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">CC</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Jami kiruvchi</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Mijoz</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Regular</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Elite</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">CC hal qildi</th>
              <th className="px-3 py-3 text-right font-medium text-orange-600">RM ga</th>
              <th className="px-3 py-3 text-right font-medium text-purple-600">PM ga</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Inaktiv chiquvchi</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Javob berdi</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Onboarding</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">Izoh</th>
              {isPm && <th className="px-3 py-3 text-left font-medium text-gray-500">Amallar</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.date} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium text-gray-700">{fmtDate(log.date)}</td>
                <td className="px-3 py-3 text-gray-600">{log.cc_name}</td>
                <td className="px-3 py-3 text-right font-semibold text-gray-900">{log.total_incoming}</td>
                <td className="px-3 py-3 text-right text-gray-600">{log.client_calls}</td>
                <td className="px-3 py-3 text-right text-gray-600">{log.regular_driver_calls}</td>
                <td className="px-3 py-3 text-right text-blue-700 font-medium">{log.elite_driver_calls}</td>
                <td className="px-3 py-3 text-right text-green-700">{log.resolved_by_cc}</td>
                <td className="px-3 py-3 text-right">
                  {log.escalated_to_rm > 0 ? (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{log.escalated_to_rm}</span>
                  ) : <span className="text-gray-400">0</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  {log.escalated_to_pm > 0 ? (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{log.escalated_to_pm}</span>
                  ) : <span className="text-gray-400">0</span>}
                </td>
                <td className="px-3 py-3 text-right text-gray-600">{log.outgoing_inactive}</td>
                <td className="px-3 py-3 text-right text-gray-600">{log.outgoing_inactive_responded}</td>
                <td className="px-3 py-3 text-right text-gray-600">{log.outgoing_onboarding}</td>
                <td className="px-3 py-3 text-gray-400 max-w-xs truncate">{log.notes || '—'}</td>
                {isPm && (
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/cc-log/edit/${log.date}`}
                        className="text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                      >
                        ✎ Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(log.date)}
                        disabled={deleting === log.date}
                        className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                      >
                        {deleting === log.date ? '...' : '🗑'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={isPm ? 14 : 13} className="px-4 py-10 text-center text-gray-400">
                  Hozircha log yozuvlari yo&apos;q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
