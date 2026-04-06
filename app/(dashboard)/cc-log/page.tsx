import supabase from '@/lib/supabase-db'
import Link from 'next/link'

async function getCCLogs() {
  const { data } = await supabase
    .from('cc_logs')
    .select('*')
    .order('date', { ascending: false })
    .limit(60)
  return data ?? []
}

function fmt(n: number | null) {
  return n ?? 0
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export default async function CCLogPage() {
  const logs = await getCCLogs()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">CC Log</h1>
        <Link
          href="/cc-log/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium text-gray-700">{fmtDate(log.date)}</td>
                <td className="px-3 py-3 text-gray-600">{log.cc_name}</td>
                <td className="px-3 py-3 text-right font-semibold text-gray-900">{fmt(log.total_incoming)}</td>
                <td className="px-3 py-3 text-right text-gray-600">{fmt(log.client_calls)}</td>
                <td className="px-3 py-3 text-right text-gray-600">{fmt(log.regular_driver_calls)}</td>
                <td className="px-3 py-3 text-right text-blue-700 font-medium">{fmt(log.elite_driver_calls)}</td>
                <td className="px-3 py-3 text-right text-green-700">{fmt(log.resolved_by_cc)}</td>
                <td className="px-3 py-3 text-right">
                  {fmt(log.escalated_to_rm) > 0 ? (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      {fmt(log.escalated_to_rm)}
                    </span>
                  ) : <span className="text-gray-400">0</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  {fmt(log.escalated_to_pm) > 0 ? (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      {fmt(log.escalated_to_pm)}
                    </span>
                  ) : <span className="text-gray-400">0</span>}
                </td>
                <td className="px-3 py-3 text-right text-gray-600">{fmt(log.outgoing_inactive)}</td>
                <td className="px-3 py-3 text-right text-gray-600">{fmt(log.outgoing_inactive_responded)}</td>
                <td className="px-3 py-3 text-right text-gray-600">{fmt(log.outgoing_onboarding)}</td>
                <td className="px-3 py-3 text-gray-400 max-w-xs truncate">{log.notes || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-gray-400">
                  Hozircha log yozuvlari yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
