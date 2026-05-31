function numberFromSceneId(sceneId, fallback) {
  const match = String(sceneId ?? '').match(/(\d+)/)
  return match ? Number(match[1]) : fallback
}

function getDuration(scene, index) {
  const duration = scene.durationSeconds ?? scene.timing?.duration ?? scene.timing?.durationSeconds
  if (Number.isFinite(duration)) return duration
  if (Number.isFinite(scene.timing?.start) && Number.isFinite(scene.timing?.end)) return scene.timing.end - scene.timing.start
  throw new Error(`Scene ${index + 1} is missing a duration.`)
}

function requireText(value, field, index) {
  if (typeof value === 'string' && value.trim()) return value
  throw new Error(`Scene ${index + 1} is missing ${field}.`)
}

export function normalizeScenePlan(input) {
  if (!Array.isArray(input.scenes) || input.scenes.length === 0) throw new Error('Scene plan must include at least one scene.')

  const scenes = input.scenes.map((scene, index) => ({
    sceneNumber: scene.sceneNumber ?? numberFromSceneId(scene.id, index + 1),
    durationSeconds: getDuration(scene, index),
    visualDirection: requireText(scene.visualDirection, 'visualDirection', index),
    onScreenText: requireText(scene.onScreenText, 'onScreenText', index),
    motionNotes: requireText(scene.motionNotes, 'motionNotes', index),
    audioNotes: typeof scene.audioNotes === 'string' ? scene.audioNotes : '',
    acceptanceCriteria: Array.isArray(scene.acceptanceCriteria) ? scene.acceptanceCriteria : (input.acceptanceCriteria ?? []),
  }))

  return {
    scenes,
    totalDurationSeconds: input.totalDurationSeconds ?? input.format?.durationSeconds ?? scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
  }
}
