import type { VideoProject } from '../domain/video'
import { StatusBadge } from './StatusBadge'

type StoryboardStageProps = {
  project: VideoProject | null
  onCreate: () => Promise<void>
  disabled: boolean
}

export function StoryboardStage({ project, onCreate, disabled }: StoryboardStageProps) {
  return (
    <section className="stage-panel" aria-labelledby="storyboard-stage">
      <div className="stage-heading">
        <p>Stage 2</p>
        <h2 id="storyboard-stage">Storyboard</h2>
      </div>
      <button className="primary-action" type="button" onClick={onCreate} disabled={disabled || !project}>
        Create storyboard with Codex
      </button>
      {project?.storyboard ? <StatusBadge label="Storyboard ready" tone="ready" /> : <StatusBadge label="Waiting for idea" />}
    </section>
  )
}
