import { expect, test } from '@playwright/test'

test('turns one idea into a reviewed video in test mode', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Create HyperFrames source with Codex' }).click()
  await expect(page.getByText('HyperFrames source ready')).toBeVisible()

  await page.getByRole('button', { name: 'Render MP4' }).click()
  await expect(page.getByText('MP4 rendered')).toBeVisible()

  await page.getByRole('button', { name: 'Create thumbnail' }).click()
  await page.getByRole('button', { name: 'Write metadata JSON' }).click()
  await expect(page.getByText('Metadata ready')).toBeVisible()

  await page.getByRole('button', { name: 'Approve review checklist' }).click()
  await expect(page.getByText('Reviewed')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Media Library' })).toBeVisible()
})
