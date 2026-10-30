import { StagePage } from '../StagePage'

/** Six-month strategy and Meeting 2. Needs an approved deck and Meeting 1. */
export default async function StrategyPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return (
    <StagePage clientId={clientId} gate="strategy" title="No strategy yet">
      The six-month strategy builds from the team&rsquo;s framework and Meeting 1 feedback, then is reviewed at Meeting 2.
    </StagePage>
  )
}
