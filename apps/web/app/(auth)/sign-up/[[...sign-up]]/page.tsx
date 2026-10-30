import { SignUp } from '@clerk/nextjs'
import { agencyAppearance } from '../../clerkAppearance'

export default function SignUpPage() {
  return <SignUp appearance={agencyAppearance} />
}
