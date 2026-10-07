import { expect, test } from 'claude-code/testing'

const RATE_LIMITS = [
  { kind: 'five_hour', percentUsed: 38 },
  { kind: 'seven_day', percentUsed: 19 },
]
const CONTEXT = { window: 200_000 }

test('pins the line when the engine measures the session', async ($, on) => {
  const shown: (string | undefined)[] = []
  on('ui.status', (_$, e) => {
    shown.push(e.text)

    return { value: undefined }
  })
  on('session.measure', (_$, e) => ({ changed: e.changed }))

  await $.session.measure({ context: CONTEXT, rateLimits: RATE_LIMITS, changed: ['rateLimits'] })

  expect(shown).toEqual(['5h 38% · 7d 19%'])
})
