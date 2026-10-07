import type { Register } from 'claude-code'

import { lineOf } from './line'

export const register: Register = on => {
  // A reload or a resumed session already has a reading; a new one has none
  // until its first response.
  on('session.start', async ($, e, next) => {
    const { rateLimits } = await $.session.usage()
    $.ui.status(lineOf(rateLimits))

    return next(e)
  })

  on('session.measure', ($, e, next) => {
    $.ui.status(lineOf(e.rateLimits))

    return next(e)
  })
}
