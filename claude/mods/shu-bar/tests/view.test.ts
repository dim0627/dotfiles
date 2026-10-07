import { expect, test } from 'claude-code/testing'

import { shortId, summaryOf, taskOf } from '../hooks/view'

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
