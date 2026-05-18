import type { VideoProject } from '../domain/video'
import { StatusBadge } from './StatusBadge'

type RenderStageProps = {
  project: VideoProject | null
  onRender: () => Promise<void>
  disabled: boolean
}

export function RenderStage({ project, onRender, disabled }: RenderStageProps) {
  return (
    <section className="stage-panel" aria-labelledby="render-stage">
      <div className="stage-heading">
        <p>Stage 5</p>
        <h2 id="render-stage">MP4 Render</h2>
      </div>
      <button className="primary-action" type="button" onClick={onRender} disabled={disabled || !project?.artifacts.sourceBundle}>
        Render MP4
      </button>
      {project?.artifacts.renderResult ? <StatusBadge label="MP4 rendered" tone="ready" /> : <StatusBadge label="Source required" />}
    </section>
  )
}
