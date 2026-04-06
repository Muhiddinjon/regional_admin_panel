import { redis, K } from '@/lib/redis'
import Link from 'next/link'

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

function toLog(raw: Record<string, unknown>): CCLog {
  const n = (k: string) => Number(raw[k] ?? 0)
  return {
    date: String(raw.date ?? ''),
    cc_name: String(raw.cc_name ?? ''),
    total_incoming: n('total_incoming'),
    client_calls: n('client_calls'),
    regular_driver_calls: n('regular_driver_calls'),
    elite_driver_calls: n('elite_driver_calls'),
    resolved_by_cc: n('resolved_by_cc'),
    escalated_to_rm: n('escalated_to_rm'),
    escalated_to_pm: n('escalated_to_pm'),
    outgoing_inactive: n('outgoing_inactive'),
    outgoing_inactive_responded: n('outgoing_inactive_responded'),
    outgoing_onboarding: n('outgoing_onboarding'),
    notes: String(raw.notes ?? ''),
  }
}

async function getCCLogs(): Promise<CCLog[]> {
  const dates = await redis.zrange(K.CC_LOGS, 0, -1, { rev: true })
  if (!dates || dates.length === 0) return []
  const raws = await Promise.all((dates as string[]).slice(0, 60).map(d => redis.hgetall(K.CC_LOG(d))))
  return raws.filter(Boolean).map(r => toLog(r as Record<string, unknown>))
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function CCLogPage() {
  const logs = await getCCLogs()

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
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-gray-400">Hozircha log yozuvlari yo'q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
