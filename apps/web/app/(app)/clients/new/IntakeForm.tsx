'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useStore } from '@/lib/store'
import { TIERS } from '@/lib/tokens'
import { TIERS as TIER_OPTIONS } from '@/lib/validation/client'
import { createClientAction } from './actions'

/**
 * New-client intake — the sales handoff, structured. Fields map one-to-one onto
 * `clients`; pre-filling from a handoff email arrives with the inbox.
 */
export function IntakeForm({ owners }: { owners: { id: string; name: string }[] }) {
  const { state } = useStore()
  const [result, formAction, pending] = useActionState(createClientAction, null)

  return (
    <form action={formAction} className="page page--list page--centered">
      <div className="pageNarrow">
        <div className="stack" style={{ gap: 4 }}>
          <Link href="/clients" className="hint hint--muted" style={{ fontSize: 12.5 }}>
            ← Clients
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>New client</h1>
        </div>

        <div
          className="card"
          style={{
            padding: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '18px 20px',
          }}
        >
          <label className="field">
            <span className="fieldLabel">
              Company name <span className="req">*</span>
            </span>
            <input className="input" name="name" required maxLength={200} placeholder="Company name" />
          </label>

          <label className="field">
            <span className="fieldLabel">Website</span>
            <input className="input" name="website" maxLength={300} placeholder="example.com" />
          </label>

          <label className="field">
            <span className="fieldLabel">Industry</span>
            <input className="input" name="industry" maxLength={120} placeholder="e.g. Fintech" />
          </label>

          <label className="field">
            <span className="fieldLabel">Release cadence</span>
            <input className="input" name="release_cadence" maxLength={60} placeholder="e.g. 1 / week" />
          </label>

          <fieldset className="field" style={{ gridColumn: '1 / -1', gap: 8, border: 0, padding: 0, margin: 0 }}>
            <legend className="fieldLabel" style={{ marginBottom: 8 }}>
              Service tier <span className="req">*</span>
            </legend>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
              }}
            >
              {TIER_OPTIONS.map((tier) => (
                <label key={tier} className="optionCard">
                  <input type="radio" name="tier" value={tier} required defaultChecked={tier === 'L2'} />
                  <span className="row" style={{ gap: 8 }}>
                    <span className="radio">
                      <span className="radioDot" />
                    </span>
                    <span style={{ fontWeight: 600 }}>{TIERS[tier].name}</span>
                  </span>
                  <span className="hint hint--muted">{TIERS[tier].inc}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span className="fieldLabel">Owner</span>
            <select className="input" name="owner_id" defaultValue={state.memberId ?? ''}>
              <option value="">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>

          <label className="row" style={{ gap: 10, alignItems: 'flex-start', gridColumn: '1 / -1' }}>
            <input type="checkbox" name="onboarded_externally" style={{ marginTop: 3 }} />
            <span className="stack" style={{ gap: 2 }}>
              <span className="fieldLabel">Already a client</span>
              <span className="hint hint--muted">
                Onboarded before this app. Skips research, the deck and strategy, so releases can start right away.
              </span>
            </span>
          </label>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {result && (
            <span role="alert" style={{ color: 'var(--danger)', marginRight: 'auto' }}>
              {result.message}
            </span>
          )}
          <Link href="/clients" className="btn btn--tall" style={{ borderRadius: 8 }}>
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn--primary btn--tall"
            style={{ borderRadius: 8 }}
            disabled={pending}
          >
            {pending ? 'Creating…' : 'Create client →'}
          </button>
        </div>
      </div>
    </form>
  )
}
