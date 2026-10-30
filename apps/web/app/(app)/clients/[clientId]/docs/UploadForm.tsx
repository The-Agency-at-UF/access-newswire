'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { uploadDocumentAction } from './actions'

/** Add a file to the client's knowledge base. */
export function UploadForm({ clientId }: { clientId: string }) {
  const { actions } = useStore()
  const [result, formAction, pending] = useActionState(uploadDocumentAction, null)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!result?.ok) return
    actions.flash(result.message)
    form.current?.reset()
  }, [result, actions])

  return (
    <form ref={form} action={formAction} className="card card--pad" style={{ gap: 14 }}>
      <input type="hidden" name="client_id" value={clientId} />
      <label className="dropzone" style={{ cursor: 'pointer' }}>
        <span style={{ fontWeight: 500 }}>Choose a file</span>
        <span className="hint hint--muted">PDF, DOCX, TXT, HTML or CSV, up to 25 MB</span>
        <input type="file" name="file" required style={{ marginTop: 8 }} />
      </label>
      <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span className="fieldLabel">Title</span>
          <input className="input" name="title" maxLength={300} placeholder="Defaults to the filename" />
        </label>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {result && !result.ok && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
          {result.message}
        </span>
      )}
    </form>
  )
}
