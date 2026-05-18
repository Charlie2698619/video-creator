import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { getVideoRoot, resolveInside } from './paths.js'

const allowedStages = new Set(['storyboard', 'scene_plan', 'source'])

export function buildCodexArgs(repoRoot, lastMessagePath) {
  return ['exec', '--sandbox', 'workspace-write', '--cd', repoRoot, '--output-last-message', lastMessagePath, '--json', '-']
}

export function buildStagePrompt({ stage, projectTitle, videoRoot }) {
  if (stage === 'storyboard') {
    return [
      `Create a short-video storyboard for "${projectTitle}".`,
      `Write ${videoRoot}/storyboard.md with Hook, Beats, Ending, and Tone sections.`,
      'Do not create social posts, platform variants, analytics, calendars, or publishing assets.',
    ].join('\n')
  }
  if (stage === 'scene_plan') {
    return [
      `Create a 30-second 9:16 scene plan for "${projectTitle}".`,
      `Write ${videoRoot}/scene-plan.json with scenes, timing, visualDirection, onScreenText, motionNotes, audioNotes, and acceptanceCriteria.`,
      'Audio is optional scene metadata.',
    ].join('\n')
  }
  return [
    `Create HyperFrames source for "${projectTitle}".`,
    `Write ${videoRoot}/hyperframes/index.html and ${videoRoot}/hyperframes/source-manifest.json.`,
    'The composition must be 1080x1920 portrait and renderable by HyperFrames.',
  ].join('\n')
}

async function writeTestArtifact(repoRoot, videoId, stage) {
  const root = getVideoRoot(repoRoot, videoId)
  await mkdir(root, { recursive: true })
  if (stage === 'storyboard') {
    const artifact = resolveInside(root, 'storyboard.md')
    await writeFile(artifact, '# Storyboard\n\nHook: Test hook\n\nBeats:\n- Beat 1\n\nEnding: Test ending\n\nTone: Practical\n', 'utf8')
    return `media/videos/${videoId}/storyboard.md`
  }
  if (stage === 'scene_plan') {
    const artifact = resolveInside(root, 'scene-plan.json')
    await writeFile(
      artifact,
      `${JSON.stringify(
        {
          scenes: [
            {
              sceneNumber: 1,
              durationSeconds: 30,
              visualDirection: 'Test',
              onScreenText: 'Test',
              motionNotes: 'Fade',
              audioNotes: '',
              acceptanceCriteria: ['Readable'],
            },
          ],
          totalDurationSeconds: 30,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    return `media/videos/${videoId}/scene-plan.json`
  }
  const hyperframes = resolveInside(root, 'hyperframes')
  await mkdir(hyperframes, { recursive: true })
  await writeFile(
    resolveInside(hyperframes, 'index.html'),
    '<!doctype html><html><body><main style="width:1080px;height:1920px">Test</main></body></html>\n',
    'utf8',
  )
  await writeFile(resolveInside(hyperframes, 'source-manifest.json'), '{"entryFile":"index.html","width":1080,"height":1920}\n', 'utf8')
  return `media/videos/${videoId}/hyperframes/source-manifest.json`
}

export async function runCodexStage({ repoRoot, videoId, stage, projectTitle, testMode = false }) {
  if (!allowedStages.has(stage)) throw new Error('Unsupported Codex stage.')
  const videoRoot = getVideoRoot(repoRoot, videoId)
  await mkdir(videoRoot, { recursive: true })
  const relativeRoot = `media/videos/${videoId}`
  const prompt = buildStagePrompt({ stage, projectTitle, videoRoot: relativeRoot })
  const promptPath = resolveInside(videoRoot, `codex-${stage}.prompt.txt`)
  const lastMessagePath = resolveInside(videoRoot, `codex-${stage}.last-message.txt`)
  await writeFile(promptPath, prompt, 'utf8')

  if (testMode) {
    return { status: 'completed', artifactPath: await writeTestArtifact(repoRoot, videoId, stage), promptPath }
  }

  await new Promise((resolve, reject) => {
    const child = spawn('codex', buildCodexArgs(repoRoot, lastMessagePath), { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `Codex exited with code ${code}.`))
    })
    child.stdin.end(prompt)
  })

  return { status: 'completed', artifactPath: relativeRoot, promptPath }
}
