import { expect, test } from 'claude-code/testing'

import { lineOf } from '../hooks/line'

test('lineOf shows how much of each window is used, 5h first', () => {
  const rateLimits = [
    { kind: 'seven_day', percentUsed: 60 },
    { kind: 'five_hour', percentUsed: 2.4 },
  ]

  expect(lineOf(rateLimits)).toBe('5h 2% · 7d 60%')
})

test('lineOf shows only the windows that have a reading', () => {
  expect(lineOf([{ kind: 'seven_day', percentUsed: 100 }])).toBe('7d 100%')
})

test('lineOf answers undefined with no reading, so the status line clears', () => {
  expect(lineOf([])).toBe(undefined)
  expect(lineOf([{ kind: 'spend_limit', percentUsed: 40 }])).toBe(undefined)
})
