import { useState } from 'react'
import type { FormEvent } from 'react'
import type { GenerationSettings } from '../domain/video'
import { promptCoach } from '../domain/promptCoach'
import { FieldCoach } from './FieldCoach'
import { StageProgress } from './StageProgress'

type IdeaStageProps = {
  onSave: (input: { title: string; summary: string; takeaway: string; references: string[]; targetDurationSeconds: number; generationSettings: GenerationSettings }) => Promise<void>
  disabled: boolean
  pendingLabel: string | null
}

export function IdeaStage({ onSave, disabled, pendingLabel }: IdeaStageProps) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [takeaway, setTakeaway] = useState('')
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(30)
  const [durationMode, setDurationMode] = useState<GenerationSettings['durationMode']>('voice_led')
  const [visualComplexity, setVisualComplexity] = useState<GenerationSettings['visualComplexity']>('rich')
  const [pacing, setPacing] = useState<GenerationSettings['pacing']>('natural')
  const [captions, setCaptions] = useState<GenerationSettings['captions']>('burned_in')
  const [audioMix, setAudioMix] = useState<GenerationSettings['audioMix']>('voice_only')

  function buildInput() {
    return {
      title,
      summary,
      takeaway,
      references: [],
      targetDurationSeconds,
      generationSettings: { durationMode, visualComplexity, pacing, captions, audioMix },
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await onSave(buildInput())
  }

  return (
    <section className="stage-panel" aria-labelledby="idea-stage">
      <div className="stage-heading">
        <p>Autopilot brief</p>
        <h2 id="idea-stage">Idea + fine tuning</h2>
      </div>
      <form className="stage-form" onSubmit={handleSubmit}>
        <div className="brief-grid">
          <div className="brief-fields">
            <div className="form-row">
              <label htmlFor="idea-title">Working title</label>
              <input id="idea-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <FieldCoach {...promptCoach.idea} />
            </div>
            <div className="form-row">
              <label htmlFor="idea-summary">Idea summary</label>
              <textarea id="idea-summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
              <FieldCoach {...promptCoach.idea} />
            </div>
            <div className="form-row">
              <label htmlFor="viewer-takeaway">Viewer takeaway</label>
              <textarea id="viewer-takeaway" value={takeaway} onChange={(event) => setTakeaway(event.target.value)} />
              <FieldCoach {...promptCoach.viewerTakeaway} />
            </div>
          </div>
          <fieldset className="tuning-panel">
            <legend>Generation tuning</legend>
            <label className="form-row">
              <span>Duration</span>
              <select value={durationMode} onChange={(event) => setDurationMode(event.target.value as GenerationSettings['durationMode'])}>
                <option value="voice_led">Voice-led</option>
                <option value="fixed">Fixed target</option>
              </select>
            </label>
            <label className="form-row">
              <span>Target seconds</span>
              <input type="number" min={5} max={120} value={targetDurationSeconds} onChange={(event) => setTargetDurationSeconds(Number(event.target.value))} />
            </label>
            <label className="form-row">
              <span>Visual depth</span>
              <select value={visualComplexity} onChange={(event) => setVisualComplexity(event.target.value as GenerationSettings['visualComplexity'])}>
                <option value="rich">Rich human</option>
                <option value="standard">Standard</option>
              </select>
            </label>
            <label className="form-row">
              <span>Pacing</span>
              <select value={pacing} onChange={(event) => setPacing(event.target.value as GenerationSettings['pacing'])}>
                <option value="natural">Natural</option>
                <option value="calm">Calm</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            <label className="form-row">
              <span>Captions</span>
              <select value={captions} onChange={(event) => setCaptions(event.target.value as GenerationSettings['captions'])}>
                <option value="burned_in">Burned-in</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="form-row">
              <span>Audio bed</span>
              <select value={audioMix} onChange={(event) => setAudioMix(event.target.value as GenerationSettings['audioMix'])}>
                <option value="voice_only">Voice only</option>
                <option value="soft_music">Soft music notes</option>
              </select>
            </label>
          </fieldset>
        </div>
        <div className="action-row">
          <button className="primary-action" type="submit" disabled={disabled}>
            Save idea
          </button>
        </div>
        <StageProgress label={pendingLabel} />
      </form>
    </section>
  )
}
