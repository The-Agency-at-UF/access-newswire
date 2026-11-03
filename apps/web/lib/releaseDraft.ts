/**
 * Turning the Releases tab's edit forms into a new version's content.
 *
 * Pure, so the rules are testable: who a version is credited to, what a
 * written release form holds, and which L2 suggestions survive a save.
 */

import type { z } from 'zod'
import type { Enums } from '@access/db'
import type { pressReleaseSchema, releaseEditSchema } from '@access/ai/schemas'

export type WrittenRelease = z.infer<typeof pressReleaseSchema>
export type EditedRelease = z.infer<typeof releaseEditSchema>

/** A person editing an AI (or partly AI) draft makes it mixed; editing their own stays human. */
export function nextOrigin(previous: Enums<'version_origin'> | null | undefined): Enums<'version_origin'> {
  return previous && previous !== 'human' ? 'mixed' : 'human'
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim()

/**
 * A written release from its edit form. Sections arrive as parallel
 * `section_id` / `section_heading` / `section_body` fields, in order; empty
 * sections are dropped.
 */
export function writtenFromForm(formData: FormData): WrittenRelease {
  const ids = formData.getAll('section_id').map(String)
  const headings = formData.getAll('section_heading').map((v) => String(v).trim())
  const bodies = formData.getAll('section_body').map((v) => String(v).trim())
  return {
    headline: text(formData, 'headline'),
    subheadline: text(formData, 'subheadline') || null,
    dateline: text(formData, 'dateline'),
    sections: ids
      .map((id, i) => ({ id, heading: headings[i] ?? '', body: bodies[i] ?? '' }))
      .filter((section) => section.body),
    boilerplate: text(formData, 'boilerplate'),
  }
}

/**
 * An L2 edit after review: the client's sections stay exactly as they were
 * (they come from the saved version, not the form), and only the suggestions
 * marked `keep_<i>` remain, with their wording as edited in `suggestion_<i>`.
 */
export function editedFromForm(formData: FormData, previous: EditedRelease): EditedRelease {
  return {
    sections: previous.sections,
    suggested_edits: previous.suggested_edits.flatMap((edit, i) => {
      if (formData.get(`keep_${i}`) !== 'on') return []
      const suggestion = text(formData, `suggestion_${i}`) || edit.suggestion
      return [{ ...edit, suggestion }]
    }),
  }
}

/** Short labels for a version's origin in the history list. */
export const ORIGIN_LABEL: Record<Enums<'version_origin'>, string> = {
  ai: 'AI draft',
  mixed: 'Edited',
  human: 'Written by hand',
}
