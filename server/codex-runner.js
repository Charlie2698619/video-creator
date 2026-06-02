import { spawn } from 'node:child_process'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { getVideoRoot, resolveInside } from './paths.js'

const allowedStages = new Set(['storyboard', 'scene_plan', 'narration', 'source'])

function getStageArtifactPath(videoId, stage) {
  const root = `media/videos/${videoId}`
  if (stage === 'storyboard') return `${root}/storyboard.md`
  if (stage === 'scene_plan') return `${root}/scene-plan.json`
  if (stage === 'narration') return `${root}/audio/narration.txt`
  return `${root}/hyperframes/source-manifest.json`
}

export function buildCodexArgs(repoRoot, lastMessagePath) {
  return ['exec', '--sandbox', 'workspace-write', '--cd', repoRoot, '--output-last-message', lastMessagePath, '--json', '-']
}

function normalizeGenerationSettings(input = {}) {
  return {
    durationMode: input.durationMode ?? 'voice_led',
    visualComplexity: input.visualComplexity ?? 'rich',
    pacing: input.pacing ?? 'natural',
    captions: input.captions ?? 'burned_in',
    audioMix: input.audioMix ?? 'voice_only',
  }
}

function spokenWordRange(durationSeconds) {
  return {
    min: Math.round(durationSeconds * 3.5),
    max: Math.round(durationSeconds * 4.1),
  }
}

function buildIdeaContext({ ideaSummary, viewerTakeaway }) {
  const lines = []
  if (ideaSummary) lines.push(`Idea summary: ${ideaSummary}`)
  if (viewerTakeaway) lines.push(`Viewer takeaway: ${viewerTakeaway}`)
  return lines
}

function buildStoryboardContext(storyboard) {
  if (!storyboard) return []
  const lines = []
  if (storyboard.hook) lines.push(`Storyboard hook: ${storyboard.hook}`)
  if (storyboard.beats?.length) lines.push(`Storyboard beats: ${storyboard.beats.join(' | ')}`)
  if (storyboard.ending) lines.push(`Storyboard ending: ${storyboard.ending}`)
  if (storyboard.tone) lines.push(`Storyboard tone: ${storyboard.tone}`)
  return lines
}

export function buildStagePrompt({
  stage,
  projectTitle,
  videoRoot,
  storyboard = null,
  narrationAudioPath = null,
  targetDurationSeconds = 30,
  generationSettings = {},
  ideaSummary = '',
  viewerTakeaway = '',
}) {
  const settings = normalizeGenerationSettings(generationSettings)
  const wordRange = spokenWordRange(targetDurationSeconds)
  const ideaContext = buildIdeaContext({ ideaSummary, viewerTakeaway })
  const storyboardContext = buildStoryboardContext(storyboard)
  const guardrails = [
    'Complete only this artifact-generation task.',
    'Write the requested file path(s) directly, then stop.',
    'Do not run tests, inspect unrelated files, create extra docs, or perform a verification pass.',
  ].join('\n')
  if (stage === 'storyboard') {
    return [
      guardrails,
      `Create a short-video storyboard for "${projectTitle}".`,
      ...ideaContext,
      `Tone: human, natural, and creator-led; pacing should feel ${settings.pacing}.`,
      `Write ${videoRoot}/storyboard.md with Hook, Beats, Ending, and Tone sections.`,
      'Do not create social posts, platform variants, analytics, calendars, or publishing assets.',
    ].join('\n')
  }
  if (stage === 'scene_plan') {
    return [
      guardrails,
      `Create a ${targetDurationSeconds}-second 9:16 scene plan for "${projectTitle}".`,
      ...ideaContext,
      ...storyboardContext,
      `Visual complexity: ${settings.visualComplexity}. Use human-oriented framing, natural motion, and concrete creator-style visual details.`,
      `Audio mix direction: ${settings.audioMix}.`,
      `Captions: ${settings.captions}. Keep on-screen text short enough to read in a vertical short.`,
      `Write ${videoRoot}/scene-plan.json as JSON with exactly this top-level shape: {"scenes":[{"sceneNumber":1,"durationSeconds":5,"visualDirection":"...","onScreenText":"...","motionNotes":"...","audioNotes":"...","acceptanceCriteria":["..."]}],"totalDurationSeconds":${targetDurationSeconds}}.`,
      'Audio notes should support the narration but not replace it.',
    ].join('\n')
  }
  if (stage === 'narration') {
    return [
      guardrails,
      `Create an approximately ${targetDurationSeconds}-second AI narration script for "${projectTitle}".`,
      ...ideaContext,
      `Write ${videoRoot}/audio/narration.txt as a plain text narration script.`,
      `Keep it to ${wordRange.min}-${wordRange.max} spoken words, one warm human voice, no markdown, no scene labels, no music cues, no social publishing copy.`,
    ].join('\n')
  }
  const audioInstruction = narrationAudioPath
    ? [
        `A narration WAV exists at ${narrationAudioPath}.`,
        'Include it as a separate top-level audio clip in index.html:',
        '<audio id="narration" data-start="0" data-duration="30" data-track-index="20" src="../audio/narration.wav" data-volume="1"></audio>',
      ].join('\n')
    : 'No narration audio is available; do not create placeholder audio.'
  return [
    guardrails,
    `Create HyperFrames source for "${projectTitle}".`,
    ...ideaContext,
    `Write ${videoRoot}/hyperframes/index.html and ${videoRoot}/hyperframes/source-manifest.json.`,
    'The composition must be 1080x1920 portrait and renderable by HyperFrames.',
    audioInstruction,
  ].join('\n')
}

