import { describe, expect, it } from 'vitest'
import { confidenceText, defaultFolder, emailChips, folderFilter, folderOf, FOLDERS, OPEN_STATUSES, parseFolder } from './inbox'

describe('folderFilter', () => {
  it('shows a member only the mail routed to them', () => {
    expect(folderFilter('mine', 'm1')).toEqual({ statuses: ['routed'], ownerId: 'm1' })
  })

  it('has nothing for "mine" without a member', () => {
    expect(folderFilter('mine', null)).toBeNull()
  })

  it('keeps label folders to open mail', () => {
    expect(folderFilter('sales_handoff', 'm1')).toEqual({ statuses: OPEN_STATUSES, label: 'sales_handoff' })
  })

  it('never shows handled or muted mail as open', () => {
    expect(OPEN_STATUSES).not.toContain('handled')
    expect(OPEN_STATUSES).not.toContain('muted')
  })

  it('maps the quiet folders to their status', () => {
    expect(folderFilter('handled', null)).toEqual({ statuses: ['handled'] })
    expect(folderFilter('muted', null)).toEqual({ statuses: ['muted'] })
  })
})

describe('parseFolder / defaultFolder', () => {
  it('accepts only known folders', () => {
    for (const f of FOLDERS) expect(parseFolder(f.key)).toBe(f.key)
    expect(parseFolder('drafts')).toBeNull()
    expect(parseFolder(undefined)).toBeNull()
  })

  it('starts the person on duty in Unmatched', () => {
    expect(defaultFolder(true)).toBe('unmatched')
    expect(defaultFolder(false)).toBe('mine')
  })
})

describe('emailChips', () => {
  it('shows the label', () => {
    expect(emailChips({ label: 'release_info', client_id: 'c1', status: 'routed' })).toEqual(['RELEASE INFO'])
  })

  it('adds UNMATCHED while no client is set', () => {
    expect(emailChips({ label: 'client_update', client_id: null, status: 'unmatched' })).toEqual(['CLIENT UPDATE', 'UNMATCHED'])
  })

  it('shows nothing for mail not yet classified', () => {
    expect(emailChips({ label: null, client_id: null, status: 'new' })).toEqual([])
  })

  it('marks auto-notifications', () => {
    expect(emailChips({ label: 'auto_notification', client_id: null, status: 'muted' })).toEqual(['AUTO'])
  })
})

describe('confidenceText', () => {
  it('formats model confidence and hides it for people and rules', () => {
    expect(confidenceText(0.824)).toBe('82%')
    expect(confidenceText(null)).toBeNull()
  })
})

describe('folderOf', () => {
  it('links handled and muted mail to their folders, everything else to All open', () => {
    expect(folderOf('handled')).toBe('handled')
    expect(folderOf('muted')).toBe('muted')
    expect(folderOf('routed')).toBe('open')
    expect(folderOf('unmatched')).toBe('open')
  })
})
