'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/uploads'
import { uploadDocumentAction } from './actions'

/** Add a file to the client's knowledge base. */
export function UploadForm({ clientId }: { clientId: string }) {
  const { actions } = useStore()
  const [result, formAction, pending] = useActionState(uploadDocumentAction, null)
  const form = useRef<HTMLFormElement>(null)
  // Checked here too: an oversized body fails before the action can answer.
  const [tooBig, setTooBig] = useState(false)

  useEffect(() => {
    if (!result?.ok) return
    actions.flash(result.message)
    form.current?.reset()
    setTooBig(false)
  }, [result, actions])

  return (
    <form ref={form} action={formAction} className="card card--pad" style={{ gap: 14 }}>
      <input type="hidden" name="client_id" value={clientId} />
      <label className="dropzone" style={{ cursor: 'pointer' }}>
        <span style={{ fontWeight: 500 }}>Choose a file</span>
        <span className="hint hint--muted">PDF, DOCX, TXT, HTML or CSV, up to {MAX_UPLOAD_MB} MB</span>
        <input
          type="file"
          name="file"
          required
          style={{ marginTop: 8 }}
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_UPLOAD_BYTES)}
        />
      </label>
      <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span className="fieldLabel">Title</span>
          <input className="input" name="title" maxLength={300} placeholder="Defaults to the filename" />
        </label>
        <button type="submit" className="btn btn--primary" disabled={pending || tooBig}>
          {pending ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {tooBig && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
          That file is over {MAX_UPLOAD_MB} MB. Split it or compress it first.
        </span>
      )}
      {result && !result.ok && !tooBig && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
          {result.message}
        </span>
      )}
    </form>
  )
}
