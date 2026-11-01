'use client'

import { useActionState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { setOnboardedExternallyAction } from './actions'

/** Switch a client between the full onboarding flow and "already a client". */
export function OnboardedToggle({ clientId, onboardedExternally }: { clientId: string; onboardedExternally: boolean }) {
  const { actions } = useStore()
  const [result, formAction, pending] = useActionState(setOnboardedExternallyAction, null)

  useEffect(() => {
    if (result?.ok) actions.flash(result.message)
  }, [result, actions])

  return (
    <form action={formAction} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="value" value={String(!onboardedExternally)} />
      <button type="submit" className="btn btn--xs btn--quiet" disabled={pending}>
        {pending ? '…' : onboardedExternally ? 'Use the onboarding flow' : 'Already a client? Skip onboarding'}
      </button>
      {result && !result.ok && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{result.message}</span>}
    </form>
  )
}
