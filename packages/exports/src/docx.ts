/**
 * Strategy, release and report documents (.docx). L2 release edits export as
 * Word tracked changes, so the client accepts or rejects each one in Word
 * (AGENTS.md §13).
 */

import {
  AlignmentType,
  DeletedTextRun,
  Document,
  HeadingLevel,
  InsertedTextRun,
  Packer,
  Paragraph,
  TextRun,
  type ParagraphChild,
} from 'docx'

export interface DocSection {
  id: string
  heading: string
  body: string
}

export interface SuggestedEdit {
  section_id: string
  original: string
  suggestion: string
  reason: string
}

export interface DocxInput {
  title: string
  subtitle?: string | null
  sections: DocSection[]
  /** Press releases: printed above the body. */
  release?: { headline: string; subheadline: string | null; dateline: string; boilerplate: string } | null
  /** L2 edits: applied to the sections as tracked changes. */
  suggestedEdits?: SuggestedEdit[] | null
  author?: string
}

function paragraphs(text: string, runs: (line: string) => ParagraphChild[] = (line) => [new TextRun(line)]): Paragraph[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => new Paragraph({ children: runs(block), spacing: { after: 160 } }))
}

/**
 * Split a section body into runs, marking each suggested edit as a deletion
 * of the original text followed by an insertion of the suggestion. Edits
 * whose original text isn't found verbatim are left out of the body.
 */
export function trackedRuns(body: string, edits: SuggestedEdit[], author: string, date: string, nextId: () => number): ParagraphChild[] {
  const runs: ParagraphChild[] = []
  let rest = body
  const pending = edits.filter((edit) => edit.original && body.includes(edit.original))

  while (rest) {
    const hits = pending
      .map((edit) => ({ edit, at: rest.indexOf(edit.original) }))
      .filter((hit) => hit.at >= 0)
      .sort((a, b) => a.at - b.at)
    const hit = hits[0]
    if (!hit) {
      runs.push(new TextRun(rest))
      break
    }
    if (hit.at > 0) runs.push(new TextRun(rest.slice(0, hit.at)))
    runs.push(new DeletedTextRun({ text: hit.edit.original, id: nextId(), author, date }))
    runs.push(new InsertedTextRun({ text: hit.edit.suggestion, id: nextId(), author, date }))
    rest = rest.slice(hit.at + hit.edit.original.length)
    pending.splice(pending.indexOf(hit.edit), 1)
  }
  return runs
}

export async function renderDocx(input: DocxInput): Promise<Buffer> {
  const author = input.author ?? 'ACCESS PR'
  const date = new Date().toISOString()
  let changeId = 1
  const nextId = () => changeId++

  const children: Paragraph[] = []

  if (input.release) {
    children.push(new Paragraph({ text: input.release.headline, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }))
    if (input.release.subheadline) {
      children.push(new Paragraph({ children: [new TextRun({ text: input.release.subheadline, italics: true })], alignment: AlignmentType.CENTER }))
    }
    children.push(new Paragraph({ children: [new TextRun({ text: `${input.release.dateline} — `, bold: true })] }))
  } else {
    children.push(new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }))
    if (input.subtitle) children.push(new Paragraph({ children: [new TextRun({ text: input.subtitle, italics: true })] }))
  }

  for (const section of input.sections) {
    if (!input.release) children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }))
    const edits = (input.suggestedEdits ?? []).filter((edit) => edit.section_id === section.id)
    children.push(...paragraphs(section.body, edits.length ? (line) => trackedRuns(line, edits, author, date, nextId) : undefined))
  }

  if (input.release) {
    children.push(new Paragraph({ text: 'About', heading: HeadingLevel.HEADING_2 }))
    children.push(...paragraphs(input.release.boilerplate))
    children.push(new Paragraph({ text: '###', alignment: AlignmentType.CENTER }))
  }

  const doc = new Document({
    creator: author,
    title: input.title,
    features: input.suggestedEdits?.length ? { trackRevisions: true } : undefined,
    sections: [{ children }],
  })
  return Packer.toBuffer(doc)
}
