import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number) {
  return n.toLocaleString('uz-UZ')
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

export function daysSince(date: string | null): number {
  if (!date) return 0
  const diff = new Date().getTime() - new Date(date).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function getInactiveBadge(days: number): { label: string; color: string } {
  if (days >= 15) return { label: `${days} kun`, color: 'bg-red-100 text-red-700' }
  if (days >= 13) return { label: `${days} kun`, color: 'bg-orange-100 text-orange-700' }
  if (days >= 10) return { label: `${days} kun`, color: 'bg-yellow-100 text-yellow-700' }
  return { label: `${days} kun`, color: 'bg-green-100 text-green-700' }
}
