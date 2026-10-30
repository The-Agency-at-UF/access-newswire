import { StagePage } from '../StagePage'

/** Per-journalist pitches (L2/L3). Needs an approved media list. */
export default async function PitchesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return (
    <StagePage clientId={clientId} gate="pitches" notForL1 title="No pitches yet">
      One pitch per journalist on the approved media list. Copy them out — nothing sends from here.
    </StagePage>
  )
}
