import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { buildReviewChecklist } from '../../server/review-checklist.js'
import { canMarkReviewed, createDefaultChecklist } from '../../src/domain/review'
import { createVideoProject } from '../../src/domain/video'

function renderedProjectWithDuration(durationSeconds: number) {
  const project = createVideoProject(
    {
      title: 'Duration tolerance',
      summary: 'Real renders can drift slightly from the plan.',
      takeaway: 'Review should allow muxing and frame rounding drift.',
      references: [],
      targetDurationSeconds: 30,
    },
    '2026-06-08T00:00:00.000Z',
  )

  return {
    ...project,
    status: 'rendered' as const,
    scenePlan: {
      totalDurationSeconds: 30,
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 30,
          visualDirection: 'Portrait explainer.',
          onScreenText: 'Duration drift',
          motionNotes: 'Static.',
          audioNotes: 'Narration.',
          acceptanceCriteria: ['Render duration is close enough.'],
        },
      ],
    },
    narration: {
      scriptPath: `media/videos/${project.id}/audio/narration.txt`,
      audioPath: `media/videos/${project.id}/audio/narration.wav`,
      voice: 'af_nova',
      durationSeconds: 30,
      status: 'audio_ready' as const,
    },
    artifacts: {
      ...project.artifacts,
      sourceBundle: {
        sourceFolder: `media/videos/${project.id}/hyperframes`,
        entryFile: `media/videos/${project.id}/hyperframes/index.html`,
        manifestPath: `media/videos/${project.id}/hyperframes/source-manifest.json`,
        origin: 'fallback' as const,
        status: 'source_ready' as const,
      },
      renderResult: {
        mp4Path: `media/videos/${project.id}/renders/render-001.mp4`,
        width: 1080,
        height: 1920,
        durationSeconds,
        fps: 30,
        checksum: 'render-checksum',
        logPath: `media/videos/${project.id}/renders/render-001.log.txt`,
        status: 'rendered' as const,
      },
    },
  }
}

test('does not mark a video reviewed until every required check passes', () => {
  const checklist = createDefaultChecklist()
  expect(canMarkReviewed(checklist)).toBe(false)

  expect(
    canMarkReviewed({
      ...checklist,
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
      humanDecision: 'approved',
      reviewedAt: '2026-05-17T00:00:00.000Z',
    }),
  ).toBe(true)
})

test('keeps rendered projects out of reviewed state without a checklist', () => {
  const project = createVideoProject(
    {
      title: 'Review gate',
      summary: 'Review is separate from rendering.',
      takeaway: 'Rendered does not mean approved.',
      references: [],
    },
    '2026-05-17T00:00:00.000Z',
  )

  expect(project.reviewChecklist).toBeNull()
})

test('review checklist tolerates realistic render duration drift', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'duration-tolerance-'))

  try {
    const nearProject = renderedProjectWithDuration(30.75)
    const farProject = renderedProjectWithDuration(31.25)
    await mkdir(path.join(root, 'media/videos', nearProject.id), { recursive: true })
    await mkdir(path.join(root, 'media/videos', farProject.id), { recursive: true })

    const near = await buildReviewChecklist({
      repoRoot: root,
      project: nearProject,
      humanDecision: 'approved',
      textReadable: true,
    })
    const far = await buildReviewChecklist({
      repoRoot: root,
      project: farProject,
      humanDecision: 'approved',
      textReadable: true,
    })

    expect(near.checklist.durationMatchesPlan).toBe(true)
    expect(far.checklist.durationMatchesPlan).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
