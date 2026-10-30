import { StagePage } from '../StagePage'

/**
 * Preliminary research — the first stage, and the only one with no upstream
 * gate. Sections cite the sources they came from (AGENTS.md §10).
 */
export default async function ResearchPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return (
    <StagePage clientId={clientId} title="No research yet">
      Preliminary research — company overview, positioning and competitors, each with its sources — appears here once it runs.
    </StagePage>
  )
}
