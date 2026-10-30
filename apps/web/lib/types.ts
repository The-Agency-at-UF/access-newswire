/**
 * Domain types for the ACCESS PR Bot UI.
 *
 * These mirror the enums in AGENTS.md §8 so the UI speaks the same language as
 * the schema. Table rows come from the generated types in `@access/db`; what is
 * here is presentation-side only.
 */

import type { Enums } from '@access/db'

export type Tier = Enums<'tier'>

/** `artifact_status` plus the non-artifact states the UI shows in the same pill. */
export type ArtifactStatus = 'Draft' | 'In Review' | 'Approved' | 'Archived'
export type DisplayStatus =
  | ArtifactStatus
  | 'Indexed'
  | 'Not started'
  | 'Scheduled'
  | 'Pending'

/** Artifact kinds this UI renders. Mirrors `artifact_type`, minus `report`. */
export type ArtifactKey = 'research' | 'deck' | 'strategy' | 'release' | 'media' | 'pitch'

/** Everything the client-state record tracks: artifacts plus milestone booleans. */
export type StageKey = ArtifactKey | 'm1' | 'm2' | 'upload'

export type EmailLabel =
  | 'RELEASE INFO'
  | 'SALES HANDOFF'
  | 'CLIENT UPDATE'
  | 'SOCIAL'
  | 'UNMATCHED'
  | 'AUTO'

/** Workspace tab / route segment for a client. */
export type WorkspaceTab =
  | 'overview'
  | 'research'
  | 'onboarding'
  | 'strategy'
  | 'releases'
  | 'media'
  | 'pitches'
  | 'reporting'
  | 'docs'

export type PillarTag = 'A' | 'B' | 'C'
export type FlagKind = 'amber' | 'red' | 'green'

export interface Swatch {
  bg: string
  fg: string
}

export interface StatusSwatch extends Swatch {
  dot: string
}

export interface TierInfo extends Swatch {
  name: string
  /** What the tier includes, in one sentence. */
  inc: string
  /** Internal upsell note. */
  up: string
  bullets: string[]
}

export interface FlagInfo extends Swatch {
  /** Single-character glyph shown in the flag dot. */
  g: string
}

/** A stage in a pipeline rail: [state key, label, route segment]. */
export type StageSpec = readonly [StageKey, string, WorkspaceTab]

/** Per-client stage state. Artifact keys hold a status; milestones hold a boolean. */
export interface ClientState {
  research: ArtifactStatus | null
  deck: ArtifactStatus | null
  strategy: ArtifactStatus | null
  release: ArtifactStatus | null
  media: ArtifactStatus | null
  pitch: ArtifactStatus | null
  m1: boolean
  m2: boolean
  upload: boolean
}
