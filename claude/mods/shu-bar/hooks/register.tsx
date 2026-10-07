import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { View } from '../types'
import { shortId, summaryOf, taskOf } from './view'

const view = atom({ plugin: 'shu-bar', key: 'view' } as const, null)

const stdoutOf = async ($: EngineInterface, argv: readonly string[]): Promise<string | null> => {
  try {
    const { exitCode, stdout } = await $.process.run(argv, { timeoutMs: 10_000 })

    return exitCode === 0 ? stdout : null
  } catch {
    return null
  }
}

const load = async ($: EngineInterface): Promise<View | null> => {
  const prUrl = (await stdoutOf($, ['gh', 'pr', 'view', '--json', 'url', '-q', '.url']))?.trim()
  if (prUrl) {
    const found = await stdoutOf($, ['shu', 'find', '--ref', prUrl, '--json'])
    const task = found === null ? null : taskOf(found)
    if (task !== null) {
      return task
    }
  }
  const list = await stdoutOf($, ['shu', 'list', '--json'])

  return list === null ? null : summaryOf(list)
}

// A load that fails leaves the last view up: shu failing for one turn should
// not blank the bar.
const refresh = async ($: EngineInterface): Promise<void> => {
  try {
    const loaded = await load($)
    if (loaded === null) {
      return
    }
    await update($, view, () => loaded)
    // Under `claude plugin test` the write alone did not redraw a band whose
    // first draw had passed to the engine.
    $.ui.invalidate('ui.render')
  } catch {
    // A failed refresh must never fail the turn.
  }
}

export const register: Register = on => {
  // Not awaited: gh asks the network, and neither the first prompt nor the
  // end of a turn should wait on it.
  on('session.start', ($, e, next) => {
    void refresh($)

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    void refresh($)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, view)
    if (e.props.hasSurvey || current === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    if (current.kind === 'summary') {
      return (
        <Box>
          <Text dimColor>
            shu: open {current.open} · waiting {current.waiting}
          </Text>
        </Box>
      )
    }

    const rest = current.note === '' ? current.title : `${current.title} — ${current.note}`

    return (
      <Box>
        <Text bold>{shortId(current.id)} </Text>
        <Text dimColor>[{current.status}] </Text>
        <Text wrap="truncate-end">{rest}</Text>
      </Box>
    )
  })
}
