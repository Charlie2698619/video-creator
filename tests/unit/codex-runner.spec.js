import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { buildCodexArgs, buildStagePrompt, runCodexStage } from '../../server/codex-runner.js'

const formatStrategy = {
  formatType: 'programmatic_explainer',
  contentMoat: 'Original source material and creator point of view.',
  visualSystem: 'Axis diagram, kinetic text, comparison cards.',
  syncPriority: 'high',
  riskFlags: {
    publicFigure: false,
    syntheticVoice: false,
    aiMusic: false,
    realisticSyntheticScene: false,
  },
  policyNotes: [],
}

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
    ideaSummary: 'A baker gives away the last peach before the festival.',
    viewerTakeaway: 'Generosity returns through community care.',
    videoRoot: 'media/videos/video-1',
  })

  expect(prompt).toContain('Write media/videos/video-1/storyboard.md')
  expect(prompt).toContain('Do not create social posts')
  expect(prompt).toContain('A baker gives away the last peach before the festival.')
  expect(prompt).toContain('Generosity returns through community care.')
})

test('builds a narration script prompt with the local audio path', () => {
  const prompt = buildStagePrompt({
    stage: 'narration',
    projectTitle: 'Prompt test',
    videoRoot: 'media/videos/video-1',
    targetDurationSeconds: 40,
  })

  expect(prompt).toContain('Write media/videos/video-1/audio/narration.txt')
  expect(prompt).toContain('plain text narration script')
  expect(prompt).toContain('140-164 spoken words')
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

test('storyboard prompt includes format strategy context', () => {
  const prompt = buildStagePrompt({
    stage: 'storyboard',
    projectTitle: 'Format prompt',
    videoRoot: 'media/videos/video-1',
    formatStrategy,
  })

  expect(prompt).toContain('Format type: programmatic_explainer')
  expect(prompt).toContain('Content moat: Original source material and creator point of view.')
  expect(prompt).toContain('Visual system: Axis diagram, kinetic text, comparison cards.')
})

test('source prompt includes template-family guidance from format strategy', () => {
  const prompt = buildStagePrompt({
    stage: 'source',
    projectTitle: 'Format prompt',
    videoRoot: 'media/videos/video-1',
    formatStrategy: {
      ...formatStrategy,
      formatType: 'multi_image_story',
      contentMoat: 'Character goal, obstacle, reversal, emotional payoff.',
      visualSystem: 'Story panels, consistent setting, caption strips.',
      syncPriority: 'medium',
    },
    narrationAudioPath: 'media/videos/video-1/audio/narration.wav',
  })

  expect(prompt).toContain('Format type: multi_image_story')
  expect(prompt).toContain('Use story-panel composition')
  expect(prompt).toContain('consistent setting')
})

test('scene plan prompt includes storyboard context when available', () => {
  const prompt = buildStagePrompt({
    stage: 'scene_plan',
    projectTitle: 'Prompt test',
    videoRoot: 'media/videos/video-1',
    storyboard: {
      hook: 'X hook',
      beats: ['Pivot moves left', 'Sort both sides'],
      ending: 'Sorted list lands in place',
      tone: 'Crisp',
    },
  })

  expect(prompt).toContain('X hook')
  expect(prompt).toContain('Pivot moves left')
  expect(prompt).toContain('Sort both sides')
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
