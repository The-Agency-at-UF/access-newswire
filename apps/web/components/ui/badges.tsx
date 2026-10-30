import type { ReactNode } from 'react'
import { TIERS } from '@/lib/tokens'
import type { StatusBadge } from '@/lib/selectors/stages'
import type { FlagInfo, Swatch, Tier } from '@/lib/types'

/** Status pill — the one place a stage's state is rendered. */
export function StatusPill({ badge, prefix }: { badge: StatusBadge; prefix?: string }) {
  return (
    <span className="pill" style={{ background: badge.bg, color: badge.fg }}>
      <span className="pillDot" style={{ background: badge.dot }} />
      {prefix ? `${prefix} ${badge.label}` : badge.label}
    </span>
  )
}

export function TierBadge({ tier }: { tier: Tier }) {
  const { bg, fg } = TIERS[tier]
  return (
    <span className="tierBadge" style={{ background: bg, color: fg }} title={TIERS[tier].name}>
      {tier}
    </span>
  )
}

/** Classifier label chip. The label is a suggestion, so it reads as metadata. */
export function LabelChip({
  label,
  swatch,
  size,
}: {
  label: string
  swatch: Swatch
  size?: 'xs'
}) {
  return (
    <span
      className={size === 'xs' ? 'labelChip labelChip--xs' : 'labelChip'}
      style={{ background: swatch.bg, color: swatch.fg }}
    >
      {label}
    </span>
  )
}

/**
 * AGENTS.md rule 9: AI output carries a label until a person edits or approves
 * it. Render this wherever an unapproved generated draft is shown.
 */
export function AiDraftBadge() {
  return <span className="aiDraft">AI DRAFT</span>
}

/** `CORE` for the client's reusable list, `+ STORY` for a story-specific add. */
export function ListTag({ label }: { label: string }) {
  return <span className={label === 'CORE' ? 'tag' : 'tag tag--story'}>{label}</span>
}

/** Journalist warning: bounced email, over-pitched, or recently covered. */
export function FlagDot({
  info,
  text,
  size,
}: {
  info: FlagInfo | null
  text: string
  size?: 'sm'
}) {
  if (!info) return <span />
  return (
    <span
      className={size === 'sm' ? 'flagDot flagDot--sm' : 'flagDot'}
      style={{ background: info.bg, color: info.fg, display: 'grid' }}
      title={text}
    >
      {info.g}
    </span>
  )
}

export function SectionLabel({
  children,
  size,
}: {
  children: ReactNode
  size?: 'sm' | 'field'
}) {
  const cls =
    size === 'sm'
      ? 'sectionLabel sectionLabel--sm'
      : size === 'field'
        ? 'sectionLabel sectionLabel--field'
        : 'sectionLabel'
  return <span className={cls}>{children}</span>
}

export function Caret() {
  return (
    <span className="caret" aria-hidden>
      ▾
    </span>
  )
}