async function artifactExists(repoRoot, artifactPath) {
  try {
    await stat(resolveInside(repoRoot, artifactPath))
    return true
  } catch {
    return false
  }
}

async function writeTestArtifact(repoRoot, videoId, stage, narrationAudioPath = null, targetDurationSeconds = 30) {
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
              durationSeconds: targetDurationSeconds,
              visualDirection: 'Test',
              onScreenText: 'Test',
              motionNotes: 'Fade',
              audioNotes: '',
              acceptanceCriteria: ['Readable'],
            },
          ],
          totalDurationSeconds: targetDurationSeconds,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    return `media/videos/${videoId}/scene-plan.json`
  }
  if (stage === 'narration') {
    const audioDir = resolveInside(root, 'audio')
    await mkdir(audioDir, { recursive: true })
    await writeFile(resolveInside(audioDir, 'narration.txt'), 'Local-first video tools keep creators in control because source files, renders, thumbnails, metadata, and review checks stay visible on disk. Every step leaves an artifact that can be inspected, revised, and archived without waiting on a publishing platform. The final MP4 is easier to trust because the path from idea to render is explicit.\n', 'utf8')
    return `media/videos/${videoId}/audio/narration.txt`
  }
  const hyperframes = resolveInside(root, 'hyperframes')
  await mkdir(hyperframes, { recursive: true })
  const audioTag = narrationAudioPath
    ? '<audio id="narration" data-start="0" data-duration="30" data-track-index="20" src="../audio/narration.wav" data-volume="1"></audio>'
    : ''
  await writeFile(
    resolveInside(hyperframes, 'index.html'),
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Test HyperFrames Source</title>
    <style>
      body { margin: 0; background: #0f172a; }
      #hf-root {
        width: 1080px;
        height: 1920px;
        display: grid;
        place-items: center;
        color: #f8fafc;
        font: 72px/1.1 system-ui, sans-serif;
      }
    </style>
  </head>
  <body>
    ${audioTag}
    <main id="hf-root" data-composition-id="video-test" data-start="0" data-duration="1" data-width="1080" data-height="1920" data-track-index="0">
      Test
    </main>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.set("#hf-root", { opacity: 1 }, 0);
      window.__timelines["video-test"] = tl;
    </script>
  </body>
</html>
`,
    'utf8',
  )
  await writeFile(resolveInside(hyperframes, 'source-manifest.json'), '{"entryFile":"index.html","width":1080,"height":1920}\n', 'utf8')
  return `media/videos/${videoId}/hyperframes/source-manifest.json`
}

export async function runCodexStage({
  repoRoot,
  videoId,
  stage,
  projectTitle,
  storyboard = null,
  narrationAudioPath = null,
  targetDurationSeconds = 30,
  generationSettings = {},
  ideaSummary = '',
  viewerTakeaway = '',
  testMode = false,
}) {
  if (!allowedStages.has(stage)) throw new Error('Unsupported Codex stage.')
  const videoRoot = getVideoRoot(repoRoot, videoId)
  await mkdir(videoRoot, { recursive: true })
  const relativeRoot = `media/videos/${videoId}`
  const prompt = buildStagePrompt({
    stage,
    projectTitle,
    videoRoot: relativeRoot,
    storyboard,
    narrationAudioPath,
    targetDurationSeconds,
    generationSettings,
    ideaSummary,
    viewerTakeaway,
  })
  const promptPath = resolveInside(videoRoot, `codex-${stage}.prompt.txt`)
  const lastMessagePath = resolveInside(videoRoot, `codex-${stage}.last-message.txt`)
  const artifactPath = getStageArtifactPath(videoId, stage)
  const timeoutMs = Number(process.env.CODEX_STAGE_TIMEOUT_MS ?? 180_000)
  await writeFile(promptPath, prompt, 'utf8')

  if (testMode) {
    return { status: 'completed', artifactPath: await writeTestArtifact(repoRoot, videoId, stage, narrationAudioPath, targetDurationSeconds), promptPath }
  }

  let codexError = null
  await new Promise((resolve) => {
    const child = spawn('codex', buildCodexArgs(repoRoot, lastMessagePath), { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeoutMs)
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      codexError = error
      resolve()
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve()
      else {
        codexError = new Error(stderr || `Codex exited with code ${code}.`)
        resolve()
      }
    })
    child.stdin.end(prompt)
  })

  if (!(await artifactExists(repoRoot, artifactPath))) {
    throw codexError ?? new Error(`Codex did not create ${artifactPath}.`)
  }

  return { status: 'completed', artifactPath, promptPath }
}
