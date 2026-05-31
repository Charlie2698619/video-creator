import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { buildCodexArgs, buildStagePrompt, runCodexStage } from '../../server/codex-runner.js'

test('builds a workspace-write Codex command without unsafe sandbox flags', () => {
  const args = buildCodexArgs('/repo', '/repo/media/videos/video-1/codex-last-message.txt')

  expect(args).toEqual([
    'exec',
    '--sandbox',
    'workspace-write',
    '--cd',
    '/repo',
    '--output-last-message',
    '/repo/media/videos/video-1/codex-last-message.txt',
    '--json',
    '-',
  ])
  expect(args).not.toContain('danger-full-access')
  expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox')
})

test('builds explicit stage prompts with artifact paths', () => {
  const prompt = buildStagePrompt({
    stage: 'storyboard',
    projectTitle: 'Prompt test',
    videoRoot: 'media/videos/video-1',
  })

  expect(prompt).toContain('Write media/videos/video-1/storyboard.md')
  expect(prompt).toContain('Do not create social posts')
})

test('builds a narration script prompt with the local audio path', () => {
  const prompt = buildStagePrompt({
    stage: 'narration',
    projectTitle: 'Prompt test',
    videoRoot: 'media/videos/video-1',
  })

  expect(prompt).toContain('Write media/videos/video-1/audio/narration.txt')
  expect(prompt).toContain('plain text narration script')
})

test('source prompt includes generated narration audio when available', () => {
  const prompt = buildStagePrompt({
    stage: 'source',
    projectTitle: 'Prompt test',
    videoRoot: 'media/videos/video-1',
    narrationAudioPath: 'media/videos/video-1/audio/narration.wav',
  })

  expect(prompt).toContain('media/videos/video-1/audio/narration.wav')
  expect(prompt).toContain('src="../audio/narration.wav"')
})

test('test mode writes deterministic stage artifacts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-runner-'))

  try {
    const result = await runCodexStage({
      repoRoot: root,
      videoId: 'video-1',
      stage: 'storyboard',
      projectTitle: 'Test mode',
      testMode: true,
    })

    expect(result.status).toBe('completed')
    expect(result.artifactPath).toBe('media/videos/video-1/storyboard.md')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('test mode writes a deterministic narration script', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-narration-'))

  try {
    const result = await runCodexStage({
      repoRoot: root,
      videoId: 'video-1',
      stage: 'narration',
      projectTitle: 'Test mode',
      testMode: true,
    })

    expect(result.status).toBe('completed')
    expect(result.artifactPath).toBe('media/videos/video-1/audio/narration.txt')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('real mode reports the narration script file path after Codex completes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-real-narration-'))
  const binDir = path.join(root, 'bin')
  const fakeCodex = path.join(binDir, 'codex')
  const originalPath = process.env.PATH

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env bash
repo=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--cd" ]; then
    repo="$2"
    shift 2
  else
    shift
  fi
done
cat >/dev/null
mkdir -p "$repo/media/videos/video-1/audio"
printf 'Narration script.\\n' > "$repo/media/videos/video-1/audio/narration.txt"
exit 0
`,
      'utf8',
    )
    await chmod(fakeCodex, 0o755)
    process.env.PATH = `${binDir}:${originalPath ?? ''}`

    const result = await runCodexStage({
      repoRoot: root,
      videoId: 'video-1',
      stage: 'narration',
      projectTitle: 'Real mode',
      testMode: false,
    })

    expect(result.status).toBe('completed')
    expect(result.artifactPath).toBe('media/videos/video-1/audio/narration.txt')
  } finally {
    process.env.PATH = originalPath
    await rm(root, { recursive: true, force: true })
  }
})
