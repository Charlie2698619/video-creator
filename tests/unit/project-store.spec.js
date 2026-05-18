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
      }),
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.project.title).toBe('API project')
    expect(body.project.status).toBe('idea')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})
