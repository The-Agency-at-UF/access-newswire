'use client'

import { useLiveRefresh } from '@/components/LiveRefresh'
import styles from './dev.module.css'

/** Live refresh with its channel state shown, for the console. */
export function LiveRefresh({ tables }: { tables: string[] }) {
  return <span className={styles.pill}>live: {useLiveRefresh(tables)}</span>
}
