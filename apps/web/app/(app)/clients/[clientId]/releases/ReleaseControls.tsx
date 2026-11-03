'use client'

import { useActionState, useEffect, useState } from 'react'
import type { Enums } from '@access/db'
import type { EditedRelease, WrittenRelease } from '@/lib/releaseDraft'
import { useStore } from '@/lib/store'
import { reviewReleaseAction, saveReleaseAction, type ReleaseActionState } from './actions'

function useFlash(result: ReleaseActionState, onOk?: () => void) {
  const { actions } = useStore()
  useEffect(() => {
    if (!result?.ok) return
    actions.flash(result.message)
    onOk?.()
    // onOk is a fresh closure each render; the result is what changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, actions])
}

function ErrorLine({ result }: { result: ReleaseActionState }) {
  if (!result || result.ok) return null
  return (
    <span role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
      {result.message}
    </span>
  )
}

type EditorProps = { artifactId: string; versionId: string; children: React.ReactNode } & (
  | { mode: 'write'; content: WrittenRelease }
  | { mode: 'edit'; content: EditedRelease }
)

/**
 * The draft, with an Edit button that swaps it for a form. Saving makes a new
 * version; Cancel throws the changes away.
 */
export function ReleaseEditor(props: EditorProps) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <div className="stack" style={{ gap: 0 }}>
        <div className="row" style={{ padding: '12px 20px 0', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>
            {props.mode === 'edit' ? 'Review suggestions' : 'Edit draft'}
          </button>
        </div>
        {props.children}
      </div>
    )
  }
  const done = () => setEditing(false)
  return props.mode === 'edit' ? (
    <EditedForm artifactId={props.artifactId} versionId={props.versionId} content={props.content} onDone={done} />
  ) : (
    <WrittenForm artifactId={props.artifactId} versionId={props.versionId} content={props.content} onDone={done} />
  )
}

function FormFooter({ pending, result, onCancel }: { pending: boolean; result: ReleaseActionState; onCancel: () => void }) {
  return (
    <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
      <button type="submit" className="btn btn--sm btn--primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save version'}
      </button>
      <button type="button" className="btn btn--sm" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <span className="hint hint--muted">Saving keeps every earlier version.</span>
      <ErrorLine result={result} />
    </div>
  )
}

function WrittenForm({
  artifactId,
  versionId,
  content,
  onDone,
}: {
  artifactId: string
  versionId: string
  content: WrittenRelease
  onDone: () => void
}) {
  const [result, formAction, pending] = useActionState(saveReleaseAction, null)
  useFlash(result, onDone)
  return (
    <form action={formAction} className="docBody stack" style={{ gap: 14 }}>
      <input type="hidden" name="artifact_id" value={artifactId} />
      <input type="hidden" name="parent_version_id" value={versionId} />
      <label className="field">
        <span className="fieldLabel">Headline</span>
        <input className="input" name="headline" defaultValue={content.headline} required />
      </label>
      <label className="field">
        <span className="fieldLabel">Subheadline</span>
        <input className="input" name="subheadline" defaultValue={content.subheadline ?? ''} placeholder="Optional" />
      </label>
      <label className="field">
        <span className="fieldLabel">Dateline</span>
        <input className="input" name="dateline" defaultValue={content.dateline} required />
      </label>
      {content.sections.map((section) => (
        <fieldset key={section.id} className="stack" style={{ gap: 6, border: 0, padding: 0, margin: 0 }}>
          <input type="hidden" name="section_id" value={section.id} />
          <label className="field">
            <span className="fieldLabel">Section heading</span>
            <input className="input" name="section_heading" defaultValue={section.heading} />
          </label>
          <label className="field">
            <span className="fieldLabel">{section.heading || 'Section'} text</span>
            <textarea className="textarea" name="section_body" defaultValue={section.body} rows={4} />
          </label>
        </fieldset>
      ))}
      <label className="field">
        <span className="fieldLabel">About the company</span>
        <textarea className="textarea textarea--sm" name="boilerplate" defaultValue={content.boilerplate} rows={3} />
      </label>
      <span className="hint hint--muted">Clear a section&rsquo;s text to remove it.</span>
      <FormFooter pending={pending} result={result} onCancel={onDone} />
    </form>
  )
}

function EditedForm({
  artifactId,
  versionId,
  content,
  onDone,
}: {
  artifactId: string
  versionId: string
  content: EditedRelease
  onDone: () => void
}) {
  const [result, formAction, pending] = useActionState(saveReleaseAction, null)
  const [kept, setKept] = useState(() => content.suggested_edits.map(() => true))
  useFlash(result, onDone)
  return (
    <form action={formAction} className="docBody stack" style={{ gap: 14 }}>
      <input type="hidden" name="artifact_id" value={artifactId} />
      <input type="hidden" name="parent_version_id" value={versionId} />
      {content.sections.map((section) => (
        <div key={section.id} className="docSection">
          {section.heading && <h3>{section.heading}</h3>}
          <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>
            {section.body}
          </p>
          {content.suggested_edits.map((edit, i) =>
            edit.section_id !== section.id ? null : (
              <div key={i} className={`editCard ${kept[i] ? 'editCard--accepted' : 'editCard--rejected'}`}>
                <span className="editFrom">{edit.original}</span>
                <label className="field">
                  <span className="fieldLabel">Suggested wording</span>
                  <textarea
                    className="textarea textarea--sm"
                    name={`suggestion_${i}`}
                    defaultValue={edit.suggestion}
                    rows={2}
                    disabled={!kept[i]}
                  />
                </label>
                <span className="hint hint--muted">{edit.reason}</span>
                <label className="row" style={{ gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    name={`keep_${i}`}
                    checked={kept[i]}
                    onChange={(e) => setKept((all) => all.map((k, j) => (j === i ? e.target.checked : k)))}
                  />
                  Keep this suggestion
                </label>
              </div>
            ),
          )}
        </div>
      ))}
      <FormFooter pending={pending} result={result} onCancel={onDone} />
    </form>
  )
}

/**
 * Send for review, then approve or request changes. Shown for the latest
 * version only; the database refuses older ones anyway.
 */
export function ReviewPanel({
  clientId,
  versionId,
  status,
}: {
  clientId: string
  versionId: string
  status: Enums<'artifact_status'>
}) {
  const [result, formAction, pending] = useActionState(reviewReleaseAction, null)
  useFlash(result)
  if (status === 'approved' || status === 'archived') return null

  return (
    <form action={formAction} className="stack" style={{ gap: 8 }} key={`${versionId}:${status}`}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="version_id" value={versionId} />
      <label className="field">
        <span className="fieldLabel">{status === 'in_review' ? 'Comment' : 'Note for the reviewer'}</span>
        <textarea
          className="textarea textarea--sm"
          name="comment"
          rows={2}
          maxLength={2000}
          placeholder={status === 'in_review' ? 'Required to request changes' : 'Optional'}
        />
      </label>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {status === 'draft' ? (
          <button type="submit" name="action" value="submit" className="btn btn--sm btn--primary" disabled={pending}>
            Send for review
          </button>
        ) : (
          <>
            <button type="submit" name="action" value="approve" className="btn btn--sm btn--approve" disabled={pending}>
              Approve
            </button>
            <button type="submit" name="action" value="changes" className="btn btn--sm" disabled={pending}>
              Request changes
            </button>
          </>
        )}
      </div>
      <ErrorLine result={result} />
    </form>
  )
}
