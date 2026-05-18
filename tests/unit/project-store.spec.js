import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
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
