/**
 * Stage, pipeline and approval-gate logic.
 *
 * This is the part of the UI that enforces AGENTS.md §2: a stage is only
 * reachable once the stage it depends on is *approved*, and tiers decide which
 * stages exist at all. Keep it pure — it is the piece most worth unit-testing.
 */

import { ONBOARDING_STAGES, RELEASE_STAGES, STATUS } from '../tokens'
import { isStageDone } from '../clientState'
import type {
  ClientState,
  DisplayStatus,
  StageKey,
  StageSpec,
  StatusSwatch,
  Tier,
  WorkspaceTab,
} from '../types'

export interface StatusBadge extends StatusSwatch {
  /** The text shown in the pill — may be more specific than the swatch key. */
  label: string
}

/** Resolve a nullable artifact status to a display badge. */
export function badge(status: DisplayStatus | null | undefined): StatusBadge {
  const key = status ?? 'Not started'
  return { label: key, ...(STATUS[key] ?? STATUS['Not started']) }
}

/** Meeting 1 and 2 dates, once scheduled. */
export interface MeetingDates {
  m1: string | null
  m2: string | null
}

/**
 * Human-readable state for one stage. Milestones read as held/scheduled;
 * the ACCESS upload reads as uploaded/pending; artifacts use their status.
 */
export function stageStatusText(
  key: StageKey,
  value: ClientState[StageKey],
  dates: MeetingDates,
): string {
  if (key === 'm1' || key === 'm2') {
    if (value) return 'Held'
    const date = dates[key]
    return date ? `Scheduled ${date}` : 'Not scheduled'
  }
  if (key === 'upload') return value ? 'Uploaded' : 'Pending'
  return typeof value === 'string' ? value : 'Not started'
}

/** Map free-text stage state onto the nearest status swatch. */
function swatchFor(text: string): DisplayStatus {
  if (text in STATUS) return text as DisplayStatus
  if (text.startsWith('Scheduled')) return 'Scheduled'
  return 'Not started'
}

/** The full stage sequence for a tier: onboarding, then that tier's release loop. */
export function stageSequence(tier: Tier): readonly StageSpec[] {
  return [...ONBOARDING_STAGES, ...RELEASE_STAGES[tier]]
}

export interface CurrentStage {
  /** Stage label, or `Reporting` once every stage is done. */
  label: string
  st: StatusBadge
}

/**
 * The first stage that isn't done — what the client list shows as
 * "current stage". A client with nothing outstanding has moved to reporting.
 */
export function currentStage(
  tier: Tier,
  cs: ClientState,
  dates: MeetingDates,
): CurrentStage {
  const sequence = stageSequence(tier)
  const next = sequence.find(([key]) => !isStageDone(key, cs[key]))
  if (!next) return { label: 'Reporting', st: badge('Approved') }

  const [key, label] = next
  const text = stageStatusText(key, cs[key], dates)
  return { label, st: { ...badge(swatchFor(text)), label: text } }
}

export type NodeState = 'done' | 'current' | 'todo'
export type RailLine = 'none' | 'active' | 'idle'

export interface PipelineNode {
  key: StageKey
  label: string
  statusText: string
  tab: WorkspaceTab
  state: NodeState
  /** Step number, or a tick once done. */
  mark: string
  lineBefore: RailLine
  lineAfter: RailLine
}

/**
 * Build a pipeline rail. The first not-done stage is `current`; connector
 * segments are solid up to and including the current node.
 */
export function pipeline(
  stages: readonly StageSpec[],
  cs: ClientState,
  dates: MeetingDates,
): PipelineNode[] {
  const currentIndex = stages.findIndex(([key]) => !isStageDone(key, cs[key]))

  return stages.map(([key, label, tab], i) => {
    const done = isStageDone(key, cs[key])
    const isCurrent = i === currentIndex
    const state: NodeState = done ? 'done' : isCurrent ? 'current' : 'todo'
    return {
      key,
      label,
      statusText: stageStatusText(key, cs[key], dates),
      tab,
      state,
      mark: done ? '✓' : String(i + 1),
      lineBefore: i === 0 ? 'none' : done || isCurrent ? 'active' : 'idle',
      lineAfter: i === stages.length - 1 ? 'none' : done ? 'active' : 'idle',
    }
  })
}

export interface Gate {
  /** True when the stage is not yet reachable. */
  blocked: boolean
  /** Why it is blocked, in the team's own terms. */
  msg: string
  /** Label for the button that takes you to the blocking stage. */
  label: string
  tab: WorkspaceTab
}

/** Gated tabs. Overview, research, reporting and docs are always reachable. */
export type GatedTab = 'onboarding' | 'strategy' | 'releases' | 'media' | 'pitches'

/**
 * Approval gates, straight from the workflow in AGENTS.md §1. Each stage reads
 * only the *approved* output of the one before it.
 */
export function gates(cs: ClientState): Record<GatedTab, Gate> {
  const gate = (ok: boolean, msg: string, label: string, tab: WorkspaceTab): Gate => ({
    blocked: !ok,
    msg,
    label,
    tab,
  })

  return {
    onboarding: gate(
      cs.research === 'Approved',
      'The onboarding deck builds from approved research.',
      'Go to Research',
      'research',
    ),
    strategy: gate(
      cs.deck === 'Approved' && cs.m1,
      'Strategy needs an approved deck and Meeting 1 feedback.',
      'Go to Onboarding',
      'onboarding',
    ),
    releases: gate(
      cs.strategy === 'Approved' && cs.m2,
      'Releases unlock once the strategy is approved after Meeting 2.',
      'Go to Strategy',
      'strategy',
    ),
    media: gate(
      cs.release === 'Approved',
      'Media lists pull from an approved release.',
      'Go to Press Releases',
      'releases',
    ),
    pitches: gate(
      cs.media === 'Approved',
      'Pitches use an approved media list.',
      'Go to Media Lists',
      'media',
    ),
  }
}

const ALL_TABS: readonly (readonly [WorkspaceTab, string])[] = [
  ['overview', 'Overview'],
  ['research', 'Research'],
  ['onboarding', 'Onboarding'],
  ['strategy', 'Strategy'],
  ['releases', 'Press Releases'],
  ['media', 'Media Lists'],
  ['pitches', 'Pitches'],
  ['reporting', 'Reporting'],
  ['docs', 'Docs'],
]

/** L1 clients build their own media lists and run their own outreach. */
export function visibleTabs(tier: Tier): readonly (readonly [WorkspaceTab, string])[] {
  if (tier !== 'L1') return ALL_TABS
  return ALL_TABS.filter(([tab]) => tab !== 'media' && tab !== 'pitches')
}

/** Tab label for a segment, including the two L1 hides (used by breadcrumbs). */
export function tabLabel(tab: WorkspaceTab): string {
  return ALL_TABS.find(([key]) => key === tab)?.[1] ?? tab
}

/** Release mode is set by tier — L2 means we edit the client's draft. */
export function autoReleaseMode(tier: Tier): 'A' | 'B' {
  return tier === 'L2' ? 'B' : 'A'
}

