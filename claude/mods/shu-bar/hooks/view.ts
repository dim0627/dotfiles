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
