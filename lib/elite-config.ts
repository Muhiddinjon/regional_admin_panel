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

// Andijon: shahar + 4 tuman (39=shahri, 40=tumani, 49=Asaka, 47=Shahrixon, 36=Bo'ston)
export const ANDIJON_CITY_SUB_IDS: number[] = [39, 40, 49, 47, 36]

// April 2026 maqsad
export const ANDIJON_CITY_GOAL = 1200
