import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PR_URL = 'https://github.com/acme/app/pull/12'
const TASK = { id: '20261007-aoi-kitsune', title: 'Fix login', status: 'open', note: 'review pending' }
const LIST = { tasks: [TASK, { ...TASK, status: 'waiting' }] }

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const

const BAND = {
  plugin: 'shu-bar',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const ok = (stdout: string) => ({
  exitCode: 0,
  stdout,
  stderr: '',
  isStdoutTruncated: false,
  isStderrTruncated: false,
})
const failed = { ...ok(''), exitCode: 1 }

const host = (on: On, answers: { pr: boolean; find: boolean }) => {
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
  on('process.run', (_$, e) => {
    const [command, sub] = e.argv
    if (command === 'gh') {
      return { value: answers.pr ? ok(`${PR_URL}\n`) : failed }
    }
    if (sub === 'find') {
      return { value: answers.find ? ok(JSON.stringify({ task: TASK })) : failed }
    }

    return { value: ok(JSON.stringify(LIST)) }
  })
}

// The refresh is not awaited by the hook, so the drawing is redrawn until it lands.
const shown = async ($: Engine, text: RegExp) => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    let found = await ui.find({ type: 'Text', text })
    for (let i = 0; i < 200 && found === undefined; i += 1) {
      await ui.redraw()
      found = await ui.find({ type: 'Text', text })
    }
    expect(found).toBeDefined()
    await ui.unmount()
  }
}

test('shows the task that owns the branch PR', async ($, on) => {
  host(on, { pr: true, find: true })
  await $.session.start(START)

  await shown($, /aoi-kitsune/)
  await shown($, /Fix login — review pending/)
})

test('falls back to the open and waiting counts with no PR', async ($, on) => {
  host(on, { pr: false, find: false })
  await $.session.start(START)

  await shown($, /open 1 · waiting 1/)
})

test('falls back to the counts when no task owns the PR', async ($, on) => {
  host(on, { pr: true, find: false })
  await $.session.start(START)

  await shown($, /open 1 · waiting 1/)
})
