import { expect, test } from '@playwright/test'

test('loads the newest saved project after a browser refresh', async ({ page, request }) => {
  test.setTimeout(90_000)
  const title = `Refresh recovery short ${crypto.randomUUID()}`
  const created = await request.post('http://127.0.0.1:8787/api/projects', {
    data: {
      title,
      summary: 'Verify saved video projects are restored into the UI.',
      takeaway: 'A refresh should not hide local artifacts.',
      references: [],
    },
  })
  const { project } = (await created.json()) as { project: { id: string } }
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/codex/storyboard`)
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/codex/scene_plan`)
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/codex/narration`)
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/narration/audio`)
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/codex/source`)
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/render`)
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/thumbnail`)
  await request.post(`http://127.0.0.1:8787/api/projects/${project.id}/metadata`)

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Media Library' })).toBeVisible()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
})
