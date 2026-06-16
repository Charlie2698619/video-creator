import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('turns one idea into a reviewed video in test mode', async ({ page }) => {
  test.setTimeout(90_000)
  const title = `Artifact honesty short ${crypto.randomUUID()}`
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Video Creator' })).toBeVisible()
  await page.getByLabel('Working title').fill(title)
  await page.getByLabel('Idea summary').fill('Explain why source files and rendered MP4s are different.')
  await page.getByLabel('Viewer takeaway').fill('A render is the artifact that review should inspect.')
  await page.getByRole('button', { name: 'Save idea' }).click()

  await page.getByLabel('Format type').selectOption('programmatic_explainer')
  await page.getByLabel('Content moat').fill('Original explanation of artifact honesty and review discipline.')
  await page.getByLabel('Visual system').fill('Kinetic title, comparison cards, source-versus-render checklist.')
  await page.getByLabel('Sync priority').selectOption('high')
  await page.getByRole('checkbox', { name: 'Synthetic voice' }).check()
  await page.getByRole('button', { name: 'Save strategy' }).click()
  await expect(page.getByLabel('Format Strategy').getByText('programmatic_explainer')).toBeVisible()

  await page.getByRole('button', { name: 'Generate draft' }).click()

  await expect
    .poll(
      async () => {
        const projectsResponse = await page.request.get('http://127.0.0.1:8787/api/projects')
        const { projects } = (await projectsResponse.json()) as { projects: Array<{ title: string; artifacts: { renderResult: { mp4Path: string } | null; metadataPath: string | null } }> }
        const project = projects.find((candidate) => candidate.title === title)
        return Boolean(project?.artifacts.renderResult?.mp4Path && project.artifacts.metadataPath)
      },
      { timeout: 60_000 },
    )
    .toBe(true)

  const projectsResponse = await page.request.get('http://127.0.0.1:8787/api/projects')
  const { projects } = (await projectsResponse.json()) as { projects: Array<{ title: string; artifacts: { renderResult: { mp4Path: string } | null } }> }
  const mp4Path = projects.find((project) => project.title === title)?.artifacts.renderResult?.mp4Path
  expect(mp4Path).toBeTruthy()
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', mp4Path!])
  expect(stdout.trim()).toBe('audio')

  await page.getByLabel('On-screen text is readable').check()
  await page.getByRole('button', { name: 'Approve review' }).click()
  await expect(page.getByText('Reviewed')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Media Library' })).toBeVisible()
})
