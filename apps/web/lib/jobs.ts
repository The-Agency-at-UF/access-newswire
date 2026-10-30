/** What each job type (`jobs.type`, AGENTS.md §11) is called on screen. */
export const JOB_LABELS: Record<string, string> = {
  'research.run': 'Research',
  'onboarding.generate': 'Onboarding deck',
  'strategy.phase': 'Strategy phase',
  'release.draft': 'Release draft',
  'release.edit': 'Release edit',
  'medialist.build': 'Media list',
  'pitches.generate': 'Pitches',
  'document.index': 'Indexing a document',
  'export.render': 'Export',
  'stats.import': 'ACCESS stats import',
  'email.sync': 'Inbox sync',
  'email.ingest': 'Reading an email',
  'email.classify': 'Labeling an email',
  'mail.renew_subscription': 'Mailbox subscription',
}

export function jobLabel(type: string): string {
  return JOB_LABELS[type] ?? type
}

/** A job that can still be canceled (`cancel_job()` accepts these). */
export function isActive(status: string): boolean {
  return status === 'queued' || status === 'running'
}
