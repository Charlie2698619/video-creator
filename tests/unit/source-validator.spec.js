import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { validateHyperFramesSource } from '../../server/source-validator.js'

async function writeSource(root, videoId, { html, manifest = { entryFile: 'index.html', width: 1080, height: 1920 } }) {
  const sourceDir = path.join(root, 'media/videos', videoId, 'hyperframes')
  await mkdir(sourceDir, { recursive: true })
  await writeFile(path.join(sourceDir, 'index.html'), html, 'utf8')
  if (manifest) {
    await writeFile(path.join(sourceDir, 'source-manifest.json'), `${JSON.stringify(manifest)}\n`, 'utf8')
  }
}

function validHtml(audioSrc) {
  const audioTag = `<audio id="narration" data-start="0" data-duration="30" data-track-index="20" src="${audioSrc}" data-volume="1"></audio>`
  return `<!doctype html>
<html>
  <body>
    ${audioTag}
    <main id="hf-root" data-composition-id="video-test" data-start="0" data-duration="30" data-width="1080" data-height="1920" data-track-index="0">
      Test
    </main>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["video-test"] = {};
    </script>
  </body>
</html>
`
}

test('accepts valid source with either Codex or fallback narration paths', async () => {
  for (const audioSrc of ['../audio/narration.wav', 'narration.wav']) {
    const root = await mkdtemp(path.join(tmpdir(), 'source-validator-valid-'))
    const videoId = 'video-1'

    try {
      await writeSource(root, videoId, { html: validHtml(audioSrc) })

      const result = await validateHyperFramesSource({ repoRoot: root, videoId, expectAudio: true })

      expect(result).toEqual({ valid: true, reasons: [] })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
})

test('rejects missing manifest', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-validator-no-manifest-'))
  const videoId = 'video-1'

  try {
    await writeSource(root, videoId, { html: validHtml('narration.wav'), manifest: null })

    const result = await validateHyperFramesSource({ repoRoot: root, videoId, expectAudio: true })

    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('source-manifest.json is missing')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects wrong composition dimensions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-validator-dims-'))
  const videoId = 'video-1'

  try {
    await writeSource(root, videoId, {
      html: validHtml('narration.wav').replace('data-height="1920"', 'data-height="1080"'),
      manifest: { entryFile: 'index.html', width: 1080, height: 1080 },
    })

    const result = await validateHyperFramesSource({ repoRoot: root, videoId, expectAudio: true })

    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('source-manifest.json must declare 1080x1920')
    expect(result.reasons).toContain('index.html must include data-width="1080" and data-height="1920"')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects missing narration audio tag when audio is expected', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'source-validator-audio-'))
  const videoId = 'video-1'

  try {
    await writeSource(root, videoId, { html: validHtml('narration.wav').replace('narration.wav', 'voice.wav') })

    const result = await validateHyperFramesSource({ repoRoot: root, videoId, expectAudio: true })

    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('index.html must reference narration.wav when audio is expected')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
