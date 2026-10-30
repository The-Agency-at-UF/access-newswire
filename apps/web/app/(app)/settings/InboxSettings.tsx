'use client'

import { useActionState, useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import {
  addShiftAction,
  connectMailboxAction,
  removeShiftAction,
  type SettingsActionState,
} from './actions'

function useResult(result: SettingsActionState) {
  const { actions } = useStore()
  useEffect(() => {
    if (result?.ok) actions.flash(result.message)
  }, [result, actions])
  if (!result || result.ok) return null
  return (
    <span role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
      {result.message}
    </span>
  )
}

export function ConnectMailboxForm() {
  const [result, formAction, pending] = useActionState(connectMailboxAction, null)
  const error = useResult(result)
  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" name="mailbox" type="email" required placeholder="theagency@newswire.com" />
        <button type="submit" className="btn" disabled={pending}>
          {pending ? '…' : 'Connect'}
        </button>
      </div>
      {error}
    </form>
  )
}

/** `datetime-local` is in the viewer's time zone; the server gets UTC. */
function toIso(local: string): string {
  return local ? new Date(local).toISOString() : ''
}

export function AddShiftForm({ members }: { members: { id: string; name: string }[] }) {
  const [result, formAction, pending] = useActionState(addShiftAction, null)
  const error = useResult(result)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <select className="input" name="member_id" required defaultValue="">
        <option value="" disabled>
          Who
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: 1, minWidth: 160 }}>
          <span className="fieldLabel">Starts</span>
          <input className="input" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 160 }}>
          <span className="fieldLabel">Ends</span>
          <input className="input" type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <input type="hidden" name="starts_at" value={toIso(start)} />
      <input type="hidden" name="ends_at" value={toIso(end)} />
      <button type="submit" className="btn btn--sm" disabled={pending}>
        {pending ? '…' : 'Add shift'}
      </button>
      {error}
    </form>
  )
}

export function RemoveShiftButton({ id }: { id: string }) {
  const [result, formAction, pending] = useActionState(removeShiftAction, null)
  const error = useResult(result)
  return (
    <form action={formAction} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn--xs btn--quiet" disabled={pending} aria-label="Remove shift">
        {pending ? '…' : 'Remove'}
      </button>
      {error}
    </form>
  )
}

const shiftTime = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const endTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

/** A shift in the viewer's time zone, so it reads the way it was entered. */
export function ShiftTime({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const sameDay = start.toDateString() === end.toDateString()
  return (
    <span suppressHydrationWarning>
      {shiftTime.format(start)} – {sameDay ? endTime.format(end) : shiftTime.format(end)}
    </span>
  )
}
