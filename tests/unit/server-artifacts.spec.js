import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import { writeMetadata } from '../../server/metadata.js'
import { buildReviewChecklist, isChecklistApproved } from '../../server/review-checklist.js'
import { createThumbnail } from '../../server/thumbnailer.js'
import { createVideoProject } from '../../src/domain/video'

const execFileAsync = promisify(execFile)

function completeProject(now = '2026-05-31T00:00:00.000Z') {
  const project = createVideoProject(
    {
      title: 'Server artifact test',
      summary: 'Verify server-side artifact metadata.',
      takeaway: 'Artifacts must exist before review.',
      references: [],
    },
    now,
  )

  return {
    ...project,
    status: 'rendered',
    scenePlan: {
      totalDurationSeconds: 30,
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 30,
          visualDirection: 'Portrait black frame.',
          onScreenText: 'Artifact test',
          motionNotes: 'Static.',
          audioNotes: 'Narration.',
          acceptanceCriteria: ['Portrait render exists.'],
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
    formatStrategy: {
      formatType: 'programmatic_explainer',
      contentMoat: 'Original artifact verification.',
      visualSystem: 'Checklist cards and artifact rows.',
      syncPriority: 'high',
      riskFlags: {
        publicFigure: false,
        syntheticVoice: true,
        aiMusic: false,
        realisticSyntheticScene: false,
      },
      policyNotes: ['Synthetic voice is used; keep disclosure notes available for review.'],
    },
    artifacts: {
      sourceBundle: {
        sourceFolder: `media/videos/${project.id}/hyperframes`,
        entryFile: `media/videos/${project.id}/hyperframes/index.html`,
        manifestPath: `media/videos/${project.id}/hyperframes/source-manifest.json`,
        status: 'source_ready',
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
      reviewChecklistPath: null,
    },
    failure: null,
  }
}

async function writeDeclaredArtifacts(repoRoot, project) {
  const videoRoot = path.join(repoRoot, 'media/videos', project.id)
  await mkdir(path.join(videoRoot, 'audio'), { recursive: true })
  await mkdir(path.join(videoRoot, 'hyperframes'), { recursive: true })
  await mkdir(path.join(videoRoot, 'renders'), { recursive: true })
  await mkdir(path.join(videoRoot, 'thumbnails'), { recursive: true })
  await writeFile(path.join(repoRoot, project.narration.scriptPath), 'Narration script.', 'utf8')
  await writeFile(path.join(repoRoot, project.narration.audioPath), 'wav-bytes', 'utf8')
  await writeFile(path.join(repoRoot, project.artifacts.sourceBundle.manifestPath), '{"ok":true}\n', 'utf8')
  await writeRenderMp4(path.join(repoRoot, project.artifacts.renderResult.mp4Path), { withAudio: true })
  await writeFile(path.join(repoRoot, project.artifacts.thumbnail.path), 'png-bytes', 'utf8')
}

async function writeRenderMp4(filePath, { withAudio }) {
  const baseArgs = ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=108x192:d=1:r=1']
  const args = withAudio
    ? [
        ...baseArgs,
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=1',
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        filePath,
      ]
    : [...baseArgs, '-pix_fmt', 'yuv420p', filePath]
  await execFileAsync('ffmpeg', args)
}

test('createThumbnail writes a portrait PNG with a checksum', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'thumbnailer-'))
  const videoRoot = path.join(root, 'media/videos/video-1')
  const mp4Path = path.join(videoRoot, 'renders/render-001.mp4')

  try {
    await mkdir(path.dirname(mp4Path), { recursive: true })
    await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=108x192:d=1:r=1', '-pix_fmt', 'yuv420p', mp4Path])

    const thumbnail = await createThumbnail({
      repoRoot: root,
      videoId: 'video-1',
      mp4Path: 'media/videos/video-1/renders/render-001.mp4',
    })

    expect(thumbnail).toMatchObject({
      path: 'media/videos/video-1/thumbnails/thumbnail-001.png',
      width: 1080,
      height: 1920,
    })
    expect(thumbnail.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect((await stat(path.join(root, thumbnail.path))).size).toBeGreaterThan(0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('writeMetadata verifies declared artifacts and writes checksums', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'metadata-'))
  const project = completeProject()

  try {
    await writeDeclaredArtifacts(root, project)
    const metadataPath = await writeMetadata({ repoRoot: root, project })
    const metadata = JSON.parse(await readFile(path.join(root, metadataPath), 'utf8'))

    expect(metadataPath).toBe(`media/videos/${project.id}/metadata.json`)
    expect(metadata.videoId).toBe(project.id)
    expect(metadata.mp4Path).toBe(project.artifacts.renderResult.mp4Path)
    expect(metadata.thumbnailPath).toBe(project.artifacts.thumbnail.path)
    expect(metadata.formatStrategy.formatType).toBe('programmatic_explainer')
    expect(metadata.policyWarnings).toEqual(['Synthetic voice is used; keep disclosure notes available for review.'])
    expect(metadata.checksums.mp4).toMatch(/^[a-f0-9]{64}$/)
    expect(metadata.checksums.narrationAudio).toMatch(/^[a-f0-9]{64}$/)
    expect(metadata.checksums.thumbnail).toMatch(/^[a-f0-9]{64}$/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('writeMetadata rejects missing declared artifacts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'metadata-missing-'))
  const project = completeProject()

  try {
    await writeDeclaredArtifacts(root, project)
    await rm(path.join(root, project.artifacts.thumbnail.path))
    await expect(writeMetadata({ repoRoot: root, project })).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('buildReviewChecklist requires human readable-text confirmation for approval', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-checklist-'))
  const project = completeProject()

  try {
    await writeDeclaredArtifacts(root, project)
    await writeMetadata({ repoRoot: root, project })

    const { checklist, checklistPath } = await buildReviewChecklist({
      repoRoot: root,
      project,
      humanDecision: 'approved',
      textReadable: false,
    })

    expect(checklistPath).toBe(`media/videos/${project.id}/review-checklist.json`)
    expect(checklist.policyWarnings).toEqual(['Synthetic voice is used; keep disclosure notes available for review.'])
    expect(checklist.mp4HasAudioStream).toBe(true)
    expect(checklist.textReadable).toBe(false)
    expect(checklist.humanDecision).toBe('approved')
    expect(checklist.reviewedAt).toMatch(/^2026-|^20/)
    expect(isChecklistApproved(checklist)).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('buildReviewChecklist rejects rendered MP4s without an audio stream', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-no-audio-'))
  const project = completeProject()

  try {
    await writeDeclaredArtifacts(root, project)
    await writeRenderMp4(path.join(root, project.artifacts.renderResult.mp4Path), { withAudio: false })
    await writeMetadata({ repoRoot: root, project })

    const { checklist } = await buildReviewChecklist({
      repoRoot: root,
      project,
      humanDecision: 'approved',
      textReadable: true,
    })

    expect(checklist.mp4Exists).toBe(true)
    expect(checklist.mp4HasAudioStream).toBe(false)
    expect(isChecklistApproved(checklist)).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('buildReviewChecklist records rejected human decisions without approving', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-rejected-'))
  const project = completeProject()

  try {
    await writeDeclaredArtifacts(root, project)
    await writeMetadata({ repoRoot: root, project })

    const { checklist } = await buildReviewChecklist({
      repoRoot: root,
      project,
      humanDecision: 'rejected',
      textReadable: true,
    })

    expect(checklist.mp4Exists).toBe(true)
    expect(checklist.mp4HasAudioStream).toBe(true)
    expect(checklist.thumbnailExists).toBe(true)
    expect(checklist.metadataValid).toBe(true)
    expect(checklist.humanDecision).toBe('rejected')
    expect(checklist.reviewedAt).toMatch(/^2026-|^20/)
    expect(isChecklistApproved(checklist)).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('buildReviewChecklist accepts voice-led duration when narration sets the render length', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-voice-led-'))
  const project = completeProject()
  const voiceLedProject = {
    ...project,
    idea: {
      ...project.idea,
      generationSettings: {
        durationMode: 'voice_led',
        visualComplexity: 'rich',
        pacing: 'natural',
        captions: 'burned_in',
        audioMix: 'voice_only',
      },
    },
    narration: {
      ...project.narration,
      durationSeconds: 42,
    },
    artifacts: {
      ...project.artifacts,
      renderResult: {
        ...project.artifacts.renderResult,
        durationSeconds: 42,
      },
    },
  }

  try {
    await writeDeclaredArtifacts(root, voiceLedProject)
    await writeMetadata({ repoRoot: root, project: voiceLedProject })

    const { checklist } = await buildReviewChecklist({
      repoRoot: root,
      project: voiceLedProject,
      humanDecision: 'approved',
      textReadable: true,
    })

    expect(checklist.durationMatchesPlan).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('buildReviewChecklist accepts planned duration when narration is shorter than the scene plan', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-short-narration-'))
  const project = completeProject()
  const voiceLedProject = {
    ...project,
    idea: {
      ...project.idea,
      generationSettings: {
        durationMode: 'voice_led',
        visualComplexity: 'rich',
        pacing: 'natural',
        captions: 'burned_in',
        audioMix: 'voice_only',
      },
    },
    narration: {
      ...project.narration,
      durationSeconds: 18.58,
    },
    artifacts: {
      ...project.artifacts,
      renderResult: {
        ...project.artifacts.renderResult,
        durationSeconds: 30,
      },
    },
  }

  try {
    await writeDeclaredArtifacts(root, voiceLedProject)
    await writeMetadata({ repoRoot: root, project: voiceLedProject })

    const { checklist } = await buildReviewChecklist({
      repoRoot: root,
      project: voiceLedProject,
      humanDecision: 'approved',
      textReadable: true,
    })

    expect(checklist.durationMatchesPlan).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
