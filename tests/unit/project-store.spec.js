import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { createServer } from '../../server/http.js'
import { assertSafeVideoId, createProjectStore } from '../../server/project-store.js'

test('saves and loads a project record under media/videos', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'video-store-'))
  const store = createProjectStore(root)

  try {
    await store.saveProject({
      id: 'video-20260517000000',
      title: 'Stored project',
      status: 'idea',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
      idea: { title: 'Stored project', summary: 'A', takeaway: 'B', references: [], targetDurationSeconds: 30 },
      storyboard: null,
      scenePlan: null,
      narration: null,
      artifacts: { sourceBundle: null, renderResult: null, thumbnail: null, metadataPath: null, reviewChecklistPath: null },
      reviewChecklist: null,
      failure: null,
    })

    const loaded = await store.loadProject('video-20260517000000')
    expect(loaded.title).toBe('Stored project')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects unsafe video ids', () => {
  expect(() => assertSafeVideoId('../escape')).toThrow('Invalid video id.')
})

test('creates a project through the loopback API', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'video-api-'))
  const server = await createServer({ repoRoot: root, host: '127.0.0.1', port: 0 })

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'API project',
        summary: 'A project created through the local server.',
        takeaway: 'The API writes local artifacts.',
        references: [],
        targetDurationSeconds: 45,
        generationSettings: {
          durationMode: 'voice_led',
          visualComplexity: 'rich',
          pacing: 'natural',
          captions: 'burned_in',
          audioMix: 'soft_music',
        },
      }),
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.project.title).toBe('API project')
    expect(body.project.status).toBe('idea')
    expect(body.project.idea.targetDurationSeconds).toBe(45)
    expect(body.project.idea.generationSettings).toEqual({
      durationMode: 'voice_led',
      visualComplexity: 'rich',
      pacing: 'natural',
      captions: 'burned_in',
      audioMix: 'soft_music',
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

test('loads one project through the loopback API', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'video-api-get-'))
  const server = await createServer({ repoRoot: root, host: '127.0.0.1', port: 0 })

  try {
    const address = server.address()
    const createdResponse = await fetch(`http://127.0.0.1:${address.port}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Single API project',
        summary: 'A project loaded through the local server.',
        takeaway: 'The API can return one project.',
        references: [],
      }),
    })
    const created = await createdResponse.json()

    const response = await fetch(`http://127.0.0.1:${address.port}/api/projects/${created.project.id}`)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.project.id).toBe(created.project.id)
    expect(body.project.title).toBe('Single API project')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

test('returns structured API errors', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'video-api-errors-'))
  const server = await createServer({ repoRoot: root, host: '127.0.0.1', port: 0 })

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/projects/video-20990101000000`)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'PROJECT_NOT_FOUND',
        category: 'not_found',
        message: 'Project not found.',
      },
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})
