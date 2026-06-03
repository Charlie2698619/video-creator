import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { createServer, markProjectFailed } from '../../server/http.js'
import { createProjectStore } from '../../server/project-store.js'
import { canTransition } from '../../src/domain/workflow'
import type { VideoProject } from '../../src/domain/video'

async function closeServer(server: Awaited<ReturnType<typeof createServer>>) {
  await new Promise((resolve) => server.close(resolve))
}

async function createProject(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Failure route',
      summary: 'Exercise a failing route.',
      takeaway: 'Failure state should survive the response.',
      references: [],
    }),
  })
  expect(response.status).toBe(201)
  const body = await response.json()
  return body.project as VideoProject
}

function projectReadyForSource(): VideoProject {
  return {
    id: 'video-20260603000000',
    title: 'Failure capture',
    status: 'narration_ready',
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    idea: {
      title: 'Failure capture',
      summary: 'Exercise a failed source stage.',
      takeaway: 'Failures should persist for retry UX.',
      references: [],
      targetDurationSeconds: 30,
      generationSettings: {
        durationMode: 'voice_led',
        visualComplexity: 'rich',
        pacing: 'natural',
        captions: 'burned_in',
        audioMix: 'voice_only',
      },
    },
    storyboard: {
      hook: 'Why failures need state.',
      beats: ['Run the stage', 'Capture the failure'],
      ending: 'Retry can resume from the failed stage.',
      tone: 'Clear',
    },
    scenePlan: {
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 30,
          visualDirection: 'Portrait UI failure state.',
          onScreenText: 'Failure captured',
          motionNotes: 'Static.',
          audioNotes: 'Narration.',
          acceptanceCriteria: ['Failure is visible in project state.'],
        },
      ],
      totalDurationSeconds: 30,
    },
    narration: {
      scriptPath: 'media/videos/video-20260603000000/audio/narration.txt',
      audioPath: 'media/videos/video-20260603000000/audio/narration.wav',
      voice: 'af_nova',
      durationSeconds: 30,
      status: 'audio_ready',
    },
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

test('markProjectFailed persists failure state without mutating the input project', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'failure-capture-'))
  const store = createProjectStore(root)
  const project = projectReadyForSource()

  try {
    await store.saveProject(project)

    const failed = await markProjectFailed(store, project, 'source_ready', 'Codex source generation failed.')
    const loaded = await store.loadProject(project.id)

    expect(failed).toMatchObject({
      id: project.id,
      status: 'failed',
      failure: { stage: 'source_ready', message: 'Codex source generation failed.' },
    })
    expect(loaded).toMatchObject({
      id: project.id,
      status: 'failed',
      failure: { stage: 'source_ready', message: 'Codex source generation failed.' },
    })
    expect(project.status).toBe('narration_ready')
    expect(project.failure).toBeNull()
    expect(canTransition('failed', 'source_ready')).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('stage route persists execution failures and keeps the API error envelope', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'failure-route-'))
  const binDir = path.join(root, 'bin')
  const fakeCodex = path.join(binDir, 'codex')
  const originalPath = process.env.PATH
  const originalTestMode = process.env.VIDEO_CREATOR_TEST_MODE

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env bash
cat >/dev/null
printf 'Codex failed intentionally.' >&2
exit 42
`,
      'utf8',
    )
    await chmod(fakeCodex, 0o755)
    process.env.PATH = `${binDir}:${originalPath ?? ''}`
    delete process.env.VIDEO_CREATOR_TEST_MODE

    const server = await createServer({ repoRoot: root, host: '127.0.0.1', port: 0 })
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Expected TCP server address.')
      const baseUrl = `http://127.0.0.1:${address.port}`
      const project = await createProject(baseUrl)

      const response = await fetch(`${baseUrl}/api/projects/${project.id}/codex/storyboard`, { method: 'POST' })
      const body = await response.json()
      const loaded = await createProjectStore(root).loadProject(project.id)

      expect(response.status).toBe(400)
      expect(body).toEqual({
        error: {
          code: 'REQUEST_FAILED',
          category: 'request_failed',
          message: 'Codex failed intentionally.',
        },
      })
      expect(loaded).toMatchObject({
        id: project.id,
        status: 'failed',
        failure: { stage: 'storyboard', message: 'Codex failed intentionally.' },
      })
    } finally {
      await closeServer(server)
    }
  } finally {
    process.env.PATH = originalPath
    if (originalTestMode === undefined) delete process.env.VIDEO_CREATOR_TEST_MODE
    else process.env.VIDEO_CREATOR_TEST_MODE = originalTestMode
    await rm(root, { recursive: true, force: true })
  }
})

test('stage route does not persist validation failures as failed projects', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'failure-validation-'))
  const server = await createServer({ repoRoot: root, host: '127.0.0.1', port: 0 })

  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP server address.')
    const baseUrl = `http://127.0.0.1:${address.port}`
    const project = await createProject(baseUrl)

    const response = await fetch(`${baseUrl}/api/projects/${project.id}/codex/source`, { method: 'POST' })
    const body = await response.json()
    const loaded = await createProjectStore(root).loadProject(project.id)

    expect(response.status).toBe(409)
    expect(body).toEqual({
      error: {
        code: 'SCENE_PLAN_REQUIRED',
        category: 'invalid_state',
        message: 'Scene plan is required before source generation.',
      },
    })
    expect(loaded.status).toBe('idea')
    expect(loaded.failure).toBeNull()
  } finally {
    await closeServer(server)
    await rm(root, { recursive: true, force: true })
  }
})
