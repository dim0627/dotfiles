import type { SessionRateLimit } from 'claude-code'

const LABELS = [
  ['five_hour', '5h'],
  ['seven_day', '7d'],
] as const

export const lineOf = (rateLimits: readonly SessionRateLimit[]): string | undefined => {
  const parts = LABELS.flatMap(([kind, label]) => {
    const found = rateLimits.find(limit => limit.kind === kind)

    return found === undefined ? [] : [`${label} ${Math.round(found.percentUsed)}%`]
  })

  return parts.length === 0 ? undefined : parts.join(' · ')
}
