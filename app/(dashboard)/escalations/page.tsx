import supabase from '@/lib/supabase-db'
import { formatDate } from '@/lib/utils'
import ResolveButton from './ResolveButton'

async function getEscalations() {
  const { data } = await supabase
    .from('escalations')
    .select('*, drivers(name, phone)')
    .order('created_at', { ascending: false })
    .limit(100)
  return (data ?? []).map((e) => ({
    ...e,
    driver_name: (e.drivers as { name: string } | null)?.name ?? null,
    driver_phone: (e.drivers as { phone: string } | null)?.phone ?? null,
  }))
}

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  escalated: 'bg-orange-100 text-orange-700',
}
const statusLabels: Record<string, string> = {
  open: 'Ochiq',
  resolved: 'Hal qilindi',
  escalated: 'Eskalatsiya',
}

export default async function EscalationsPage() {
  const escalations = await getEscalations()
  const openCount = escalations.filter((e) => e.status === 'open').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">Eskalatsiyalar</h1>
        <span className="text-sm text-gray-500">{openCount} ochiq</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Sana</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Driver</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Sabab</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Manba</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {escalations.map((esc) => (
              <tr key={esc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{formatDate(esc.date)}</td>
                <td className="px-4 py-3">
                  {esc.driver_name ? (
                    <div>
                      <p className="font-medium text-gray-900">{esc.driver_name}</p>
                      <p className="text-xs text-gray-400">{esc.driver_phone}</p>
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-xs">
                  <p>{esc.reason}</p>
                  {esc.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{esc.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 uppercase text-xs">{esc.source}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[esc.status] ?? ''}`}>
                    {statusLabels[esc.status] ?? esc.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {esc.status === 'open' && <ResolveButton id={esc.id} />}
                </td>
              </tr>
            ))}
            {escalations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Eskalatsiyalar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
