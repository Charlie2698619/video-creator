import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { FormatStrategyInput, FormatType, RiskFlags, SyncPriority, VideoProject } from '../domain/video'
import { getFormatHint, promptCoach } from '../domain/promptCoach'
import { FieldCoach } from './FieldCoach'
import { StageProgress } from './StageProgress'
import { StatusBadge } from './StatusBadge'

type FormatStrategyStageProps = {
  project: VideoProject | null
  disabled: boolean
  pendingLabel: string | null
  onSave: (input: FormatStrategyInput) => Promise<void>
  onGenerateDraft: () => Promise<void>
}

const defaultRiskFlags: RiskFlags = {
  publicFigure: false,
  syntheticVoice: false,
  aiMusic: false,
  realisticSyntheticScene: false,
}

function strategyFromProject(project: VideoProject | null) {
  return {
    formatType: project?.formatStrategy?.formatType ?? 'programmatic_explainer',
    contentMoat: project?.formatStrategy?.contentMoat ?? '',
    visualSystem: project?.formatStrategy?.visualSystem ?? '',
    syncPriority: project?.formatStrategy?.syncPriority ?? 'medium',
    riskFlags: project?.formatStrategy?.riskFlags ?? defaultRiskFlags,
  }
}

export function FormatStrategyStage({ project, disabled, pendingLabel, onSave, onGenerateDraft }: FormatStrategyStageProps) {
  const [formatType, setFormatType] = useState<FormatType>('programmatic_explainer')
  const [contentMoat, setContentMoat] = useState('')
  const [visualSystem, setVisualSystem] = useState('')
  const [syncPriority, setSyncPriority] = useState<SyncPriority>('medium')
  const [riskFlags, setRiskFlags] = useState<RiskFlags>(defaultRiskFlags)
  const inputDisabled = disabled || !project

  useEffect(() => {
    const next = strategyFromProject(project)
    setFormatType(next.formatType)
    setContentMoat(next.contentMoat)
    setVisualSystem(next.visualSystem)
    setSyncPriority(next.syncPriority)
    setRiskFlags(next.riskFlags)
  }, [project])

  function setRiskFlag(key: keyof RiskFlags, value: boolean) {
    setRiskFlags((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await onSave({ formatType, contentMoat, visualSystem, syncPriority, riskFlags })
  }

  return (
    <section className="stage-panel" aria-labelledby="format-strategy-stage">
      <div className="stage-heading">
        <p>Production format</p>
        <h2 id="format-strategy-stage">Format Strategy</h2>
      </div>
      <form className="stage-form" onSubmit={handleSubmit}>
        <div className="brief-grid">
          <div className="brief-fields">
            <div className="form-row">
              <label htmlFor="format-type">Format type</label>
              <select id="format-type" value={formatType} onChange={(event) => setFormatType(event.target.value as FormatType)} disabled={inputDisabled}>
                <option value="programmatic_explainer">Programmatic explainer</option>
                <option value="multi_image_story">Multi-image story</option>
              </select>
              <p className="format-option-note">{getFormatHint(formatType)}</p>
            </div>
            <div className="form-row">
              <label htmlFor="content-moat">Content moat</label>
              <textarea id="content-moat" value={contentMoat} onChange={(event) => setContentMoat(event.target.value)} disabled={inputDisabled} />
              <FieldCoach {...promptCoach.contentMoat} />
            </div>
            <div className="form-row">
              <label htmlFor="visual-system">Visual system</label>
              <textarea id="visual-system" value={visualSystem} onChange={(event) => setVisualSystem(event.target.value)} disabled={inputDisabled} />
              <FieldCoach {...promptCoach.visualSystem} />
            </div>
          </div>
          <fieldset className="tuning-panel">
            <legend>Risk and sync</legend>
            <div className="form-row">
              <label htmlFor="sync-priority">Sync priority</label>
              <select id="sync-priority" value={syncPriority} onChange={(event) => setSyncPriority(event.target.value as SyncPriority)} disabled={inputDisabled}>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="risk-grid">
              <label className="checkbox-row">
                <input type="checkbox" checked={riskFlags.publicFigure} onChange={(event) => setRiskFlag('publicFigure', event.target.checked)} disabled={inputDisabled} />
                Public figure
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={riskFlags.syntheticVoice} onChange={(event) => setRiskFlag('syntheticVoice', event.target.checked)} disabled={inputDisabled} />
                Synthetic voice
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={riskFlags.aiMusic} onChange={(event) => setRiskFlag('aiMusic', event.target.checked)} disabled={inputDisabled} />
                AI music
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={riskFlags.realisticSyntheticScene} onChange={(event) => setRiskFlag('realisticSyntheticScene', event.target.checked)} disabled={inputDisabled} />
                Realistic synthetic scene
              </label>
            </div>
          </fieldset>
        </div>
        <div className="action-row">
          <button className="primary-action" type="submit" disabled={inputDisabled}>
            Save strategy
          </button>
          <button className="secondary-action" type="button" onClick={onGenerateDraft} disabled={disabled || !project?.formatStrategy}>
            Generate draft
          </button>
        </div>
        <StageProgress label={pendingLabel} />
        {project?.formatStrategy ? <StatusBadge label={project.formatStrategy.formatType} tone="ready" /> : <StatusBadge label="Strategy required" />}
      </form>
    </section>
  )
}
