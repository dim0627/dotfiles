import { expect, test } from 'claude-code/testing'

import { shortId, summaryOf, taskOf, touchedOf } from '../hooks/view'

const task = (status: string) => ({ id: '20261007-aoi-kitsune', title: 'Fix login', status, note: '' })

test('taskOf reads the task shu find prints', () => {
  expect(taskOf(JSON.stringify({ task: { ...task('open'), note: 'waiting on review' } }))).toEqual({
    kind: 'task',
    id: '20261007-aoi-kitsune',
    title: 'Fix login',
    status: 'open',
    note: 'waiting on review',
  })
})

test('taskOf answers null for an error or broken output', () => {
  expect(taskOf(JSON.stringify({ error: { code: 'not_found', message: 'no task' } }))).toBe(null)
  expect(taskOf('not json')).toBe(null)
})

test('summaryOf counts open and waiting tasks', () => {
  const list = JSON.stringify({ tasks: [task('open'), task('waiting'), task('waiting'), task('todo')] })

  expect(summaryOf(list)).toEqual({ kind: 'summary', open: 1, waiting: 2 })
})

test('shortId drops the date', () => {
  expect(shortId('20261007-aoi-kitsune')).toBe('aoi-kitsune')
})

test('touchedOf reads the task a command names', () => {
  expect(touchedOf('shu show aoi-kitsune --json', '')).toBe('aoi-kitsune')
  expect(touchedOf('shu log 20261007-aoi-kitsune "found the cause"', '')).toBe('20261007-aoi-kitsune')
  expect(touchedOf('shu status waiting aoi-kitsune --note "on code-review"', '')).toBe('aoi-kitsune')
  expect(touchedOf('cd /repo && shu show aoi-kitsune | jq .task', '')).toBe('aoi-kitsune')
})

test('touchedOf reads the task a find or a save printed', () => {
  const printed = JSON.stringify({ task: { id: '20261007-aoi-kitsune' } })

  expect(touchedOf('shu find --ref acme/app#12 --json', printed)).toBe('20261007-aoi-kitsune')
  expect(touchedOf("shu save <<'EOF'\n{\"title\": \"Fix login\"}\nEOF", printed)).toBe('20261007-aoi-kitsune')
  expect(touchedOf('shu find --ref acme/app#12 --json', '{"error":{"code":"not_found"}}')).toBe(null)
})

test('touchedOf answers null for a command that works on no one task', () => {
  const printed = JSON.stringify({ tasks: [{ id: '20261007-aoi-kitsune' }] })

  expect(touchedOf('shu list --json', printed)).toBe(null)
  expect(touchedOf('shu status done aoi-kitsune akai-tsuru', '')).toBe(null)
  expect(touchedOf('git log --oneline', '20261007-aoi-kitsune')).toBe(null)
})
