'use client'

import { useActionState } from 'react'
import { TIERS } from '@/lib/validation/client'
import { createClientAction } from './actions'
import styles from './dev.module.css'

interface Owner {
  id: string
  name: string
}

export function ClientForm({ owners }: { owners: Owner[] }) {
  const [state, formAction, pending] = useActionState(createClientAction, null)

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Name
        <input name="name" required placeholder="Company name" />
      </label>
      <label>
        Website
        <input name="website" placeholder="example.com" />
      </label>
      <label>
        Industry
        <input name="industry" placeholder="e.g. Fintech" />
      </label>
      <label>
        Tier
        <select name="tier" defaultValue="L2">
          {TIERS.map((tier) => (
            <option key={tier}>{tier}</option>
          ))}
        </select>
      </label>
      <label>
        Cadence
        <input name="release_cadence" placeholder="1 / week" />
      </label>
      <label>
        Owner
        <select name="owner_id" defaultValue="">
          <option value="">Unassigned</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.formFoot}>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create client'}
        </button>
        {state && <span className={state.ok ? styles.ok : styles.err}>{state.message}</span>}
      </div>
    </form>
  )
}
