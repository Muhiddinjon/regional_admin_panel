export type DriverStatus = 'elite' | 'regular'

export interface Driver {
  id: number
  name: string
  phone: string
  status: DriverStatus
  rating: number | null
  created_at: string
}

export interface DriverMetrics {
  id: string
  driver_id: number
  month: string
  done_orders: number
  reject_rate: number | null
  activity_score: number | null
  last_order_date: string | null
  driver?: Driver
}

export interface CCLog {
  id: string
  date: string
  cc_name: string
  total_incoming: number
  client_calls: number
  regular_driver_calls: number
  elite_driver_calls: number
  resolved_by_cc: number
  escalated_to_rm: number
  escalation_reasons: string | null
  outgoing_inactive: number
  outgoing_inactive_responded: number
  outgoing_onboarding: number
  notes: string | null
  created_at: string
}

export interface Escalation {
  id: string
  date: string
  source: 'cc' | 'rm'
  driver_id: number | null
  caller_type: 'elite' | 'regular' | 'client'
  reason: string
  description: string | null
  status: 'open' | 'resolved' | 'escalated'
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  driver?: Driver
}

export interface Price {
  id: string
  subregion: string
  is_center: boolean
  price_to_tashkent: number
  difference_from_center: number
  last_updated: string
  updated_by: string | null
}

export interface RMReport {
  id: string
  week_number: number
  week_start: string
  week_end: string
  rm_name: string
  cc_escalations_received: number
  cc_escalations_resolved: number
  cc_escalations_to_ops: number
  done_orders: number
  prev_done_orders: number
  andijon_city_trips: number
  active_drivers: number
  elite_reject_rate: number | null
  general_reject_rate: number | null
  kval_drivers: number
  nekval_drivers: number
  elite_active: number
  elite_total: number
  elite_coverage: number | null
  elite_checkins_done: number
  notes: string | null
  created_at: string
}
