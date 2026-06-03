import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { getRepoRoot } from './paths.js'

const execFileAsync = promisify(execFile)
const toolNames = ['codex', 'ffmpeg', 'ffprobe']

export async function resolveCommand(command) {
  const resolver = process.platform === 'win32' ? 'where' : 'which'
  try {
    const { stdout } = await execFileAsync(resolver, [command], { windowsHide: true })
    return stdout.trim().split(/\r?\n/).find(Boolean) ?? null
  } catch {
    return null
  }
}

function commandStatus(commandPath) {
  return commandPath
    ? { present: true, detail: commandPath }
    : { present: false, detail: 'not found on PATH' }
}

function venvStatus(venvPath, exists) {
  return exists(venvPath)
    ? { present: true, detail: venvPath }
    : { present: false, detail: `${venvPath} not found` }
}

export async function checkTools({ repoRoot = getRepoRoot(), which = resolveCommand, exists = existsSync } = {}) {
  const [codex, ffmpeg, ffprobe] = await Promise.all(toolNames.map(async (toolName) => commandStatus(await which(toolName))))
  const ttsVenvPath = path.join(repoRoot, '.venv-tts-py312')

  return {
    codex,
    ffmpeg,
    ffprobe,
    ttsVenv: venvStatus(ttsVenvPath, exists),
  }
}

export function formatToolStatus(tools) {
  const rows = [
    ['codex', tools.codex],
    ['ffmpeg', tools.ffmpeg],
    ['ffprobe', tools.ffprobe],
    ['ttsVenv', tools.ttsVenv],
  ]
  return rows
    .map(([name, status]) => `${name.padEnd(8)} ${status.present ? 'present' : 'missing'}  ${status.detail}`)
    .join('\n')
}

export async function runDoctor({ repoRoot = getRepoRoot(), stdout = process.stdout } = {}) {
  const tools = await checkTools({ repoRoot })
  stdout.write(`${formatToolStatus(tools)}\n`)
  return tools
}

const currentModulePath = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentModulePath) {
  runDoctor().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
