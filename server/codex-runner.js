import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { getVideoRoot, resolveInside } from './paths.js'

const allowedStages = new Set(['storyboard', 'scene_plan', 'narration', 'source'])

export function buildCodexArgs(repoRoot, lastMessagePath) {
  return ['exec', '--sandbox', 'workspace-write', '--cd', repoRoot, '--output-last-message', lastMessagePath, '--json', '-']
}

export function buildStagePrompt({ stage, projectTitle, videoRoot, narrationAudioPath = null }) {
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
  if (stage === 'narration') {
    return [
      `Create a 30-second AI narration script for "${projectTitle}".`,
      `Write ${videoRoot}/audio/narration.txt as a plain text narration script.`,
      'Keep it to 65-85 spoken words, one voice, no markdown, no scene labels, no music cues, no social publishing copy.',
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
    `Create HyperFrames source for "${projectTitle}".`,
    `Write ${videoRoot}/hyperframes/index.html and ${videoRoot}/hyperframes/source-manifest.json.`,
    'The composition must be 1080x1920 portrait and renderable by HyperFrames.',
    audioInstruction,
  ].join('\n')
}

async function writeTestArtifact(repoRoot, videoId, stage, narrationAudioPath = null) {
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

export async function runCodexStage({ repoRoot, videoId, stage, projectTitle, narrationAudioPath = null, testMode = false }) {
  if (!allowedStages.has(stage)) throw new Error('Unsupported Codex stage.')
  const videoRoot = getVideoRoot(repoRoot, videoId)
  await mkdir(videoRoot, { recursive: true })
  const relativeRoot = `media/videos/${videoId}`
  const prompt = buildStagePrompt({ stage, projectTitle, videoRoot: relativeRoot, narrationAudioPath })
  const promptPath = resolveInside(videoRoot, `codex-${stage}.prompt.txt`)
  const lastMessagePath = resolveInside(videoRoot, `codex-${stage}.last-message.txt`)
  await writeFile(promptPath, prompt, 'utf8')

  if (testMode) {
    return { status: 'completed', artifactPath: await writeTestArtifact(repoRoot, videoId, stage, narrationAudioPath), promptPath }
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
