import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('turns one idea into a reviewed video in test mode', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Video Creator' })).toBeVisible()
  await page.getByLabel('Working title').fill('Artifact honesty short')
  await page.getByLabel('Idea summary').fill('Explain why source files and rendered MP4s are different.')
  await page.getByLabel('Viewer takeaway').fill('A render is the artifact that review should inspect.')
  await page.getByRole('button', { name: 'Save idea' }).click()

  await page.getByRole('button', { name: 'Create storyboard with Codex' }).click()
  await expect(page.getByText('Storyboard ready')).toBeVisible()

  await page.getByRole('button', { name: 'Create scene plan with Codex' }).click()
  await expect(page.getByText('Scene plan ready')).toBeVisible()

  await page.getByRole('button', { name: 'Create narration script with Codex' }).click()
  await expect(page.getByText('Narration script ready')).toBeVisible()
  await page.getByRole('button', { name: 'Generate AI voiceover' }).click()
  await expect(page.getByText('Narration audio ready')).toBeVisible()

  await page.getByRole('button', { name: 'Create HyperFrames source with Codex' }).click()
  await expect(page.getByText('HyperFrames source ready')).toBeVisible()

  await page.getByRole('button', { name: 'Render MP4' }).click()
  await expect(page.getByText('MP4 rendered')).toBeVisible({ timeout: 30_000 })

  const projectsResponse = await page.request.get('http://127.0.0.1:8787/api/projects')
  const { projects } = (await projectsResponse.json()) as { projects: Array<{ id: string; artifacts: { renderResult: { mp4Path: string } | null } }> }
  const mp4Path = projects.find((project) => project.title === 'Artifact honesty short')?.artifacts.renderResult?.mp4Path
  expect(mp4Path).toBeTruthy()
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', mp4Path!])
  expect(stdout.trim()).toBe('audio')

  await page.getByRole('button', { name: 'Create thumbnail' }).click()
  await page.getByRole('button', { name: 'Write metadata JSON' }).click()
  await expect(page.getByText('Metadata ready')).toBeVisible()

  await page.getByLabel('On-screen text is readable').check()
  await page.getByRole('button', { name: 'Approve review' }).click()
  await expect(page.getByText('Reviewed')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Media Library' })).toBeVisible()
})
