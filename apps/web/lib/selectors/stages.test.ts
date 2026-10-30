import { describe, expect, it } from 'vitest'
import { EMPTY_CLIENT_STATE, isStageDone } from '../clientState'
import { RELEASE_STAGES } from '../tokens'
import {
  currentStage,
  gates,
  pipeline,
  stageSequence,
  stageStatusText,
  visibleTabs,
  autoReleaseMode,
} from './stages'
import type { ClientState } from '../types'

const NO_DATES = { m1: null, m2: null }

/** A fully onboarded client with an approved release. */
const onboarded: ClientState = {
  ...EMPTY_CLIENT_STATE,
  research: 'Approved',
  deck: 'Approved',
  m1: true,
  strategy: 'Approved',
  m2: true,
  release: 'Approved',
}

describe('isStageDone', () => {
  it('counts an artifact as done only once approved', () => {
    expect(isStageDone('release', 'Approved')).toBe(true)
    expect(isStageDone('release', 'In Review')).toBe(false)
    expect(isStageDone('release', 'Draft')).toBe(false)
    expect(isStageDone('release', null)).toBe(false)
  })

  it('treats milestones as booleans', () => {
    expect(isStageDone('m1', true)).toBe(true)
    expect(isStageDone('upload', false)).toBe(false)
  })
})

describe('tier gating', () => {
  it('gives L1 only the release stage — no media list, upload or outreach', () => {
    const keys = RELEASE_STAGES.L1.map(([key]) => key)
    expect(keys).toEqual(['release'])
  })

  it('gives L2 and L3 the full release loop', () => {
    for (const tier of ['L2', 'L3'] as const) {
      expect(RELEASE_STAGES[tier].map(([key]) => key)).toEqual([
        'release',
        'media',
        'upload',
        'pitch',
      ])
    }
  })

  it('hides the media and pitch tabs for L1', () => {
    const l1 = visibleTabs('L1').map(([tab]) => tab)
    expect(l1).not.toContain('media')
    expect(l1).not.toContain('pitches')
    expect(visibleTabs('L2').map(([tab]) => tab)).toContain('media')
  })

  it('defaults L2 to editing the client’s draft, and writes for L1/L3', () => {
    expect(autoReleaseMode('L2')).toBe('B')
    expect(autoReleaseMode('L1')).toBe('A')
    expect(autoReleaseMode('L3')).toBe('A')
  })

  it('builds a shorter stage sequence for L1 than for L3', () => {
    expect(stageSequence('L1')).toHaveLength(6)
    expect(stageSequence('L3')).toHaveLength(9)
  })
})

describe('approval gates', () => {
  it('blocks every downstream stage for a brand-new client', () => {
    const gate = gates(EMPTY_CLIENT_STATE)
    expect(gate.onboarding.blocked).toBe(true)
    expect(gate.strategy.blocked).toBe(true)
    expect(gate.releases.blocked).toBe(true)
    expect(gate.media.blocked).toBe(true)
    expect(gate.pitches.blocked).toBe(true)
  })

  it('does not open onboarding on a draft or in-review research', () => {
    expect(gates({ ...EMPTY_CLIENT_STATE, research: 'Draft' }).onboarding.blocked).toBe(true)
    expect(gates({ ...EMPTY_CLIENT_STATE, research: 'In Review' }).onboarding.blocked).toBe(true)
    expect(gates({ ...EMPTY_CLIENT_STATE, research: 'Approved' }).onboarding.blocked).toBe(false)
  })

  it('needs both an approved deck and Meeting 1 before strategy opens', () => {
    const deckOnly = { ...EMPTY_CLIENT_STATE, research: 'Approved', deck: 'Approved' } as ClientState
    expect(gates(deckOnly).strategy.blocked).toBe(true)
    expect(gates({ ...deckOnly, m1: true }).strategy.blocked).toBe(false)
  })

  it('needs an approved strategy *and* Meeting 2 before releases open', () => {
    const noMeeting: ClientState = { ...onboarded, m2: false }
    expect(gates(noMeeting).releases.blocked).toBe(true)
    expect(gates(onboarded).releases.blocked).toBe(false)
  })

  it('opens media only on an approved release, and pitches only on an approved list', () => {
    expect(gates(onboarded).media.blocked).toBe(false)
    expect(gates(onboarded).pitches.blocked).toBe(true)

    const listInReview: ClientState = { ...onboarded, media: 'In Review' }
    expect(gates(listInReview).pitches.blocked).toBe(true)

    const listApproved: ClientState = { ...onboarded, media: 'Approved' }
    expect(gates(listApproved).pitches.blocked).toBe(false)
  })

  it('re-blocks downstream stages when an approved stage is reopened', () => {
    const reopened: ClientState = { ...onboarded, strategy: 'Draft' }
    expect(gates(reopened).releases.blocked).toBe(true)
  })
})

