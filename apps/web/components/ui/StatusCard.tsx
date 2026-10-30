'use client'

import { StatusPill } from './badges'
import { SectionLabel } from './badges'
import type { StatusBadge } from '@/lib/selectors/stages'

/**
 * The status rail every stage shares: current status, the review/approve
 * action, and — once approved — what it locks and how to reopen.
 *
 * Reopening deliberately costs a click and drops the stage back to Draft:
 * downstream stages stop reading it until it is approved again.
 */
export function StatusCard({
  badge,
  version,
  isDraft,
  isApproved,
  lockedNote,
  onRequestReview,
  onApprove,
  onReopen,
}: {
  badge: StatusBadge
  version: string
  isDraft: boolean
  isApproved: boolean
  /** What downstream stage consumes this version once it is locked. */
  lockedNote: string
  onRequestReview: () => void
  onApprove: () => void
  onReopen: () => void
}) {
  return (
    <div className="card card--panel">
      <SectionLabel>Status</SectionLabel>
      <div className="spread">
        <StatusPill badge={badge} />
        <span className="monoSm">{version}</span>
      </div>

      {isDraft && (
        <button type="button" className="btn btn--block" onClick={onRequestReview}>
          Request review
        </button>
      )}

      {!isApproved && (
        <button type="button" className="btn btn--approve btn--block" onClick={onApprove}>
          Approve ✓
        </button>
      )}

      {isApproved && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="hint hint--muted">{lockedNote}</span>
          <button
            type="button"
            className="btn btn--quiet"
            style={{ color: 'var(--accent)', fontWeight: 500, alignSelf: 'flex-start' }}
            onClick={onReopen}
          >
            Reopen for edits
          </button>
        </div>
      )}
    </div>
  )
}
