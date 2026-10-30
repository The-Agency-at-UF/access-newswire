'use client'

import type { ReactNode } from 'react'

/**
 * The tick-box glyph.
 *
 * Decorative only: the whole label row is the hit target, so the parent button
 * carries `aria-pressed` and the accessible name. That matches the design,
 * where clicking anywhere on the row toggles it.
 */
export function Checkbox({ on, size }: { on: boolean; size?: 'sm' }) {
  const classes = ['checkbox']
  if (size === 'sm') classes.push('checkbox--sm')
  if (on) classes.push('checkbox--on')
  return (
    <span className={classes.join(' ')} aria-hidden>
      {on ? '✓' : ''}
    </span>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/** Two- or three-way switch: My clients / All, release mode, intake source. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  grow,
  label,
}: {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  grow?: boolean
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={grow ? 'segmentedBtn segmentedBtn--grow' : 'segmentedBtn'}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Pill filter, as used by the Docs type filter. */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="filterChip" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}
