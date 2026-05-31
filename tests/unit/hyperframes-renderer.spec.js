import { expect, test } from '@playwright/test'
import { buildHyperFramesRenderArgs, buildMuxNarrationArgs, getNextRenderPath } from '../../server/hyperframes-renderer.js'

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
