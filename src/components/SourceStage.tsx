import type { VideoProject } from '../domain/video'
import { StatusBadge } from './StatusBadge'

type SourceStageProps = {
  project: VideoProject | null
  onCreate: () => Promise<void>
  disabled: boolean
}

export function SourceStage({ project, onCreate, disabled }: SourceStageProps) {
  return (
    <section className="stage-panel" aria-labelledby="source-stage">
      <div className="stage-heading">
        <p>Stage 4</p>
        <h2 id="source-stage">HyperFrames Source</h2>
      </div>
      <button className="primary-action" type="button" onClick={onCreate} disabled={disabled || !project?.scenePlan}>
        Create HyperFrames source with Codex
      </button>
      {project?.artifacts.sourceBundle ? <StatusBadge label="HyperFrames source ready" tone="ready" /> : <StatusBadge label="Scene plan required" />}
    </section>
  )
}
