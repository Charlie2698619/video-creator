import { expect, test } from '@playwright/test'
import viteConfig from '../../vite.config'

test('dev server ignores local agent and runtime artifact directories', () => {
  const ignored = viteConfig.server?.watch?.ignored

  expect(ignored).toContain('**/.codex')
  expect(ignored).toContain('**/.codex/**')
  expect(ignored).toContain('**/media/videos/**')
})