describe('stageStatusText', () => {
  it('describes meetings as held, scheduled or unscheduled', () => {
    expect(stageStatusText('m1', true, { m1: '9/10', m2: null })).toBe('Held')
    expect(stageStatusText('m1', false, { m1: '9/10', m2: null })).toBe('Scheduled 9/10')
    expect(stageStatusText('m1', false, NO_DATES)).toBe('Not scheduled')
  })

  it('describes the ACCESS upload as uploaded or pending', () => {
    expect(stageStatusText('upload', true, NO_DATES)).toBe('Uploaded')
    expect(stageStatusText('upload', false, NO_DATES)).toBe('Pending')
  })

  it('falls back to "Not started" for an artifact that has none', () => {
    expect(stageStatusText('release', null, NO_DATES)).toBe('Not started')
    expect(stageStatusText('release', 'In Review', NO_DATES)).toBe('In Review')
  })
})

describe('currentStage', () => {
  it('reports the first stage that is not done', () => {
    expect(currentStage('L3', EMPTY_CLIENT_STATE, NO_DATES).label).toBe('Research')
    expect(currentStage('L2', onboarded, NO_DATES).label).toBe('Media list')
  })

  it('moves to reporting once every stage in the tier is done', () => {
    const l1Complete: ClientState = { ...onboarded, release: 'Approved' }
    const stage = currentStage('L1', l1Complete, NO_DATES)
    expect(stage.label).toBe('Reporting')
    expect(stage.st.label).toBe('Approved')
  })

  it('keeps a stage current while it is only in review', () => {
    const stage = currentStage('L2', { ...onboarded, media: 'In Review' }, NO_DATES)
    expect(stage.label).toBe('Media list')
    expect(stage.st.label).toBe('In Review')
  })

  it('carries milestone wording onto the badge once the list is approved', () => {
    const stage = currentStage('L2', { ...onboarded, media: 'Approved' }, NO_DATES)
    expect(stage.label).toBe('Upload to ACCESS')
    expect(stage.st.label).toBe('Pending')
  })
})

describe('pipeline', () => {
  it('marks done stages, the current one, and the rest as todo', () => {
    const nodes = pipeline(RELEASE_STAGES.L2, onboarded, NO_DATES)
    expect(nodes.map((node) => node.state)).toEqual(['done', 'current', 'todo', 'todo'])
    expect(nodes[0]?.mark).toBe('✓')
    expect(nodes[1]?.mark).toBe('2')
  })

  it('leaves the outer connectors empty so the rail does not float', () => {
    const nodes = pipeline(RELEASE_STAGES.L2, onboarded, NO_DATES)
    expect(nodes[0]?.lineBefore).toBe('none')
    expect(nodes[nodes.length - 1]?.lineAfter).toBe('none')
  })

  it('has no current node once everything is done', () => {
    const nodes = pipeline(RELEASE_STAGES.L1, onboarded, NO_DATES)
    expect(nodes.every((node) => node.state === 'done')).toBe(true)
  })
})
