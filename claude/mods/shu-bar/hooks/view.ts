import type { View } from '../types'

type Task = { id: string; title: string; status: string; note: string }

const parse = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

const isTask = (value: unknown): value is Task => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { id, title, status, note } = value as Record<string, unknown>

  return (
    typeof id === 'string' &&
    typeof title === 'string' &&
    typeof status === 'string' &&
    typeof note === 'string'
  )
}

export const taskOf = (findJson: string): View | null => {
  const task = (parse(findJson) as { task?: unknown } | null)?.task

  return isTask(task)
    ? { kind: 'task', id: task.id, title: task.title, status: task.status, note: task.note }
    : null
}

export const summaryOf = (listJson: string): View | null => {
  const tasks = (parse(listJson) as { tasks?: unknown } | null)?.tasks
  if (!Array.isArray(tasks)) {
    return null
  }
  const count = (status: string) => tasks.filter(t => isTask(t) && t.status === status).length

  return { kind: 'summary', open: count('open'), waiting: count('waiting') }
}

// shu ids are <date>-<words>; the words alone name the task everywhere else.
export const shortId = (id: string): string => id.replace(/^\d{8}-/, '')

const ID = /^(?:\d{8}-)?[a-z]+(?:-[a-z]+)+$/
const FULL_ID = /\b\d{8}-[a-z]+(?:-[a-z]+)+\b/
const NAMES_ONE_TASK = ['show', 'log', 'artifact', 'path']
const PRINTS_ITS_TASK = ['find', 'save']

const shuWordsOf = (segment: string): string[] => {
  const words = segment
    .trim()
    .split(/\s+/)
    .map(word => word.replace(/^["']|["']$/g, ''))
  const at = words.indexOf('shu')

  return at === -1 ? [] : words.slice(at + 1)
}

const namedIn = ([sub, ...rest]: readonly string[]): string | null => {
  if (sub === undefined) {
    return null
  }
  if (sub === 'status') {
    const words = rest.slice(1)
    const end = words.findIndex(word => !ID.test(word))
    const ids = end === -1 ? words : words.slice(0, end)

    // A status change over several tasks is housekeeping, not this session's task.
    return ids.length === 1 ? (ids[0] ?? null) : null
  }
  const [id] = rest

  return NAMES_ONE_TASK.includes(sub) && id !== undefined && ID.test(id) ? id : null
}

// The task a shell command worked on: the one it names, else the one a find or
// a save printed. A list prints every task, so its output is never read.
export const touchedOf = (command: string, output: string): string | null => {
  const calls = command.split(/&&|\|\||[;|\n]/).map(shuWordsOf)
  const named = calls.map(namedIn).findLast(id => id !== null) ?? null
  if (named !== null) {
    return named
  }

  return calls.some(([sub]) => sub !== undefined && PRINTS_ITS_TASK.includes(sub)) ? (FULL_ID.exec(output)?.[0] ?? null) : null
}
