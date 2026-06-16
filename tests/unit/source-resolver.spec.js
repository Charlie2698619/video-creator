import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { buildHyperFramesSource } from '../../server/source-builder.js'
import { resolveHyperFramesSource } from '../../server/source-resolver.js'
import { validateHyperFramesSource } from '../../server/source-validator.js'
import { createVideoProject } from '../../src/domain/video'

function projectWithScenePlan() {
  const project = createVideoProject(
    {
      title: 'Quicksort in 30 seconds',
      summary: 'Explain quicksort with a pivot and two smaller piles.',
      takeaway: 'Partition first, then recursively sort the smaller groups.',
      references: [],
      targetDurationSeconds: 30,
    },
    '2026-06-02T00:00:00.000Z',
  )

  return {
    ...project,
    scenePlan: {
      totalDurationSeconds: 30,
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 30,
          visualDirection: 'Cards split around a pivot value.',
          onScreenText: 'Pick a pivot',
          motionNotes: 'Cards slide into left and right piles.',
          audioNotes: 'Narration explains partitioning.',
          acceptanceCriteria: ['Readable pivot label.'],
        },
      ],
    },
    narration: {
      scriptPath: `media/videos/${project.id}/audio/narration.txt`,
      audioPath: `media/videos/${project.id}/audio/narration.wav`,
      voice: 'af_nova',
      durationSeconds: 30,
      status: 'audio_ready',
    },
  }
}

function withFormatStrategy(project) {
  return {
    ...project,
    formatStrategy: {
      formatType: 'multi_image_story',
      contentMoat: 'Character goal, obstacle, reversal, emotional payoff.',
      visualSystem: 'Story panels, consistent setting, caption strips.',
      syncPriority: 'medium',
      riskFlags: {
        publicFigure: false,
        syntheticVoice: false,
        aiMusic: false,
        realisticSyntheticScene: false,
      },
      policyNotes: [],
    },
  }
}

function fakeSourceBundle(project) {
  return {
    sourceFolder: `media/videos/${project.id}/hyperframes`,
    entryFile: `media/videos/${project.id}/hyperframes/index.html`,
    manifestPath: `media/videos/${project.id}/hyperframes/source-manifest.json`,
    status: 'source_ready',
  }
}

test('keeps valid Codex source and does not build fallback', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-resolver-codex-'))
  const project = projectWithScenePlan()
  let fallbackCalled = false
  let codexCalled = false

  try {
    const result = await resolveHyperFramesSource({
      repoRoot: root,
      project,
      runCodexSource: async () => {
        codexCalled = true
      },
      buildFallback: async () => {
        fallbackCalled = true
        return fakeSourceBundle(project)
      },
      validate: async () => ({ valid: true, reasons: [] }),
    })

    expect(codexCalled).toBe(true)
    expect(fallbackCalled).toBe(false)
    expect(result).toEqual({ ...fakeSourceBundle(project), origin: 'codex' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('falls back when Codex source generation throws', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-resolver-throw-'))
  const project = projectWithScenePlan()
  let fallbackCalled = false

  try {
    const result = await resolveHyperFramesSource({
      repoRoot: root,
      project,
      runCodexSource: async () => {
        throw new Error('Codex unavailable')
      },
      buildFallback: async () => {
        fallbackCalled = true
        return fakeSourceBundle(project)
      },
      validate: async () => ({ valid: true, reasons: [] }),
    })

    expect(fallbackCalled).toBe(true)
    expect(result).toEqual({ ...fakeSourceBundle(project), origin: 'fallback' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('falls back when Codex writes invalid source', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-resolver-invalid-'))
  const project = projectWithScenePlan()
  let fallbackCalled = false

  try {
    const result = await resolveHyperFramesSource({
      repoRoot: root,
      project,
      runCodexSource: async () => {},
      buildFallback: async () => {
        fallbackCalled = true
        return fakeSourceBundle(project)
      },
      validate: async () => ({ valid: false, reasons: ['missing timeline'] }),
    })

    expect(fallbackCalled).toBe(true)
    expect(result).toEqual({ ...fakeSourceBundle(project), origin: 'fallback' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('default Codex source prompt includes project format strategy', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-resolver-format-prompt-'))
  const binDir = path.join(root, 'bin')
  const fakeCodex = path.join(binDir, 'codex')
  const originalPath = process.env.PATH
  const originalTestMode = process.env.VIDEO_CREATOR_TEST_MODE
  const project = withFormatStrategy(projectWithScenePlan())

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env bash
repo=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--cd" ]; then
    repo="$2"
    shift 2
  else
    shift
  fi
done
prompt="$(cat)"
printf '%s' "$prompt" > "$repo/captured-source-prompt.txt"
mkdir -p "$repo/media/videos/${project.id}/hyperframes"
cat > "$repo/media/videos/${project.id}/hyperframes/index.html" <<'HTML'
<!doctype html>
<html>
  <body>
    <audio id="narration" src="../audio/narration.wav"></audio>
    <main data-width="1080" data-height="1920"></main>
    <script>window.__timelines = { test: {} };</script>
  </body>
</html>
HTML
cat > "$repo/media/videos/${project.id}/hyperframes/source-manifest.json" <<'JSON'
{"entryFile":"index.html","width":1080,"height":1920}
JSON
exit 0
`,
      'utf8',
    )
    await chmod(fakeCodex, 0o755)
    process.env.PATH = `${binDir}:${originalPath ?? ''}`
    delete process.env.VIDEO_CREATOR_TEST_MODE

    const result = await resolveHyperFramesSource({ repoRoot: root, project })
    const prompt = await readFile(path.join(root, 'captured-source-prompt.txt'), 'utf8')

    expect(result.origin).toBe('codex')
    expect(prompt).toContain('Format type: multi_image_story')
    expect(prompt).toContain('Character goal, obstacle, reversal, emotional payoff.')
    expect(prompt).toContain('Use story-panel composition')
  } finally {
    process.env.PATH = originalPath
    if (originalTestMode === undefined) delete process.env.VIDEO_CREATOR_TEST_MODE
    else process.env.VIDEO_CREATOR_TEST_MODE = originalTestMode
    await rm(root, { recursive: true, force: true })
  }
})

test('real deterministic fallback passes real source validation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-resolver-real-fallback-'))
  const project = projectWithScenePlan()

  try {
    await mkdir(path.join(root, 'media/videos', project.id, 'audio'), { recursive: true })
    await writeFile(path.join(root, project.narration.audioPath), 'fake wav', 'utf8')

    const sourceBundle = await buildHyperFramesSource({ repoRoot: root, project })
    const validation = await validateHyperFramesSource({ repoRoot: root, videoId: project.id, expectAudio: true })

    expect(sourceBundle.status).toBe('source_ready')
    expect(validation).toEqual({ valid: true, reasons: [] })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
