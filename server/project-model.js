export function createVideoProject(input, nowIso) {
  const title = String(input.title ?? '').trim()
  const summary = String(input.summary ?? '').trim()
  const takeaway = String(input.takeaway ?? '').trim()
  const references = Array.isArray(input.references) ? input.references.map((value) => String(value).trim()).filter(Boolean) : []
  const targetDurationSeconds = Number.isInteger(input.targetDurationSeconds) ? input.targetDurationSeconds : 30

  if (!title) throw new Error('Working title is required.')
  if (!summary) throw new Error('Idea summary is required.')
  if (!takeaway) throw new Error('Viewer takeaway is required.')
  if (targetDurationSeconds < 5 || targetDurationSeconds > 120) throw new Error('Target duration must be between 5 and 120 seconds.')

  const id = `video-${nowIso.replaceAll(/[^0-9]/g, '').slice(0, 14)}`

  return {
    id,
    title,
    status: 'idea',
    createdAt: nowIso,
    updatedAt: nowIso,
    idea: { title, summary, takeaway, references, targetDurationSeconds },
    storyboard: null,
    scenePlan: null,
    narration: null,
    artifacts: {
      sourceBundle: null,
      renderResult: null,
      thumbnail: null,
      metadataPath: null,
      reviewChecklistPath: null,
    },
    reviewChecklist: null,
    failure: null,
  }
}
