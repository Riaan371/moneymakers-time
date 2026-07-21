const zar = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
})

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return zar.format(n)
}

export function hours(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n.toFixed(1)}h`
}

/** minutes between two ISO timestamps (end defaults to now, for running timers) */
export function minutesBetween(startIso: string, endIso: string | null): number {
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  return Math.max(0, (end - new Date(startIso).getTime()) / 60000)
}

export function durationLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`
}

/** 'YYYY-MM-01' for the month containing the given date */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`
}

export function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  })
}
