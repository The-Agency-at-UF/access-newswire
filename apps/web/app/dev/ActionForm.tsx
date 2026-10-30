'use client'

import { useActionState, type ReactNode } from 'react'
import type { ActionState } from './actions'
import styles from './dev.module.css'

/** A form bound to a server action, showing the action's result inline. */
export function ActionForm({
  action,
  submit,
  children,
  inline = false,
  danger = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  submit: string
  children?: ReactNode
  inline?: boolean
  danger?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className={inline ? styles.inline : styles.form}>
      {children}
      <div className={inline ? styles.inline : styles.formFoot}>
        <button type="submit" disabled={pending} className={danger ? styles.danger : undefined}>
          {pending ? '…' : submit}
        </button>
        {state && <span className={state.ok ? styles.ok : styles.err}>{state.message}</span>}
      </div>
    </form>
  )
}
