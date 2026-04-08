export const REGIONS: Record<number, {
  name: string
  sub_region_ids: number[]
}> = {
  3: {
    name: 'Andijon',
    sub_region_ids: [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
  },
}

export const DEFAULT_REGION = 3

// Andijon shahar sub_region_id = 39 (Andijon City)
export const ANDIJON_CITY_SUB_IDS: number[] = [39]

// April 2026 maqsad
export const ANDIJON_CITY_GOAL = 1200
