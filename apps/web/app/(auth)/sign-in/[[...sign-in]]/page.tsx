import { SignIn } from '@clerk/nextjs'
import { agencyAppearance } from '../../clerkAppearance'

export default function SignInPage() {
  return <SignIn appearance={agencyAppearance} />
}
