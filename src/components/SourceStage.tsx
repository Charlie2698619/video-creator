import type { VideoProject } from '../domain/video'
import { StageProgress } from './StageProgress'
import { StatusBadge } from './StatusBadge'

type SourceStageProps = {
  project: VideoProject | null
  onCreate: () => Promise<void>
  disabled: boolean
  pendingLabel: string | null
}

export function SourceStage({ project, onCreate, disabled, pendingLabel }: SourceStageProps) {
  return (
    <section className="stage-panel" aria-labelledby="source-stage">
      <div className="stage-heading">
        <p>Stage 5</p>
        <h2 id="source-stage">HyperFrames Source</h2>
      </div>
      <button className="primary-action" type="button" onClick={onCreate} disabled={disabled || !project?.narration?.audioPath}>
        Create HyperFrames source with Codex
      </button>
      <StageProgress label={pendingLabel} />
      {project?.artifacts.sourceBundle ? <StatusBadge label="HyperFrames source ready" tone="ready" /> : <StatusBadge label="Narration required" />}
    </section>
  )
}
