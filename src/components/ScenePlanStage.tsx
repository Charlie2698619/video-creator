import type { VideoProject } from '../domain/video'
import { StageProgress } from './StageProgress'
import { StatusBadge } from './StatusBadge'

type ScenePlanStageProps = {
  project: VideoProject | null
  onCreate: () => Promise<void>
  disabled: boolean
  pendingLabel: string | null
}

export function ScenePlanStage({ project, onCreate, disabled, pendingLabel }: ScenePlanStageProps) {
  return (
    <section className="stage-panel" aria-labelledby="scene-plan-stage">
      <div className="stage-heading">
        <p>Stage 3</p>
        <h2 id="scene-plan-stage">Scene Plan</h2>
      </div>
      <button className="primary-action" type="button" onClick={onCreate} disabled={disabled || !project?.storyboard}>
        Create scene plan with Codex
      </button>
      <StageProgress label={pendingLabel} />
      {project?.scenePlan ? <StatusBadge label="Scene plan ready" tone="ready" /> : <StatusBadge label="Storyboard required" />}
    </section>
  )
}
