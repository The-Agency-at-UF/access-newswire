/**
 * Pure helpers over a client's stage state.
 *
 * These encode the approval rules from AGENTS.md §2, so they stay importable
 * (and testable) without pulling in React.
 */

import type { ClientState, StageKey } from './types'

/**
 * A client with nothing started — the shape a brand-new client begins at.
 * Until the `artifacts` table lands, every client reads as this.
 */
export const EMPTY_CLIENT_STATE: ClientState = {
  research: null,
  deck: null,
  strategy: null,
  release: null,
  media: null,
  pitch: null,
  m1: false,
  m2: false,
  upload: false,
}

/**
 * Is a stage done?
 *
 * Milestones (`m1`, `m2`, `upload`) are booleans — they happened or they
 * didn't. Artifacts are only done when **approved**: a draft or an in-review
 * version never counts, which is what keeps downstream stages from reading it.
 */
export function isStageDone(key: StageKey, value: ClientState[StageKey]): boolean {
  if (key === 'm1' || key === 'm2' || key === 'upload') return Boolean(value)
  return value === 'Approved'
}
