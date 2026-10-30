import { describe, expect, it } from 'vitest'
import { displayName, membershipKey, teamMemberFromMembership } from './clerk'

const membership = {
  id: 'orgmem_1',
  role: 'org:admin',
  organization: { id: 'org_123', name: 'ACCESS PR' },
  public_user_data: {
    user_id: 'user_abc',
    identifier: 'liz@newswire.example',
    first_name: 'Liz',
    last_name: 'Gonzalez',
    image_url: '',
    has_image: false,
  },
}

describe('teamMemberFromMembership', () => {
  it('maps a membership to a team_members row', () => {
    expect(teamMemberFromMembership(membership)).toEqual({
      org_id: 'org_123',
      clerk_user_id: 'user_abc',
      name: 'Liz Gonzalez',
      email: 'liz@newswire.example',
      role: 'org:admin',
    })
  })

  it('leaves email empty when the identifier is not an email', () => {
    const row = teamMemberFromMembership({
      ...membership,
      public_user_data: { ...membership.public_user_data, identifier: '+15555550100' },
    })
    expect(row.email).toBeNull()
  })

  it('rejects a payload without an organization', () => {
    expect(() => teamMemberFromMembership({ ...membership, organization: undefined })).toThrow()
  })
})

describe('membershipKey', () => {
  it('returns the org and user ids', () => {
    expect(membershipKey(membership)).toEqual({ org_id: 'org_123', clerk_user_id: 'user_abc' })
  })
})

describe('displayName', () => {
  it('joins first and last names', () => {
    expect(displayName('Liz', 'Gonzalez', 'x')).toBe('Liz Gonzalez')
  })

  it('uses whichever name is present', () => {
    expect(displayName(null, 'Gonzalez', 'x')).toBe('Gonzalez')
  })

  it('falls back when there is no name', () => {
    expect(displayName(null, null, 'liz@newswire.example')).toBe('liz@newswire.example')
  })
})
