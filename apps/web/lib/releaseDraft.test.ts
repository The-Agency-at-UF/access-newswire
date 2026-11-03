import { describe, expect, it } from 'vitest'
import { editedFromForm, nextOrigin, writtenFromForm, type EditedRelease } from './releaseDraft'

const form = (entries: [string, string][]) => {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

describe('nextOrigin', () => {
  it('marks an edited AI draft as mixed and keeps a person’s own work human', () => {
    expect(nextOrigin('ai')).toBe('mixed')
    expect(nextOrigin('mixed')).toBe('mixed')
    expect(nextOrigin('human')).toBe('human')
    expect(nextOrigin(null)).toBe('human')
  })
})

describe('writtenFromForm', () => {
  it('reads the fields and sections in order, dropping empty sections', () => {
    const release = writtenFromForm(
      form([
        ['headline', ' Big news '],
        ['subheadline', ''],
        ['dateline', 'AUSTIN, Texas — Nov 9, 2026'],
        ['section_id', 'lede'],
        ['section_heading', 'Opening'],
        ['section_body', 'First paragraph.'],
        ['section_id', 'gone'],
        ['section_heading', 'Removed'],
        ['section_body', '  '],
        ['section_id', 'quote'],
        ['section_heading', 'Quote'],
        ['section_body', '"Hello."'],
        ['boilerplate', 'About us.'],
      ]),
    )
    expect(release).toEqual({
      headline: 'Big news',
      subheadline: null,
      dateline: 'AUSTIN, Texas — Nov 9, 2026',
      sections: [
        { id: 'lede', heading: 'Opening', body: 'First paragraph.' },
        { id: 'quote', heading: 'Quote', body: '"Hello."' },
      ],
      boilerplate: 'About us.',
    })
  })
})

describe('editedFromForm', () => {
  const previous: EditedRelease = {
    sections: [{ id: 'lede', heading: 'Opening', body: 'We are thrilled to announce a thing.' }],
    suggested_edits: [
      { section_id: 'lede', original: 'We are thrilled to announce', suggestion: 'Today we announced', reason: 'Lead with news.' },
      { section_id: 'lede', original: 'a thing', suggestion: 'a product', reason: 'Be specific.' },
    ],
  }

  it('keeps only the suggestions marked keep, with edited wording', () => {
    const result = editedFromForm(form([['keep_0', 'on'], ['suggestion_0', 'We announced'], ['suggestion_1', 'ignored']]), previous)
    expect(result.suggested_edits).toEqual([{ ...previous.suggested_edits[0], suggestion: 'We announced' }])
  })

  it('never takes the client’s sections from the form', () => {
    const data = form([['keep_1', 'on'], ['suggestion_1', '']])
    data.append('sections', 'tampered')
    const result = editedFromForm(data, previous)
    expect(result.sections).toBe(previous.sections)
    expect(result.suggested_edits).toEqual([previous.suggested_edits[1]])
  })
})
