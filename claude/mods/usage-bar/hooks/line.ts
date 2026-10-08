import type { SessionRateLimit } from 'claude-code'

const pad = (n: number): string => String(n).padStart(2, '0')

const timeOf = (at: Date): string => `${pad(at.getHours())}:${pad(at.getMinutes())}`

const dateOf = (at: Date): string => `${at.getMonth() + 1}/${at.getDate()}`

const LABELS = [
  ['five_hour', '5h', timeOf],
  ['seven_day', '7d', dateOf],
] as const

const resetOf = (resetsAt: string | undefined, format: (at: Date) => string): string => {
  if (resetsAt === undefined) return ''

  const at = new Date(resetsAt)

  return Number.isNaN(at.getTime()) ? '' : ` →${format(at)}`
}

export const lineOf = (rateLimits: readonly SessionRateLimit[]): string | undefined => {
  const parts = LABELS.flatMap(([kind, label, format]) => {
    const found = rateLimits.find(limit => limit.kind === kind)

    return found === undefined
      ? []
      : [`${label} ${Math.round(found.percentUsed)}%${resetOf(found.resetsAt, format)}`]
  })

  return parts.length === 0 ? undefined : parts.join(' · ')
}
