import { expect, test } from '@playwright/test'

test('unit test harness runs', () => {
  expect({ runner: 'playwright' }).toEqual({ runner: 'playwright' })
})
