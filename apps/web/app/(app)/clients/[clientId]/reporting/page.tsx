import { StagePage } from '../StagePage'

/** ACCESS stats and earned coverage. */
export default async function ReportingPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return (
    <StagePage clientId={clientId} title="No stats yet">
      Imported ACCESS stats and earned coverage for this client show here.
    </StagePage>
  )
}
