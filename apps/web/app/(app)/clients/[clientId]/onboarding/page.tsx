import { StagePage } from '../StagePage'

/** Onboarding deck and Meeting 1. Builds from approved research. */
export default async function OnboardingPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return (
    <StagePage clientId={clientId} gate="onboarding" title="No deck yet">
      The onboarding deck reworks an approved example deck from the research, then goes to the client at Meeting 1.
    </StagePage>
  )
}
