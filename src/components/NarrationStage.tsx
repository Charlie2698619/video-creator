import type { VideoProject } from '../domain/video'
import { StageProgress } from './StageProgress'
import { StatusBadge } from './StatusBadge'

type NarrationStageProps = {
  project: VideoProject | null
  onCreateScript: () => Promise<void>
  onGenerateAudio: () => Promise<void>
  disabled: boolean
  pendingLabel: string | null
}

export function NarrationStage({ project, onCreateScript, onGenerateAudio, disabled, pendingLabel }: NarrationStageProps) {
  const hasScript = Boolean(project?.narration?.scriptPath)
  const hasAudio = Boolean(project?.narration?.audioPath)

  return (
    <section className="stage-panel" aria-labelledby="narration-stage">
      <div className="stage-heading">
        <p>Stage 4</p>
        <h2 id="narration-stage">AI Narration</h2>
      </div>
      <div className="action-row">
        <button className="secondary-action" type="button" onClick={onCreateScript} disabled={disabled || !project?.scenePlan}>
          Create narration script with Codex
        </button>
        <button className="primary-action" type="button" onClick={onGenerateAudio} disabled={disabled || !hasScript}>
          Generate AI voiceover
        </button>
      </div>
      <StageProgress label={pendingLabel} />
      {hasAudio ? (
        <StatusBadge label="Narration audio ready" tone="ready" />
      ) : hasScript ? (
        <StatusBadge label="Narration script ready" tone="ready" />
      ) : (
        <StatusBadge label="Scene plan required" />
      )}
    </section>
  )
}
