import { OrganizationList } from '@clerk/nextjs'
import { agencyAppearance } from '../clerkAppearance'

/**
 * Every row is scoped to a Clerk organization (the ACCESS PR team), so a
 * session without one can't do anything yet. Join or create it here.
 */
export default function SelectOrgPage() {
  return (
    <OrganizationList
      appearance={agencyAppearance}
      hidePersonal
      afterSelectOrganizationUrl="/dev"
      afterCreateOrganizationUrl="/dev"
    />
  )
}
