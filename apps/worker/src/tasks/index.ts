import type { Task } from '../context'
import { documentIndex } from './document-index'
import { exportRender } from './export-render'
import { generate } from './generate'
import { classifyEmail, ingestEmail, renewSubscription, syncMailbox } from './mail'
import { statsImport } from './stats-import'

/** Every job type in `jobs.type` (AGENTS.md §11) and the task that runs it. */
export const TASKS: Record<string, Task> = {
  'research.run': generate,
  'onboarding.generate': generate,
  'strategy.phase': generate,
  'release.draft': generate,
  'release.edit': generate,
  'medialist.build': generate,
  'pitches.generate': generate,
  'document.index': documentIndex,
  'export.render': exportRender,
  'stats.import': statsImport,
  'email.sync': syncMailbox,
  'email.ingest': ingestEmail,
  'email.classify': classifyEmail,
  'mail.renew_subscription': renewSubscription,
}
