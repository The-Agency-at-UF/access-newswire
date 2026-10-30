'use client'

import { useActionState, useEffect } from 'react'
import type { Enums } from '@access/db'
import { LABEL_NAMES } from '@/lib/selectors/inbox'
import { useStore } from '@/lib/store'
import { correctEmailAction, setHandledAction, type InboxActionState } from './actions'

function useFlash(result: InboxActionState) {
  const { actions } = useStore()
  useEffect(() => {
    if (result?.ok) actions.flash(result.message)
  }, [result, actions])
}

function ErrorLine({ result }: { result: InboxActionState }) {
  if (!result || result.ok) return null
  return (
    <span role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
      {result.message}
    </span>
  )
}

/** Mark handled / reopen. */
export function HandledButton({ emailId, handled }: { emailId: string; handled: boolean }) {
  const [result, formAction, pending] = useActionState(setHandledAction, null)
  useFlash(result)
  return (
    <form action={formAction} className="stack" style={{ gap: 6 }}>
      <input type="hidden" name="email_id" value={emailId} />
      <input type="hidden" name="handled" value={String(!handled)} />
      <button type="submit" className={handled ? 'btn btn--sm' : 'btn btn--sm btn--approve'} disabled={pending}>
        {pending ? '…' : handled ? 'Reopen' : 'Mark handled'}
      </button>
      <ErrorLine result={result} />
    </form>
  )
}

/**
 * Fix the client or label. Saving routes the message (or sends it back to
 * Unmatched) and, with "Remember this sender", teaches the rules.
 */
export function CorrectionForm({
  emailId,
  clientId,
  label,
  clients,
}: {
  emailId: string
  clientId: string | null
  label: Enums<'email_label'> | null
  clients: { id: string; name: string }[]
}) {
  const [result, formAction, pending] = useActionState(correctEmailAction, null)
  useFlash(result)

  return (
    <form action={formAction} className="stack" style={{ gap: 10 }} key={`${emailId}:${clientId}:${label}`}>
      <input type="hidden" name="email_id" value={emailId} />
      <label className="field">
        <span className="fieldLabel">Client</span>
        <select className="input" name="client_id" defaultValue={clientId ?? ''}>
          <option value="">No client (Unmatched)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="fieldLabel">Label</span>
        <select className="input" name="label" defaultValue={label ?? 'other'}>
          {(Object.keys(LABEL_NAMES) as Enums<'email_label'>[]).map((l) => (
            <option key={l} value={l}>
              {LABEL_NAMES[l]}
            </option>
          ))}
        </select>
      </label>
      <label className="row" style={{ gap: 8, fontSize: 12.5 }}>
        <input type="checkbox" name="remember" defaultChecked />
        Remember this sender
      </label>
      <button type="submit" className="btn btn--sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <ErrorLine result={result} />
    </form>
  )
}
