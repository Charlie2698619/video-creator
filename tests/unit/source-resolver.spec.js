import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
