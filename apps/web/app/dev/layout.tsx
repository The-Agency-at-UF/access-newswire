import Link from 'next/link'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import styles from './dev.module.css'

const PAGES = [
  ['/dev', 'Session & clients'],
  ['/dev/work', 'Releases & artifacts'],
  ['/dev/docs', 'Documents & search'],
  ['/dev/inbox', 'Inbox'],
  ['/dev/directory', 'Directory'],
  ['/dev/settings', 'Frameworks & settings'],
] as const

/**
 * Barebone console for exercising the backend by hand: every table, rule and
 * job type is reachable from here, through RLS and the database functions.
 * Not part of the product UI.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Backend console</h1>
          <nav className={styles.nav}>
            {PAGES.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className={styles.headerActions}>
          <Link href="/clients">App →</Link>
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/dev" />
          <UserButton />
        </div>
      </header>
      {children}
    </div>
  )
}
