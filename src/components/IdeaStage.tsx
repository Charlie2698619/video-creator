import { useState } from 'react'
import type { FormEvent } from 'react'
import { StageProgress } from './StageProgress'

type IdeaStageProps = {
  onSave: (input: { title: string; summary: string; takeaway: string; references: string[] }) => Promise<void>
  disabled: boolean
  pendingLabel: string | null
}

export function IdeaStage({ onSave, disabled, pendingLabel }: IdeaStageProps) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [takeaway, setTakeaway] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await onSave({ title, summary, takeaway, references: [] })
  }

  return (
    <section className="stage-panel" aria-labelledby="idea-stage">
      <div className="stage-heading">
        <p>Stage 1</p>
        <h2 id="idea-stage">Idea</h2>
      </div>
      <form className="stage-form" onSubmit={handleSubmit}>
        <label className="form-row">
          <span>Working title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="form-row">
          <span>Idea summary</span>
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label className="form-row">
          <span>Viewer takeaway</span>
          <textarea value={takeaway} onChange={(event) => setTakeaway(event.target.value)} />
        </label>
        <button className="primary-action" type="submit" disabled={disabled}>
          Save idea
        </button>
        <StageProgress label={pendingLabel} />
      </form>
    </section>
  )
}
