import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { buildHyperFramesSource } from '../../server/source-builder.js'
import { createVideoProject } from '../../src/domain/video'

function projectWithScenePlan() {
  const project = createVideoProject(
    {
      title: 'Milo and Daisy',
      summary: 'A cat and dog find a moon cookie.',
      takeaway: 'Friends solve mysteries together.',
      references: [],
      generationSettings: {
        durationMode: 'voice_led',
        visualComplexity: 'rich',
        pacing: 'natural',
        captions: 'burned_in',
        audioMix: 'soft_music',
      },
    },
    '2026-05-31T00:00:00.000Z',
  )

  return {
    ...project,
    scenePlan: {
      totalDurationSeconds: 30,
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 5,
          visualDirection: 'Milo and Daisy discover a glowing cookie in the garden.',
          onScreenText: 'A moon cookie?',
          motionNotes: 'Slow push toward the cookie.',
          audioNotes: 'Soft sparkle.',
          acceptanceCriteria: ['Readable text.'],
        },
      ],
    },
    narration: {
      scriptPath: `media/videos/${project.id}/audio/narration.txt`,
      audioPath: `media/videos/${project.id}/audio/narration.wav`,
      voice: 'af_nova',
      durationSeconds: 42,
      status: 'audio_ready',
    },
  }
}

test('builds visible HyperFrames source from a real scene plan', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-builder-'))
  const project = projectWithScenePlan()

  try {
    await mkdir(path.join(root, 'media/videos', project.id, 'audio'), { recursive: true })
    await writeFile(path.join(root, project.narration.audioPath), 'fake wav', 'utf8')
    const source = await buildHyperFramesSource({ repoRoot: root, project })
    const html = await readFile(path.join(root, source.entryFile), 'utf8')
    const manifest = JSON.parse(await readFile(path.join(root, source.manifestPath), 'utf8'))
    const copiedAudio = await stat(path.join(root, source.sourceFolder, 'narration.wav'))
    const musicBed = await stat(path.join(root, 'media/videos', project.id, 'audio/music-bed.wav'))

    expect(source).toEqual({
      sourceFolder: `media/videos/${project.id}/hyperframes`,
      entryFile: `media/videos/${project.id}/hyperframes/index.html`,
      manifestPath: `media/videos/${project.id}/hyperframes/source-manifest.json`,
      status: 'source_ready',
    })
    expect(html).toContain('cinematic-story')
    expect(html).toContain('A moon cookie?')
    expect(html).toContain('data-duration="42"')
    expect(html).toContain('class="visual-stage motif-food"')
    expect(html).toContain('class="prop prop-cookie"')
    expect(html).toContain('class="caption-strip"')
    expect(html).toContain('src="narration.wav"')
    expect(html).not.toContain('<article class="scene-card">')
    expect(html).not.toContain('Milo and Daisy discover a glowing cookie in the garden.')
    expect(html).not.toContain('Test HyperFrames Source')
    expect(manifest).toMatchObject({
      entryFile: 'index.html',
      width: 1080,
      height: 1920,
      durationPolicy: 'voice_led',
      visualDurationSeconds: 42,
      audioDurationSeconds: 42,
      captions: 'burned_in',
      audioMix: 'soft_music',
      musicBedPath: `media/videos/${project.id}/audio/music-bed.wav`,
    })
    expect(copiedAudio.size).toBeGreaterThan(0)
    expect(musicBed.size).toBeGreaterThan(0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
