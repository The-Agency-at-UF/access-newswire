'use client'

import { useActionState } from 'react'
import { deleteClientAction } from './actions'
import styles from './dev.module.css'

/** Any member can press it; RLS decides. Non-admins see the refusal. */
export function DeleteClientButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteClientAction, null)

  return (
    <form action={formAction} className={styles.inline}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={styles.danger}>
        Delete
      </button>
      {state && !state.ok && <span className={styles.err}>{state.message}</span>}
    </form>
  )
}
