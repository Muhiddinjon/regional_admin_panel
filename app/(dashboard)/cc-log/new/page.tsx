'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function getTashkentToday() {
  const now = new Date()
  const tz = new Date(now.getTime() + 5 * 60 * 60 * 1000)
  return tz.toISOString().split('T')[0]
}

export default function NewCCLogPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: getTashkentToday(),
    cc_name: '',
    total_incoming: '',
    client_calls: '',
    regular_driver_calls: '',
    elite_driver_calls: '',
    resolved_by_cc: '',
    escalated_to_rm: '',
    escalated_to_pm: '',
    outgoing_inactive: '',
    outgoing_inactive_responded: '',
    outgoing_onboarding: '',
    notes: '',
  })

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/cc-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        cc_name: form.cc_name,
        total_incoming: Number(form.total_incoming) || 0,
        client_calls: Number(form.client_calls) || 0,
        regular_driver_calls: Number(form.regular_driver_calls) || 0,
        elite_driver_calls: Number(form.elite_driver_calls) || 0,
        resolved_by_cc: Number(form.resolved_by_cc) || 0,
        escalated_to_rm: Number(form.escalated_to_rm) || 0,
        escalated_to_pm: Number(form.escalated_to_pm) || 0,
        outgoing_inactive: Number(form.outgoing_inactive) || 0,
        outgoing_inactive_responded: Number(form.outgoing_inactive_responded) || 0,
        outgoing_onboarding: Number(form.outgoing_onboarding) || 0,
        notes: form.notes || null,
      }),
    })
    if (res.ok) {
      router.push('/cc-log')
      router.refresh()
    } else {
      alert('Xatolik yuz berdi')
    }
    setSaving(false)
  }

  const sections = [
    {
      title: 'Kiruvchi qo\'ng\'iroqlar',
      fields: [
        { key: 'total_incoming', label: 'Jami kiruvchi' },
        { key: 'client_calls', label: 'Mijoz qo\'ng\'iroqlari' },
        { key: 'regular_driver_calls', label: 'Regular driver' },
        { key: 'elite_driver_calls', label: 'Elite driver' },
      ],
    },
    {
      title: 'Yo\'naltirish',
      fields: [
        { key: 'resolved_by_cc', label: 'CC hal qildi' },
        { key: 'escalated_to_rm', label: 'RM ga yo\'naltirildi' },
        { key: 'escalated_to_pm', label: 'PM ga yo\'naltirildi' },
      ],
    },
    {
      title: 'Chiquvchi qo\'ng\'iroqlar',
      fields: [
        { key: 'outgoing_inactive', label: 'Inaktiv driverlarga' },
        { key: 'outgoing_inactive_responded', label: 'Javob berdi' },
        { key: 'outgoing_onboarding', label: 'Onboarding' },
      ],
    },
  ]

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <h1 className="text-lg font-bold text-gray-900">Yangi CC Log</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sana</label>
              <input type="date" value={form.date}
                onChange={(e) => update('date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CC Ism</label>
              <input type="text" value={form.cc_name} placeholder="Ism Familya"
                onChange={(e) => update('cc_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required />
            </div>
          </div>
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">{section.title}</p>
            <div className="grid grid-cols-2 gap-3">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                  <input
                    type="number" min="0"
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Izoh</label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)}
            rows={3} placeholder="Qo'shimcha izohlar..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Bekor qilish
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </form>
    </div>
  )
}
