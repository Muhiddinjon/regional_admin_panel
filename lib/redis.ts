import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const K = {
  // elite_calls
  ELITE_CALLS: 'andijon:elite_calls',                            // sorted set (score=timestamp)
  ELITE_CALL: (id: string) => `andijon:elite_call:${id}`,        // hash
  ELITE_CALL_LATEST: (driverId: string) => `andijon:elite_call_latest:${driverId}`,  // hash
  ELITE_PM_LATEST: (driverId: string) => `andijon:elite_pm_latest:${driverId}`,      // hash

  // cc_logs
  CC_LOGS: 'andijon:cc_logs',                                    // sorted set (score=date timestamp)
  CC_LOG: (date: string) => `andijon:cc_log:${date}`,            // hash

  // escalations
  ESCALATIONS: 'andijon:escalations',                            // sorted set
  ESCALATION: (id: string) => `andijon:escalation:${id}`,        // hash

  // prices
  PRICES: 'andijon:prices',                                      // sorted set (score=0, member=subregion)
  PRICE: (subregion: string) => `andijon:price:${subregion}`,    // hash

  // rm_reports
  RM_REPORTS: 'andijon:rm_reports',                              // sorted set (score=week_start timestamp)
  RM_REPORT: (id: string) => `andijon:rm_report:${id}`,          // hash

  // price research (Narx O'rganish)
  NR_DATA: (regionId: number) => `nr:${regionId}`,               // JSON string
  NR_INDEX: 'nr:regions',                                        // sorted set (score=regionId)

  // elite drivers
  ELITE_DRIVERS: 'elite:drivers',                                // set of driver IDs
  ELITE_DRIVER: (id: string) => `elite:driver:${id}`,            // hash
}
