'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DBRoute {
  from_region_id: number
  from_region_name: string
  std_base: number
  eco_base: number
  departure_subs: Record<string, { id: string; name: string; price: number; status: boolean }[]>
  seats: Record<string, { variant: number; price: number; available: boolean }[]>
  tariff_active: Record<string, boolean>
}

interface SubRow {
  id: string
  name: string
  db_price: number
  db_status: boolean
  researched: number | null
}

interface SeatRow {
  variant: number
  db_price: number
  db_available: boolean
  target_available: boolean | null
}

interface TariffSection {
  tariff_id: string
  db_active: boolean
  target_active: boolean | null
  subs: SubRow[]
  seats: SeatRow[]
  centerSubId: string | null
  centerPrice: string
}

interface NRTariff {
  tariff_id: string
  target_active: boolean | null
  subs: { id: string; name: string; researched: number | null }[]
  seats: { variant: number; target_available: boolean | null }[]
}

interface NRData {
  region_id: number
  status: 'draft' | 'confirmed' | 'entered'
  confirmed_at: string | null
  entered_at: string | null
  tariffs: NRTariff[]
  updated_at: string
}

interface ProgressItem {
  region_id: number
  status: 'draft' | 'confirmed' | 'entered'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TARIFF_ORDER = ['1', '4', '2', '3', 'delivery']
const TARIFF_NAMES: Record<string, string> = {
  '1': 'Standard', '4': 'Economy', '2': 'Comfort', '3': 'Business', 'delivery': 'Delivery',
}
const SEAT_NAMES: Record<number, string> = {
  1: '1 joy', 2: '2 joy', 3: 'Full', 4: '3 joy',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PriceResearchClient({ role }: { role: 'rm' | 'ops' | 'checker' }) {
  const canEdit = role === 'rm' || role === 'ops'
  const canConfirm = role === 'ops'

  const [allRoutes, setAllRoutes] = useState<Record<string, DBRoute>>({})
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [sections, setSections] = useState<TariffSection[]>([])
  const [status, setStatus] = useState<'draft' | 'confirmed' | 'entered'>('draft')
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingRegion, setLoadingRegion] = useState(false)

  useEffect(() => {
    fetch('/api/price-setup/city-ref?all=true')
      .then(r => r.json())
      .then(data => setAllRoutes(data.routes || {}))
      .catch(console.error)
    fetchProgress()
  }, [])

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/price-research?all=true')
      const data = await res.json()
      if (data.regions) {
        setProgress(data.regions.map((r: NRData) => ({
          region_id: r.region_id,
          status: r.status,
        })))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadRegion = useCallback(async (regionId: string) => {
    if (!regionId) return
    setLoadingRegion(true)
    setStatus('draft')

    const route = allRoutes[regionId]
    if (!route) {
      setSections([])
      setLoadingRegion(false)
      return
    }

    // Build sections from DB data
    const builtSections: TariffSection[] = TARIFF_ORDER
      .filter(tid => (route.departure_subs[tid]?.length ?? 0) > 0 || (route.seats[tid]?.length ?? 0) > 0)
      .map(tid => ({
        tariff_id: tid,
        db_active: route.tariff_active?.[tid] ?? true,
        target_active: null,
        subs: (route.departure_subs[tid] ?? []).map(s => ({
          id: s.id,
          name: s.name,
          db_price: s.price,
          db_status: s.status,
          researched: null,
        })),
        seats: tid === 'delivery' ? [] : (route.seats[tid] ?? []).map(s => ({
          variant: s.variant,
          db_price: s.price,
          db_available: s.available,
          target_available: null,
        })),
        centerSubId: null,
        centerPrice: '',
      }))

    // Restore from Redis
    try {
      const res = await fetch(`/api/price-research?region_id=${regionId}`)
      const data = await res.json()
      if (data.found && data.data) {
        const nr: NRData = data.data
        setStatus(nr.status)
        const merged = builtSections.map(section => {
          const savedTariff = nr.tariffs?.find(t => t.tariff_id === section.tariff_id)
          if (!savedTariff) return section
          return {
            ...section,
            target_active: savedTariff.target_active,
            subs: section.subs.map(sub => {
              const saved = savedTariff.subs?.find(ss => ss.id === sub.id)
              return saved ? { ...sub, researched: saved.researched } : sub
            }),
            seats: section.seats.map(seat => {
              const saved = savedTariff.seats?.find(ss => ss.variant === seat.variant)
              return saved ? { ...seat, target_available: saved.target_available } : seat
            }),
          }
        })
        setSections(merged)
      } else {
        setSections(builtSections)
      }
    } catch {
      setSections(builtSections)
    }

    setLoadingRegion(false)
  }, [allRoutes])

  useEffect(() => {
    if (selectedRegion && Object.keys(allRoutes).length > 0) {
      loadRegion(selectedRegion)
    }
  }, [selectedRegion, allRoutes, loadRegion])

  const handleCalculate = (tariffId: string) => {
    setSections(prev => prev.map(section => {
      if (section.tariff_id !== tariffId) return section
      const { centerSubId, centerPrice, subs } = section
      if (!centerSubId || !centerPrice) return section
      const enteredCenter = Number(centerPrice)
      if (isNaN(enteredCenter)) return section
      const centerSub = subs.find(s => s.id === centerSubId)
      if (!centerSub) return section
      const centerDbPrice = centerSub.db_price
      return {
        ...section,
        subs: subs.map(sub => {
          if (sub.id === centerSubId) return { ...sub, researched: enteredCenter }
          return { ...sub, researched: enteredCenter + (sub.db_price - centerDbPrice) }
        }),
      }
    }))
  }

  const handleResearchChange = (tariffId: string, subId: string, value: string) => {
    setSections(prev => prev.map(s =>
      s.tariff_id === tariffId
        ? { ...s, subs: s.subs.map(sub => sub.id === subId ? { ...sub, researched: value === '' ? null : Number(value) } : sub) }
        : s
    ))
  }

  const handleTargetActive = (tariffId: string, value: string) => {
    const target = value === '' ? null : value === 'true'
    setSections(prev => prev.map(s =>
      s.tariff_id === tariffId ? { ...s, target_active: target } : s
    ))
  }

  const handleSeatAvailable = (tariffId: string, variant: number, value: string) => {
    const target = value === '' ? null : value === 'true'
    setSections(prev => prev.map(s =>
      s.tariff_id === tariffId
        ? { ...s, seats: s.seats.map(seat => seat.variant === variant ? { ...seat, target_available: target } : seat) }
        : s
    ))
  }

  const handleCenterSubId = (tariffId: string, value: string) => {
    setSections(prev => prev.map(s =>
      s.tariff_id === tariffId ? { ...s, centerSubId: value || null } : s
    ))
  }

  const handleCenterPrice = (tariffId: string, value: string) => {
    setSections(prev => prev.map(s =>
      s.tariff_id === tariffId ? { ...s, centerPrice: value } : s
    ))
  }

  const ecoStdFullMismatch = (() => {
    const stdFull = sections.find(s => s.tariff_id === '1')?.seats.find(s => s.variant === 3)?.db_price
    const ecoFull = sections.find(s => s.tariff_id === '4')?.seats.find(s => s.variant === 3)?.db_price
    return stdFull !== undefined && ecoFull !== undefined && stdFull !== ecoFull
  })()

  const handleSave = async () => {
    if (!selectedRegion) return
    setSaving(true)
    try {
      await fetch('/api/price-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region_id: Number(selectedRegion),
          tariffs: sections.map(s => ({
            tariff_id: s.tariff_id,
            target_active: s.target_active,
            subs: s.subs
              .filter(sub => sub.researched !== null)
              .map(sub => ({ id: sub.id, name: sub.name, researched: sub.researched })),
            seats: s.seats
              .filter(seat => seat.target_available !== null)
              .map(seat => ({ variant: seat.variant, target_available: seat.target_available })),
          })),
        }),
      })
      await fetchProgress()
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  const handleStatus = async (newStatus: 'confirmed' | 'entered') => {
    if (!selectedRegion) return
    setSaving(true)
    try {
      await fetch('/api/price-research', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region_id: Number(selectedRegion), status: newStatus }),
      })
      setStatus(newStatus)
      await fetchProgress()
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  const getDiffCell = (sub: SubRow) => {
    if (sub.researched === null) return { text: '—', diff: '○', cls: 'text-gray-400' }
    const diff = sub.researched - sub.db_price
    if (diff === 0) return { text: '=0', diff: '✅', cls: 'text-green-600' }
    if (Math.abs(diff) <= 5000) return {
      text: (diff > 0 ? '+' : '') + diff.toLocaleString(), diff: '⚠️', cls: 'text-yellow-600',
    }
    return { text: (diff > 0 ? '+' : '') + diff.toLocaleString(), diff: '🔴', cls: 'text-red-600' }
  }

