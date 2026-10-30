/**
 * Inbox folders and label chips (AGENTS.md §12).
 *
 * Folders are views over `emails.status`, `label` and `owner_id`; nothing is
 * moved in the mailbox, since the app only has `Mail.Read`. Pure, so the
 * routing rules can be tested without a database.
 */

import type { Enums } from '@access/db'
import type { EmailLabel } from '../types'

export type FolderKey =
  | 'mine'
  | 'unmatched'
  | 'open'
  | 'release_info'
  | 'client_update'
  | 'sales_handoff'
  | 'social'
  | 'handled'
  | 'muted'

export interface Folder {
  key: FolderKey
  name: string
  /** Folders below the divider: done or muted mail. */
  quiet?: boolean
}

export const FOLDERS: readonly Folder[] = [
  { key: 'mine', name: 'Assigned to me' },
  { key: 'unmatched', name: 'Unmatched' },
  { key: 'open', name: 'All open' },
  { key: 'release_info', name: 'Release info' },
  { key: 'client_update', name: 'Client updates' },
  { key: 'sales_handoff', name: 'Sales handoffs' },
  { key: 'social', name: 'Social' },
  { key: 'handled', name: 'Handled', quiet: true },
  { key: 'muted', name: 'Auto-notifications', quiet: true },
]

/** Mail still waiting on someone: not handled, not muted. `new` is mid-classification. */
export const OPEN_STATUSES = ['new', 'routed', 'unmatched'] as const satisfies readonly Enums<'email_status'>[]

export interface FolderFilter {
  statuses: readonly Enums<'email_status'>[]
  label?: Enums<'email_label'>
  /** Only mail routed to this member. */
  ownerId?: string
}

export function parseFolder(value: string | undefined): FolderKey | null {
  return FOLDERS.some((f) => f.key === value) ? (value as FolderKey) : null
}

/** What a folder shows. `mine` needs the signed-in member's id; without one it is empty. */
export function folderFilter(key: FolderKey, memberId: string | null): FolderFilter | null {
  switch (key) {
    case 'mine':
      return memberId ? { statuses: ['routed'], ownerId: memberId } : null
    case 'unmatched':
      return { statuses: ['unmatched'] }
    case 'open':
      return { statuses: OPEN_STATUSES }
    case 'handled':
      return { statuses: ['handled'] }
    case 'muted':
      return { statuses: ['muted'] }
    default:
      return { statuses: OPEN_STATUSES, label: key }
  }
}

/** Whoever is on inbox duty starts in Unmatched; everyone else in their own mail. */
export function defaultFolder(onDuty: boolean): FolderKey {
  return onDuty ? 'unmatched' : 'mine'
}

const LABEL_CHIPS: Record<Enums<'email_label'>, EmailLabel> = {
  release_info: 'RELEASE INFO',
  client_update: 'CLIENT UPDATE',
  sales_handoff: 'SALES HANDOFF',
  social: 'SOCIAL',
  auto_notification: 'AUTO',
  other: 'OTHER',
}

export const LABEL_NAMES: Record<Enums<'email_label'>, string> = {
  release_info: 'Release info',
  client_update: 'Client update',
  sales_handoff: 'Sales handoff',
  social: 'Social',
  auto_notification: 'Auto-notification',
  other: 'Other',
}

/** The chips a message shows: its label, plus UNMATCHED while no client is set. */
export function emailChips(email: {
  label: Enums<'email_label'> | null
  client_id: string | null
  status: Enums<'email_status'>
}): EmailLabel[] {
  const chips: EmailLabel[] = []
  if (email.label) chips.push(LABEL_CHIPS[email.label])
  if (!email.client_id && email.status === 'unmatched') chips.push('UNMATCHED')
  return chips
}

/** The folder a message lives in, for links to it from elsewhere. */
export function folderOf(status: Enums<'email_status'>): FolderKey {
  if (status === 'handled') return 'handled'
  if (status === 'muted') return 'muted'
  return 'open'
}

/** Classifier confidence as a percentage, or null when a person or a rule set it. */
export function confidenceText(confidence: number | null): string | null {
  return confidence === null ? null : `${Math.round(Number(confidence) * 100)}%`
}
