/**
 * Design tokens from the `ACCESS PR Bot v2` design-system project.
 *
 * Colours that vary per data value live here as objects; everything static
 * lives in `app/globals.css` as a custom property. Keep the two in step.
 */

import type { Enums } from '@access/db'
import type { StatusBadge } from './selectors/stages'
import type {
  DisplayStatus,
  EmailLabel,
  FlagInfo,
  FlagKind,
  PillarTag,
  StageSpec,
  StatusSwatch,
  Swatch,
  Tier,
  TierInfo,
} from './types'

/** Status pill palette, keyed by the label the pill shows. */
export const STATUS: Record<DisplayStatus, StatusSwatch> = {
  'Draft': { bg: '#ECEBE6', fg: '#55534D', dot: '#A19E94' },
  'In Review': { bg: '#FBEFD6', fg: '#7F5200', dot: '#D9930B' },
  'Approved': { bg: '#E1F0E4', fg: '#1D6633', dot: '#2F9E52' },
  'Archived': { bg: '#EEEDE9', fg: '#86847E', dot: '#BDBAB2' },
  'Indexed': { bg: '#F0F1F8', fg: '#3B4A8F', dot: '#7F8BC4' },
  'Not started': { bg: '#F4F3EF', fg: '#8D8B85', dot: '#D6D4CC' },
  'Scheduled': { bg: '#EEF0FA', fg: '#3B4A8F', dot: '#7F8BC4' },
  'Pending': { bg: '#ECEBE6', fg: '#55534D', dot: '#A19E94' },
}

export const TIERS: Record<Tier, TierInfo> = {
  L1: {
    bg: '#ECEBE6',
    fg: '#4A4944',
    name: 'Level 1',
    inc: 'We write each release. Client finds journalists and handles outreach. ACCESS stats reporting.',
    up: 'L2 adds: media lists, ACCESS upload, outreach.',
    bullets: [
      'We write each release',
      'You build media lists and handle outreach',
      'Monthly ACCESS stats report',
    ],
  },
  L2: {
    bg: '#E6EBFA',
    fg: '#233C9E',
    name: 'Level 2',
    inc: 'We edit the client’s releases, build media lists, upload to ACCESS, and run outreach.',
    up: 'L3 adds: we write every release.',
    bullets: [
      'You draft, we edit each release',
      'We build media lists and upload to ACCESS',
      'We handle journalist outreach',
    ],
  },
  L3: {
    bg: '#1A1B1E',
    fg: '#FFFFFF',
    name: 'Level 3',
    inc: 'We write every release, build media lists, upload to ACCESS, and run outreach.',
    up: 'Top tier. Confirm whether social is included.',
    bullets: [
      'We write every release',
      'We build media lists and upload to ACCESS',
      'We handle journalist outreach',
    ],
  },
}

/** Onboarding pipeline: the same five stages for every tier. */
export const ONBOARDING_STAGES: readonly StageSpec[] = [
  ['research', 'Research', 'research'],
  ['deck', 'Deck', 'onboarding'],
  ['m1', 'Meeting 1', 'onboarding'],
  ['strategy', 'Strategy', 'strategy'],
  ['m2', 'Meeting 2', 'strategy'],
]

/**
 * Release pipeline per tier — this is where the tier gating in AGENTS.md §1
 * becomes visible: L1 has no media list, no ACCESS upload and no outreach.
 */
export const RELEASE_STAGES: Record<Tier, readonly StageSpec[]> = {
  L1: [['release', 'Write release', 'releases']],
  L2: [
    ['release', 'Edit client release', 'releases'],
    ['media', 'Media list', 'media'],
    ['upload', 'Upload to ACCESS', 'media'],
    ['pitch', 'Outreach', 'pitches'],
  ],
  L3: [
    ['release', 'Write release', 'releases'],
    ['media', 'Media list', 'media'],
    ['upload', 'Upload to ACCESS', 'media'],
    ['pitch', 'Outreach', 'pitches'],
  ],
}

/** Strategy pillar colours. */
export const PILLAR_COLORS: Record<PillarTag, Swatch> = {
  A: { bg: '#E6EBFA', fg: '#233C9E' },
  B: { bg: '#F7E9DE', fg: '#8A4316' },
  C: { bg: '#E2EEE8', fg: '#24614A' },
}

/** Journalist warning flags. */
export const FLAGS: Record<FlagKind, FlagInfo> = {
  amber: { bg: '#FBEFD6', fg: '#7F5200', g: '!' },
  red: { bg: '#F8E3DE', fg: '#9C3520', g: '×' },
  green: { bg: '#E1F0E4', fg: '#1D6633', g: '✓' },
}

/** Inbox label chips, keyed by classifier label. */
export const LABEL_COLORS: Record<EmailLabel, Swatch> = {
  'RELEASE INFO': { bg: '#E6EBFA', fg: '#233C9E' },
  'SALES HANDOFF': { bg: '#E1F0E4', fg: '#1D6633' },
  'CLIENT UPDATE': { bg: '#FBEFD6', fg: '#7F5200' },
  'SOCIAL': { bg: '#F7E9DE', fg: '#8A4316' },
  'OTHER': { bg: '#ECEBE6', fg: '#55534D' },
  'UNMATCHED': { bg: '#F8E3DE', fg: '#9C3520' },
  'AUTO': { bg: '#EEEDE9', fg: '#6B6A65' },
}

const FAILED: StatusBadge = { label: 'Failed', bg: '#F8E3DE', fg: '#9C3520', dot: '#C9583F' }

/** Document index state, as the Docs screen shows it. */
export const INDEX_STATUS: Record<Enums<'index_status'>, StatusBadge> = {
  pending: { label: 'Queued', ...STATUS.Pending },
  indexing: { label: 'Indexing', ...STATUS['In Review'] },
  indexed: { label: 'Indexed', ...STATUS.Indexed },
  failed: FAILED,
  skipped: { label: 'Not indexed', ...STATUS['Not started'] },
}

/** Where a document came from, as the Docs filter names it. */
export const DOC_SOURCES: Record<Enums<'document_source'>, string> = {
  upload: 'Upload',
  email_attachment: 'Inbox',
  generated: 'Generated',
  note: 'Note',
}

/** Background job state, as the Activity card shows it. */
export const JOB_STATUS: Record<Enums<'job_status'>, StatusBadge> = {
  queued: { label: 'Queued', ...STATUS.Pending },
  running: { label: 'Running', ...STATUS['In Review'] },
  succeeded: { label: 'Done', ...STATUS.Approved },
  failed: FAILED,
  canceled: { label: 'Canceled', ...STATUS.Archived },
}
