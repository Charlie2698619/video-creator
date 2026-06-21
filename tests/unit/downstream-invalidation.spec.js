import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { createServer } from '../../server/http.js'
import { createProjectStore } from '../../server/project-store.js'
import { createVideoProject } from '../../server/project-schema.mjs'

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve))
}

function projectWithCompletedDownstream() {
  const project = createVideoProject(
    {
      title: 'Stale downstream state',
      summary: 'Exercise stale source and render artifacts.',
      takeaway: 'Earlier reruns must invalidate downstream state.',
      references: [],
    },
    '2026-06-18T00:00:00.000Z',
  )

  return {
    ...project,
    status: 'reviewed',
    formatStrategy: {
      formatType: 'programmatic_explainer',
      contentMoat: 'Original artifact-state framing.',
      visualSystem: 'Checklist cards and source/render rows.',
      syncPriority: 'high',
      riskFlags: {
        publicFigure: false,
        syntheticVoice: true,
        aiMusic: false,
        realisticSyntheticScene: false,
      },
      policyNotes: ['Synthetic voice is used; keep disclosure notes available for review.'],
    },
    storyboard: {
      hook: 'Artifact state should be honest.',
      beats: ['Create source', 'Render MP4', 'Rerun narration'],
      ending: 'Downstream artifacts must no longer look ready.',
      tone: 'Direct',
    },
    scenePlan: {
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 30,
          visualDirection: 'State cards.',
          onScreenText: 'Invalidate stale artifacts',
          motionNotes: 'Static cards.',
          audioNotes: 'Narration.',
          acceptanceCriteria: ['Downstream badges are not ready after narration changes.'],
        },
      ],
      totalDurationSeconds: 30,
    },
    narration: {
      scriptPath: `media/videos/${project.id}/audio/narration.txt`,
      audioPath: `media/videos/${project.id}/audio/narration.wav`,
      voice: 'af_nova',
      durationSeconds: 30,
      status: 'audio_ready',
    },
    artifacts: {
      sourceBundle: {
        sourceFolder: `media/videos/${project.id}/hyperframes`,
        entryFile: `media/videos/${project.id}/hyperframes/index.html`,
        manifestPath: `media/videos/${project.id}/hyperframes/source-manifest.json`,
        status: 'source_ready',
        origin: 'fallback',
      },
      renderResult: {
        mp4Path: `media/videos/${project.id}/renders/render-001.mp4`,
        width: 1080,
        height: 1920,
        durationSeconds: 30,
        fps: 30,
        checksum: 'render-checksum',
        logPath: `media/videos/${project.id}/renders/render-001.log.txt`,
        status: 'rendered',
      },
      thumbnail: {
        path: `media/videos/${project.id}/thumbnails/thumbnail-001.png`,
        width: 1080,
        height: 1920,
        checksum: 'thumbnail-checksum',
      },
      metadataPath: `media/videos/${project.id}/metadata.json`,
      reviewChecklistPath: `media/videos/${project.id}/review-checklist.json`,
    },
    reviewChecklist: {
      mp4Exists: true,
      mp4HasAudioStream: true,
      aspectRatioIsPortrait: true,
      durationMatchesPlan: true,
      textReadable: true,
      thumbnailExists: true,
      metadataValid: true,
      narrationAudioExists: true,
      sourcePreserved: true,
      noFailedArtifactMarkedComplete: true,
      policyWarnings: ['Synthetic voice is used; keep disclosure notes available for review.'],
      humanDecision: 'approved',
      reviewedAt: '2026-06-18T00:01:00.000Z',
    },
  }
}

async function writeMinimumFiles(repoRoot, project) {
  const root = path.join(repoRoot, 'media/videos', project.id)
  await mkdir(path.join(root, 'audio'), { recursive: true })
  await writeFile(path.join(repoRoot, project.narration.scriptPath), 'Old narration script.', 'utf8')
}

test('rerunning narration clears stale source, render, metadata, and review state', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'downstream-invalidation-'))
  const originalTestMode = process.env.VIDEO_CREATOR_TEST_MODE
  process.env.VIDEO_CREATOR_TEST_MODE = '1'

  try {
    const store = createProjectStore(root)
    const project = projectWithCompletedDownstream()
    await writeMinimumFiles(root, project)
    await store.saveProject(project)

    const server = await createServer({ repoRoot: root, host: '127.0.0.1', port: 0 })
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Expected TCP server address.')

      const response = await fetch(`http://127.0.0.1:${address.port}/api/projects/${project.id}/codex/narration`, {
        method: 'POST',
      })
      expect(response.status).toBe(200)
      const body = await response.json()

      expect(body.project.status).toBe('narration_script')
      expect(body.project.narration).toMatchObject({
        scriptPath: `media/videos/${project.id}/audio/narration.txt`,
        audioPath: null,
        status: 'script_ready',
      })
      expect(body.project.artifacts).toEqual({
        sourceBundle: null,
        renderResult: null,
        thumbnail: null,
        metadataPath: null,
        reviewChecklistPath: null,
      })
      expect(body.project.reviewChecklist).toBeNull()
    } finally {
      await closeServer(server)
    }
  } finally {
    if (originalTestMode === undefined) delete process.env.VIDEO_CREATOR_TEST_MODE
    else process.env.VIDEO_CREATOR_TEST_MODE = originalTestMode
    await rm(root, { recursive: true, force: true })
  }
})

test('loading a stale saved project returns current workflow state without downstream artifacts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'downstream-load-'))

  try {
    const store = createProjectStore(root)
    const project = {
      ...projectWithCompletedDownstream(),
      status: 'narration_script',
      narration: {
        ...projectWithCompletedDownstream().narration,
        audioPath: null,
        status: 'script_ready',
      },
    }
    await store.saveProject(project)

    const server = await createServer({ repoRoot: root, host: '127.0.0.1', port: 0 })
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Expected TCP server address.')

      const response = await fetch(`http://127.0.0.1:${address.port}/api/projects/${project.id}`)
      expect(response.status).toBe(200)
      const body = await response.json()

      expect(body.project.status).toBe('narration_script')
      expect(body.project.narration.audioPath).toBeNull()
      expect(body.project.artifacts).toEqual({
        sourceBundle: null,
        renderResult: null,
        thumbnail: null,
        metadataPath: null,
        reviewChecklistPath: null,
      })
      expect(body.project.reviewChecklist).toBeNull()
    } finally {
      await closeServer(server)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
