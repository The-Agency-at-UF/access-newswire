'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { visibleTabs } from '@/lib/selectors/stages'
import { useStore } from '@/lib/store'
import type { Tier } from '@/lib/types'

/** The stage tabs. Also tells the shell which client is open, for its sidebar and breadcrumb. */
export function WorkspaceTabs({
  clientId,
  clientName,
  tier,
}: {
  clientId: string
  clientName: string
  tier: Tier
}) {
  const pathname = usePathname()
  const { setWorkspace } = useStore().actions

  useEffect(() => {
    setWorkspace({ id: clientId, name: clientName })
  }, [setWorkspace, clientId, clientName])

  return (
    <nav className="tabs" aria-label="Client stages">
      {visibleTabs(tier).map(([tab, label]) => {
        const href = `/clients/${clientId}/${tab}`
        return (
          <Link key={tab} href={href} className="tab" aria-current={pathname === href ? 'page' : undefined}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
