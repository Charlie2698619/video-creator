import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
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
    const child = spawn('npx', buildTtsArgs(scriptPath, outputPath, voice), { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error([stdout, stderr].filter(Boolean).join('\n') || `HyperFrames TTS exited with code ${code}.`))
    })
  })
}

function shouldRunDirectKokoroFallback(error) {
  const message = String(error?.message ?? error)
  return message.includes('kokoro-onnx package is not installed') || message.includes('soundfile package is not installed')
}

function inferKokoroLang(voice) {
  const prefix = voice?.[0]
  return {
    a: 'en-us',
    b: 'en-gb',
    e: 'es',
    f: 'fr-fr',
    h: 'hi',
    i: 'it',
    j: 'ja',
    p: 'pt-br',
    z: 'zh',
  }[prefix] ?? 'en-us'
}

function getKokoroCachePaths(home = homedir()) {
  const cacheRoot = path.join(home, '.cache', 'hyperframes', 'tts')
  return {
    modelPath: path.join(cacheRoot, 'models', 'kokoro-v1.0.onnx'),
    voicesPath: path.join(cacheRoot, 'voices', 'voices-v1.0.bin'),
  }
}

const directKokoroScript = `
import sys, json, inspect
import kokoro_onnx
import soundfile as sf

model_path = sys.argv[1]
voices_path = sys.argv[2]
text = sys.argv[3]
voice = sys.argv[4]
speed = float(sys.argv[5])
output_path = sys.argv[6]
lang = sys.argv[7] if len(sys.argv) > 7 else ""

model = kokoro_onnx.Kokoro(model_path, voices_path)
kwargs = {"voice": voice, "speed": speed}
if lang and "lang" in inspect.signature(model.create).parameters:
    kwargs["lang"] = lang

samples, sample_rate = model.create(text, **kwargs)
sf.write(output_path, samples, sample_rate)
print(json.dumps({"sampleRate": sample_rate, "durationSeconds": round(len(samples) / sample_rate, 3)}))
`

async function runDirectKokoroTts({ repoRoot, scriptPath, outputPath, voice, env }) {
  const python = resolveInside(repoRoot, '.venv-tts-py312', 'bin', 'python')
  const pythonCommand = existsSync(python) ? python : 'python3'
  const { modelPath, voicesPath } = getKokoroCachePaths(env.HOME)
  if (!existsSync(modelPath) || !existsSync(voicesPath)) {
    throw new Error('Kokoro model files are missing from ~/.cache/hyperframes/tts. Run HyperFrames TTS once after installing Kokoro assets.')
  }
  const text = await readFile(scriptPath, 'utf8')
  await new Promise((resolve, reject) => {
    const child = spawn(
      pythonCommand,
      ['-c', directKokoroScript, modelPath, voicesPath, text, voice, '1', outputPath, inferKokoroLang(voice)],
      { env, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error([stdout, stderr].filter(Boolean).join('\n') || `Direct Kokoro TTS exited with code ${code}.`))
    })
  })
}

export async function generateNarrationAudio({
  repoRoot,
  videoId,
  scriptPath,
  voice = 'af_nova',
  durationSeconds = 30,
  testMode = false,
  runHyperFramesTts = runTts,
  runDirectKokoroTts: directRunner = runDirectKokoroTts,
}) {
  const root = getVideoRoot(repoRoot, videoId)
  const audioDir = resolveInside(root, 'audio')
  const outputPath = resolveInside(audioDir, 'narration.wav')
  const resolvedScriptPath = resolveInside(repoRoot, scriptPath)
  await mkdir(audioDir, { recursive: true })
  await readFile(resolvedScriptPath, 'utf8')

  if (testMode) {
    await writeFile(outputPath, createSilentWav({ durationSeconds }))
  } else {
    const env = buildTtsEnv(repoRoot)
    try {
      await runHyperFramesTts(resolvedScriptPath, outputPath, voice, env)
    } catch (error) {
      if (!shouldRunDirectKokoroFallback(error)) throw error
      await directRunner({ repoRoot, scriptPath: resolvedScriptPath, outputPath, voice, env })
    }
  }
  const measuredDurationSeconds = await readWavDurationSeconds(outputPath)

  return {
    audioPath: path.relative(repoRoot, outputPath),
    voice,
    durationSeconds: measuredDurationSeconds,
    status: 'audio_ready',
  }
}
