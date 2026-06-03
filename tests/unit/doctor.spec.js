import { expect, test } from '@playwright/test'
import { checkTools } from '../../server/doctor.js'

test('reports dependency presence with injected resolvers', async () => {
  const requestedCommands = []
  const commandPaths = {
    codex: '/tools/codex',
    ffmpeg: '/tools/ffmpeg',
    ffprobe: null,
  }

  const tools = await checkTools({
    repoRoot: '/repo',
    which: async (command) => {
      requestedCommands.push(command)
      return commandPaths[command]
    },
    exists: (filePath) => filePath === '/repo/.venv-tts-py312',
  })

  expect(requestedCommands).toEqual(['codex', 'ffmpeg', 'ffprobe'])
  expect(tools).toEqual({
    codex: { present: true, detail: '/tools/codex' },
    ffmpeg: { present: true, detail: '/tools/ffmpeg' },
    ffprobe: { present: false, detail: 'not found on PATH' },
    ttsVenv: { present: true, detail: '/repo/.venv-tts-py312' },
  })
})
