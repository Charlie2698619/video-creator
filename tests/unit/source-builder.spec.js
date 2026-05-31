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
      durationSeconds: 30,
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
    const copiedAudio = await stat(path.join(root, source.sourceFolder, 'narration.wav'))

    expect(source).toEqual({
      sourceFolder: `media/videos/${project.id}/hyperframes`,
      entryFile: `media/videos/${project.id}/hyperframes/index.html`,
      manifestPath: `media/videos/${project.id}/hyperframes/source-manifest.json`,
      status: 'source_ready',
    })
    expect(html).toContain('moon-cookie-story')
    expect(html).toContain('A moon cookie?')
    expect(html).toContain('src="narration.wav"')
    expect(html).not.toContain('Test HyperFrames Source')
    expect(copiedAudio.size).toBeGreaterThan(0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
