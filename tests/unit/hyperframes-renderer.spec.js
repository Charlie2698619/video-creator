import { expect, test } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildHyperFramesRenderArgs, buildMuxNarrationArgs, getNextRenderPath, readSourceDurationSeconds } from '../../server/hyperframes-renderer.js'

test('builds the portrait HyperFrames render command', () => {
  expect(
    buildHyperFramesRenderArgs({
      sourceDir: '/repo/media/videos/video-1/hyperframes',
      outputPath: '/repo/media/videos/video-1/renders/render-001.mp4',
    }),
  ).toEqual([
    '--yes',
    'hyperframes',
    'render',
    '/repo/media/videos/video-1/hyperframes',
    '--output',
    '/repo/media/videos/video-1/renders/render-001.mp4',
    '--resolution',
    'portrait',
    '--fps',
    '30',
    '--quality',
    'standard',
    '--strict',
  ])
})

test('uses versioned render output paths', async () => {
  const outputPath = await getNextRenderPath('/repo/media/videos/video-1/renders', async () => false)
  expect(outputPath).toBe('/repo/media/videos/video-1/renders/render-001.mp4')
})

test('builds an ffmpeg command that muxes narration without shortening the video', () => {
  expect(
    buildMuxNarrationArgs({
      videoOnlyPath: '/repo/media/videos/video-1/renders/render-001.video-only.mp4',
      narrationAudioPath: '/repo/media/videos/video-1/audio/narration.wav',
      outputPath: '/repo/media/videos/video-1/renders/render-001.mp4',
    }),
  ).toEqual([
    '-y',
    '-i',
    '/repo/media/videos/video-1/renders/render-001.video-only.mp4',
    '-i',
    '/repo/media/videos/video-1/audio/narration.wav',
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    '/repo/media/videos/video-1/renders/render-001.mp4',
  ])
})

test('builds an ffmpeg command that mixes a music bed under narration', () => {
  const args = buildMuxNarrationArgs({
    videoOnlyPath: '/repo/media/videos/video-1/renders/render-001.video-only.mp4',
    narrationAudioPath: '/repo/media/videos/video-1/audio/narration.wav',
    musicBedPath: '/repo/media/videos/video-1/audio/music-bed.wav',
    outputPath: '/repo/media/videos/video-1/renders/render-001.mp4',
  })

  expect(args).toContain('/repo/media/videos/video-1/audio/music-bed.wav')
  expect(args).toContain('-filter_complex')
  expect(args.find((arg) => arg.includes('amix=inputs=2:duration=longest'))).toContain('[audio]')
  expect(args).toContain('[audio]')
})

test('reads voice-led render duration from the source manifest', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'render-duration-'))

  try {
    const sourceDir = path.join(root, 'media/videos/video-1/hyperframes')
    await mkdir(sourceDir, { recursive: true })
    await writeFile(
      path.join(sourceDir, 'source-manifest.json'),
      `${JSON.stringify({
        entryFile: 'index.html',
        width: 1080,
        height: 1920,
        visualDurationSeconds: 42,
      })}\n`,
      'utf8',
    )

    await expect(readSourceDurationSeconds(sourceDir)).resolves.toBe(42)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
