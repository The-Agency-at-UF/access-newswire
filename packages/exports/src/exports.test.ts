import { describe, expect, it } from 'vitest'
import { csvCell, renderMediaListCsv } from './csv'
import { renderDocx } from './docx'
import { bulletLines, renderDeck } from './pptx'

describe('media list CSV', () => {
  const columns = [
    { header: 'First Name', field: 'first_name' },
    { header: 'Last Name', field: 'last_name' },
    { header: 'Email', field: 'email' },
    { header: 'Beats', field: 'beats' },
  ]

  it('maps rows through the configured columns', () => {
    const csv = renderMediaListCsv(
      [{ name: 'Jo Ann Reporter', email: 'jo@mw.example', title: null, outlet: 'MW', beats: ['mining', 'energy'], relevance_reason: null }],
      columns,
    )
    expect(csv).toBe('First Name,Last Name,Email,Beats\r\nJo,Ann Reporter,jo@mw.example,mining; energy\r\n')
  })

  it('quotes commas and quotes, and defuses formulas', () => {
    expect(csvCell('a, "b"')).toBe('"a, ""b"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('-5')).toBe("'-5")
  })
})

describe('docx', () => {
  it('renders a release with tracked suggested edits', async () => {
    const buffer = await renderDocx({
      title: 'Q4 results',
      sections: [{ id: 'lead', heading: 'Lead', body: 'Ridgeline is pleased to announce strong results.' }],
      release: { headline: 'Ridgeline beats estimates', subheadline: null, dateline: 'RENO, Nev. — Oct. 20, 2026', boilerplate: 'About Ridgeline.' },
      suggestedEdits: [{ section_id: 'lead', original: 'is pleased to announce', suggestion: 'reported', reason: 'AP style' }],
    })
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    const { default: JSZip } = await import('jszip')
    const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:del ')
    expect(xml).toContain('<w:ins ')
    expect(xml).toContain('is pleased to announce')
    expect(xml).toContain('reported')
  })
})

describe('pptx', () => {
  it('turns bodies into bullets', () => {
    expect(bulletLines('- one\n2. two\n\n• three')).toEqual(['one', 'two', 'three'])
  })

  it('renders a deck', async () => {
    const buffer = await renderDeck({ title: 'Ridgeline onboarding', slides: [{ heading: 'Who they are', body: 'Miner\nAI', speaker_notes: 'Say hi' }] })
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
  })
})
