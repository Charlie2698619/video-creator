import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { buildTtsArgs, buildTtsEnv, generateNarrationAudio } from '../../server/narration.js'

test('builds the local HyperFrames TTS command', () => {
  expect(buildTtsArgs('/video/audio/narration.txt', '/video/audio/narration.wav', 'af_nova')).toEqual([
    '--yes',
    'hyperframes',
    'tts',
    '/video/audio/narration.txt',
    '--voice',
    'af_nova',
    '--output',
    '/video/audio/narration.wav',
  ])
})

test('prefers the local Python 3.12 TTS environment when present', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tts-env-'))

  try {
    await mkdir(path.join(root, '.venv-tts-py312/bin'), { recursive: true })
    const env = buildTtsEnv(root, { PATH: '/usr/bin' })

    expect(env.VIRTUAL_ENV).toBe(path.join(root, '.venv-tts-py312'))
    expect(env.PATH.split(path.delimiter)[0]).toBe(path.join(root, '.venv-tts-py312/bin'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('test mode writes a deterministic wav narration artifact', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'narration-'))
  const videoRoot = path.join(root, 'media/videos/video-1')
  const scriptPath = path.join(videoRoot, 'audio/narration.txt')

  try {
    await mkdir(path.dirname(scriptPath), { recursive: true })
    await writeFile(scriptPath, 'A short local-first narration script.', 'utf8')
    const result = await generateNarrationAudio({
      repoRoot: root,
      videoId: 'video-1',
      scriptPath: 'media/videos/video-1/audio/narration.txt',
      voice: 'af_nova',
      durationSeconds: 30,
      testMode: true,
    })

    expect(result.audioPath).toBe('media/videos/video-1/audio/narration.wav')
    expect(result.voice).toBe('af_nova')
    expect((await stat(path.join(root, result.audioPath))).size).toBeGreaterThan(44)
    expect((await readFile(path.join(root, result.audioPath))).subarray(0, 4).toString('ascii')).toBe('RIFF')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
