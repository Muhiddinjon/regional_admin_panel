import { redis, K } from '@/lib/redis'
import { cookies } from 'next/headers'
import CCLogClient from './client'

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

export default async function CCLogPage() {
  const [logs, cookieStore] = await Promise.all([getCCLogs(), cookies()])
  const role = cookieStore.get('admin_token')?.value ?? 'rm'
  return <CCLogClient logs={logs} role={role} />
}