  const confirmed = progress.filter(p => p.status === 'confirmed' || p.status === 'entered').length
  const total = Object.keys(allRoutes).length
  const regionList = Object.values(allRoutes).sort((a, b) =>
    a.from_region_name.localeCompare(b.from_region_name)
  )

  const statusLabel = { draft: 'Qoralama', confirmed: 'Tasdiqlandi ✓', entered: "Kiritib bo'lindi ✓" }
  const statusCls = { draft: 'text-gray-500', confirmed: 'text-green-600 font-medium', entered: 'text-blue-600 font-medium' }
  const roleBadge = {
    rm:      { label: 'RM',          cls: 'bg-blue-100 text-blue-700' },
    ops:     { label: 'Ops Manager', cls: 'bg-purple-100 text-purple-700' },
    checker: { label: 'Checker',     cls: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-black">Narx O&apos;rganish</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[role].cls}`}>
              {roleBadge[role].label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Barcha subregionlardan Toshkentga narxlarni o&apos;rganing
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Progress</div>
          <div className="text-base font-semibold text-indigo-600">{confirmed}/{total} tasdiqlandi</div>
          <div className="w-28 h-1.5 bg-gray-200 rounded-full mt-1 ml-auto">
            <div
              className="h-1.5 bg-indigo-500 rounded-full transition-all"
              style={{ width: total > 0 ? `${(confirmed / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Region selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block font-medium">Region</label>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">— Region tanlang —</option>
              {regionList.map(r => {
                const p = progress.find(pp => pp.region_id === r.from_region_id)
                const badge = p?.status === 'entered' ? ' ✓✓' : p?.status === 'confirmed' ? ' ✓' : ''
                return (
                  <option key={r.from_region_id} value={String(r.from_region_id)}>
                    {r.from_region_name}{badge}
                  </option>
                )
              })}
            </select>
          </div>
          {selectedRegion && (
            <div className="text-sm">
              <span className="text-gray-500">Holat: </span>
              <span className={statusCls[status]}>{statusLabel[status]}</span>
            </div>
          )}
        </div>
      </div>

      {loadingRegion && (
        <div className="text-center py-12 text-gray-500 text-sm">Yuklanmoqda...</div>
      )}

      {/* Per-tariff sections */}
      {!loadingRegion && sections.map(section => {
        const tariffName = TARIFF_NAMES[section.tariff_id] ?? section.tariff_id
        const isDelivery = section.tariff_id === 'delivery'
        const hasSeats = !isDelivery && section.seats.length > 0

        return (
          <div key={section.tariff_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            {/* Tariff card header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm text-black">{tariffName}</span>

              {section.db_active ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">DB: active</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">DB: inactive</span>
              )}

              {canEdit ? (
                <select
                  value={section.target_active === null ? '' : String(section.target_active)}
                  onChange={e => handleTargetActive(section.tariff_id, e.target.value)}
                  className={`text-xs px-2 py-1 rounded-md border focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                    section.target_active === true  ? 'border-green-300 bg-green-50 text-green-700'
                    : section.target_active === false ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <option value="">Kerak: o&apos;zgarmassin</option>
                  <option value="true">Kerak: active</option>
                  <option value="false">Kerak: inactive</option>
                </select>
              ) : (
                <span className="text-xs text-gray-500">
                  Kerak: {section.target_active === null ? "o'zgarmassin" : section.target_active ? 'active' : 'inactive'}
                </span>
              )}

              {section.tariff_id === '4' && ecoStdFullMismatch && (
                <span className="ml-auto text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                  ⚠️ Economy Full ≠ Standard Full
                </span>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Hisoblash (only for RM/Ops) */}
              {canEdit && section.subs.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={section.centerSubId ?? ''}
                    onChange={e => handleCenterSubId(section.tariff_id, e.target.value)}
                    className="flex-1 min-w-40 px-3 py-2 rounded-lg border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">— Markaziy subregion —</option>
                    {section.subs.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={section.centerPrice}
                    onChange={e => handleCenterPrice(section.tariff_id, e.target.value)}
                    placeholder="Narx"
                    className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">so&apos;m</span>
                  <button
                    onClick={() => handleCalculate(section.tariff_id)}
                    disabled={!section.centerSubId || !section.centerPrice}
                    className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Hisoblash
                  </button>
                </div>
              )}

              {/* Seat variantlar (Delivery uchun yo'q) */}
              {hasSeats && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Seat Variantlar</div>
                  <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600 font-medium">Variant</th>
                        <th className="text-right px-3 py-2 text-gray-600 font-medium">DB narxi</th>
                        <th className="text-center px-3 py-2 text-gray-600 font-medium">DB holati</th>
                        <th className="text-center px-3 py-2 text-gray-600 font-medium">Kerak holat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.seats.map(seat => {
                        const isEcoFull = section.tariff_id === '4' && seat.variant === 3
                        return (
                          <tr key={seat.variant} className="border-t border-gray-50">
                            <td className="px-3 py-2 text-black">
                              {SEAT_NAMES[seat.variant] ?? `Variant ${seat.variant}`}
                              {isEcoFull && ecoStdFullMismatch && <span className="ml-1">⚠️</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-black">
                              {seat.db_price.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {seat.db_available
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">active</span>
                                : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">inactive</span>
                              }
                            </td>
                            <td className="px-3 py-2 text-center">
                              {canEdit ? (
                                <select
                                  value={seat.target_available === null ? '' : String(seat.target_available)}
                                  onChange={e => handleSeatAvailable(section.tariff_id, seat.variant, e.target.value)}
                                  className={`px-2 py-1 rounded-md border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                                    seat.target_available === true  ? 'border-green-300 bg-green-50 text-green-700'
                                    : seat.target_available === false ? 'border-red-300 bg-red-50 text-red-600'
                                    : 'border-gray-200 text-gray-500'
                                  }`}
                                >
                                  <option value="">— o&apos;zgarmassin</option>
                                  <option value="true">✓ active</option>
                                  <option value="false">✗ inactive</option>
                                </select>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  {seat.target_available === null ? '—' : seat.target_available ? '✓ active' : '✗ inactive'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Subregion narxlari */}
              {section.subs.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Subregion Narxlari</div>
                  <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-center px-2 py-2 text-gray-600 font-medium w-8">#</th>
                        <th className="text-left px-3 py-2 text-gray-600 font-medium">Subregion</th>
                        <th className="text-right px-3 py-2 text-gray-600 font-medium">DB narxi</th>
                        <th className="text-right px-3 py-2 text-gray-600 font-medium">O&apos;rganilgan</th>
                        <th className="text-right px-3 py-2 text-gray-600 font-medium">Farq</th>
                        <th className="text-center px-3 py-2 text-gray-600 font-medium">Holat</th>
                        <th className="text-center px-3 py-2 text-gray-600 font-medium">DB status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.subs.map((sub, idx) => {
                        const { text, diff, cls } = getDiffCell(sub)
                        return (
                          <tr
                            key={sub.id}
                            className={`border-t border-gray-50 hover:bg-gray-50 transition-colors ${
                              sub.id === section.centerSubId ? 'bg-indigo-50/50' : ''
                            }`}
                          >
                            <td className="px-2 py-2 text-center text-gray-500 font-mono text-xs">{idx + 1}</td>
                            <td className="px-3 py-2 text-black">
                              {sub.name}
                              {sub.id === section.centerSubId && (
                                <span className="ml-2 text-xs text-indigo-500">(markaziy)</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-black">
                              {sub.db_price.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {canEdit ? (
                                <input
                                  type="number"
                                  value={sub.researched ?? ''}
                                  onChange={e => handleResearchChange(section.tariff_id, sub.id, e.target.value)}
                                  placeholder="—"
                                  className="w-28 px-2 py-1 text-right rounded-md border border-gray-200 font-mono text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                              ) : (
                                <span className="font-mono text-black">
                                  {sub.researched !== null ? sub.researched.toLocaleString() : '—'}
                                </span>
                              )}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${cls}`}>{text}</td>
                            <td className="px-3 py-2 text-center">{diff}</td>
                            <td className="px-3 py-2 text-center">
                              {sub.db_status
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">active</span>
                                : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">inactive</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Action buttons */}
      {!loadingRegion && sections.length > 0 && (
        <div className="flex items-center gap-3 mt-2">
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saqlanmoqda...' : '💾 Saqlash'}
            </button>
          )}
          {canConfirm && (
            <>
              <button
                onClick={() => handleStatus('confirmed')}
                disabled={saving || status === 'confirmed' || status === 'entered'}
                className="px-5 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                ✓ Tasdiqlash
              </button>
              <button
                onClick={() => handleStatus('entered')}
                disabled={saving || status === 'entered'}
                className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                ✓✓ Kiritib bo&apos;lindi
              </button>
            </>
          )}
          <span className={`ml-auto text-sm ${statusCls[status]}`}>{statusLabel[status]}</span>
        </div>
      )}

      {!selectedRegion && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-base text-black">Region tanlang</div>
          <div className="text-sm mt-1">Subregion narxlarini o&apos;rganish uchun yuqoridan region tanlang</div>
        </div>
      )}
    </div>
  )
}
