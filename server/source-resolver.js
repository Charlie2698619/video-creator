import { runCodexStage } from './codex-runner.js'
import { buildHyperFramesSource } from './source-builder.js'
import { validateHyperFramesSource } from './source-validator.js'

function expectedSourceBundle(videoId) {
  const sourceFolder = `media/videos/${videoId}/hyperframes`
  return {
    sourceFolder,
    entryFile: `${sourceFolder}/index.html`,
    manifestPath: `${sourceFolder}/source-manifest.json`,
    status: 'source_ready',
  }
}

function withOrigin(sourceBundle, origin) {
  return { ...sourceBundle, origin }
}

async function runDefaultCodexSource({ repoRoot, project }) {
  await runCodexStage({
    repoRoot,
    videoId: project.id,
    stage: 'source',
    projectTitle: project.title,
    narrationAudioPath: project.narration?.audioPath ?? null,
    targetDurationSeconds: project.idea.targetDurationSeconds,
    generationSettings: project.idea.generationSettings ?? {},
    ideaSummary: project.idea.summary,
    viewerTakeaway: project.idea.takeaway,
    testMode: process.env.VIDEO_CREATOR_TEST_MODE === '1',
  })
}

export async function resolveHyperFramesSource({
  repoRoot,
  project,
  runCodexSource = runDefaultCodexSource,
  buildFallback = buildHyperFramesSource,
  validate = validateHyperFramesSource,
}) {
  try {
    await runCodexSource({ repoRoot, project })
    const validation = await validate({
      repoRoot,
      videoId: project.id,
      expectAudio: Boolean(project.narration?.audioPath),
    })
    if (validation.valid) return withOrigin(expectedSourceBundle(project.id), 'codex')
  } catch {
    // Codex is best-effort for this stage; deterministic fallback keeps the pipeline usable.
  }

  return withOrigin(await buildFallback({ repoRoot, project }), 'fallback')
}
