import { describe, expect, it } from 'vitest'
import { EMPTY_CLIENT_STATE, clientStateFrom, meetingDatesFrom } from './clientState'

const artifact = (
  type: Parameters<typeof clientStateFrom>[0]['artifacts'][number]['type'],
  status: Parameters<typeof clientStateFrom>[0]['artifacts'][number]['status'],
  approved = false,
) => ({ type, status, approved_version_id: approved ? 'v1' : null })

describe('clientStateFrom', () => {
  it('is the empty state for a client with nothing', () => {
    expect(clientStateFrom({ artifacts: [], meetings: [], release: null })).toEqual(EMPTY_CLIENT_STATE)
  })

  it('maps artifact types and statuses onto stage keys', () => {
    const cs = clientStateFrom({
      artifacts: [
        artifact('research', 'approved', true),
        artifact('onboarding_deck', 'in_review'),
        artifact('strategy', 'draft'),
        artifact('press_release', 'approved', true),
        artifact('media_list', 'draft'),
        artifact('pitch_set', 'in_review'),
      ],
      meetings: [],
      release: null,
    })
    expect(cs).toMatchObject({
      research: 'Approved',
      deck: 'In Review',
      strategy: 'Draft',
      release: 'Approved',
      media: 'Draft',
      pitch: 'In Review',
    })
  })

  it('keeps an approved stage approved while a revision is drafted, as the database gates do', () => {
    const cs = clientStateFrom({ artifacts: [artifact('strategy', 'draft', true)], meetings: [], release: null })
    expect(cs.strategy).toBe('Approved')
  })

  it('ignores archived artifacts and reports types it does not track', () => {
    const cs = clientStateFrom({
      artifacts: [artifact('research', 'archived', true), artifact('report', 'approved', true)],
      meetings: [],
      release: null,
    })
    expect(cs).toEqual(EMPTY_CLIENT_STATE)
  })

  it('counts a meeting only once it has been held', () => {
    const cs = clientStateFrom({
      artifacts: [],
      meetings: [
        { kind: 'meeting_1', held_on: '2026-10-01', scheduled_for: null },
        { kind: 'meeting_2', held_on: null, scheduled_for: '2026-11-03' },
        { kind: 'check_in', held_on: '2026-10-20', scheduled_for: null },
      ],
      release: null,
    })
    expect(cs.m1).toBe(true)
    expect(cs.m2).toBe(false)
  })

  it('reads the ACCESS upload from the current release', () => {
    expect(clientStateFrom({ artifacts: [], meetings: [], release: { access_uploaded_at: '2026-10-28T15:00:00Z' } }).upload).toBe(true)
    expect(clientStateFrom({ artifacts: [], meetings: [], release: { access_uploaded_at: null } }).upload).toBe(false)
  })
})

describe('meetingDatesFrom', () => {
  it('gives the next scheduled date for meetings not yet held', () => {
    const dates = meetingDatesFrom([
      { kind: 'meeting_1', held_on: '2026-10-01', scheduled_for: '2026-10-01' },
      { kind: 'meeting_2', held_on: null, scheduled_for: '2026-11-03' },
    ])
    expect(dates).toEqual({ m1: null, m2: 'Nov 3' })
  })

  it('is empty without meetings', () => {
    expect(meetingDatesFrom([])).toEqual({ m1: null, m2: null })
  })
})
