import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getVideoRoot, resolveInside } from './paths.js'

export function buildTtsArgs(scriptPath, outputPath, voice) {
  return ['--yes', 'hyperframes', 'tts', scriptPath, '--voice', voice, '--output', outputPath]
}

export function buildTtsEnv(repoRoot, baseEnv = process.env) {
  const venvRoot = path.join(repoRoot, '.venv-tts-py312')
  const venvBin = path.join(venvRoot, 'bin')
  if (!existsSync(venvBin)) return baseEnv

  return {
    ...baseEnv,
    PATH: `${venvBin}${path.delimiter}${baseEnv.PATH ?? ''}`,
    VIRTUAL_ENV: venvRoot,
  }
}

function createSilentWav({ durationSeconds, sampleRate = 44_100 }) {
  const channels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = durationSeconds * sampleRate * channels * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28)
  buffer.writeUInt16LE(channels * bytesPerSample, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  return buffer
}

export async function readWavDurationSeconds(filePath) {
  const buffer = await readFile(filePath)
  if (buffer.length < 44 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new Error('Narration audio must be a WAV file.')
  }

  let byteRate = null
  let dataSize = null
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString('ascii')
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkId === 'fmt ' && chunkSize >= 16) byteRate = buffer.readUInt32LE(offset + 16)
    if (chunkId === 'data') dataSize = chunkSize
    offset += 8 + chunkSize + (chunkSize % 2)
  }

  if (!byteRate || dataSize === null) throw new Error('Narration WAV duration could not be measured.')
  return Number((dataSize / byteRate).toFixed(2))
}

async function runTts(scriptPath, outputPath, voice, env) {
  await new Promise((resolve, reject) => {
    const child = spawn('npx', buildTtsArgs(scriptPath, outputPath, voice), { env, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `HyperFrames TTS exited with code ${code}.`))
    })
  })
}

export async function generateNarrationAudio({ repoRoot, videoId, scriptPath, voice = 'af_nova', durationSeconds = 30, testMode = false }) {
  const root = getVideoRoot(repoRoot, videoId)
  const audioDir = resolveInside(root, 'audio')
  const outputPath = resolveInside(audioDir, 'narration.wav')
  const resolvedScriptPath = resolveInside(repoRoot, scriptPath)
  await mkdir(audioDir, { recursive: true })
  await readFile(resolvedScriptPath, 'utf8')

  if (testMode) {
    await writeFile(outputPath, createSilentWav({ durationSeconds }))
  } else {
    await runTts(resolvedScriptPath, outputPath, voice, buildTtsEnv(repoRoot))
  }
  const measuredDurationSeconds = await readWavDurationSeconds(outputPath)

  return {
    audioPath: path.relative(repoRoot, outputPath),
    voice,
    durationSeconds: measuredDurationSeconds,
    status: 'audio_ready',
  }
}
