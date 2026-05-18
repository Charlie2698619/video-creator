import { expect, test } from '@playwright/test'
import { buildHyperFramesRenderArgs, getNextRenderPath } from '../../server/hyperframes-renderer.js'

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
