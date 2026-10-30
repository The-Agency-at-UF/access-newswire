import type { ReactNode } from 'react'

/**
 * What a screen shows when there is nothing in the database for it yet: what
 * will appear here, and (optionally) the action that starts it.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="cardTitle">{title}</span>
      {children && <span className="hint hint--muted emptyBody">{children}</span>}
      {action}
    </div>
  )
}
