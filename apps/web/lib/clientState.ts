/**
 * Pure helpers over a client's stage state.
 *
 * These encode the approval rules from AGENTS.md §2, so they stay importable
 * (and testable) without pulling in React.
 */

import type { Enums, Tables } from '@access/db'
import type { MeetingDates } from './selectors/stages'
import type { ArtifactKey, ArtifactStatus, ClientState, StageKey } from './types'

/** A client with nothing started — the shape a brand-new client begins at. */
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

const STAGE_FOR_TYPE: Partial<Record<Enums<'artifact_type'>, ArtifactKey>> = {
  research: 'research',
  onboarding_deck: 'deck',
  strategy: 'strategy',
  press_release: 'release',
  media_list: 'media',
  pitch_set: 'pitch',
}

const STATUS_LABEL: Record<Enums<'artifact_status'>, ArtifactStatus> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  archived: 'Archived',
}

type MeetingRow = Pick<Tables<'meetings'>, 'kind' | 'held_on' | 'scheduled_for'>

/**
 * A client's stage state from its rows: the onboarding artifacts, the current
 * release's artifacts, its meetings and the current release.
 *
 * An artifact with an approved version counts as approved even while a
 * revision is in draft, because `approved_version_id` is what the database
 * gates and downstream stages read (AGENTS.md §2).
 */
export function clientStateFrom({
  artifacts,
  meetings,
  release,
}: {
  artifacts: Pick<Tables<'artifacts'>, 'type' | 'status' | 'approved_version_id'>[]
  meetings: MeetingRow[]
  release: Pick<Tables<'releases'>, 'access_uploaded_at'> | null
}): ClientState {
  const cs: ClientState = { ...EMPTY_CLIENT_STATE }
  for (const artifact of artifacts) {
    const key = STAGE_FOR_TYPE[artifact.type]
    if (!key || artifact.status === 'archived') continue
    cs[key] = artifact.approved_version_id ? 'Approved' : STATUS_LABEL[artifact.status]
  }
  cs.m1 = meetings.some((m) => m.kind === 'meeting_1' && m.held_on)
  cs.m2 = meetings.some((m) => m.kind === 'meeting_2' && m.held_on)
  cs.upload = Boolean(release?.access_uploaded_at)
  return cs
}

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Meeting 1 and 2 dates for the pipeline, while they're scheduled but not held. */
export function meetingDatesFrom(meetings: MeetingRow[]): MeetingDates {
  const scheduled = (kind: 'meeting_1' | 'meeting_2') => {
    const upcoming = meetings
      .filter((m) => m.kind === kind && !m.held_on && m.scheduled_for)
      .map((m) => m.scheduled_for as string)
      .sort()[0]
    return upcoming ? shortDate.format(new Date(upcoming)) : null
  }
  return { m1: scheduled('meeting_1'), m2: scheduled('meeting_2') }
}
