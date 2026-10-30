import { StagePage } from '../StagePage'

/** Media list and ACCESS export (L2/L3). Needs an approved release. */
export default async function MediaPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return (
    <StagePage clientId={clientId} gate="media" notForL1 title="No media list yet">
      Lists rank journalists from the shared directory against the approved release, then export as CSV for the ACCESS upload.
    </StagePage>
  )
}
