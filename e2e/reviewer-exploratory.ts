import type { ConsoleMessage, Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

const IGNORED_CONSOLE_PATTERNS = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
]

const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g

export interface ReviewerPageMonitor {
  consoleErrors: string[]
  pageErrors: string[]
  stop: () => void
}

interface PlanItemFailure {
  title: string
  symptom: string
  reproduction: string
  expectation: string
  verification: string
}

export function startReviewerPageMonitor(page: Page): ReviewerPageMonitor {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== 'error') return

    const text = message.text()
    if (IGNORED_CONSOLE_PATTERNS.some(pattern => pattern.test(text))) return

    consoleErrors.push(text)
  }

  const onPageError = (error: Error) => {
    pageErrors.push(error.stack ?? error.message)
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  return {
    consoleErrors,
    pageErrors,
    stop: () => {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
    },
  }
}

export async function expectNoCriticalBrowserErrors(
  testInfo: TestInfo,
  monitor: ReviewerPageMonitor,
  failure: Omit<PlanItemFailure, 'symptom'>,
) {
  const errors = [
    ...monitor.consoleErrors.map(error => `console.error: ${error}`),
    ...monitor.pageErrors.map(error => `pageerror: ${error}`),
  ]

  if (errors.length === 0) return

  await failWithPlanItem(testInfo, {
    ...failure,
    symptom: `浏览器出现关键错误：${errors.join(' | ')}`,
  })
}

export async function expectPageLoaded(
  page: Page,
  testInfo: TestInfo,
  path: string,
  failure: Omit<PlanItemFailure, 'symptom'>,
) {
  const response = await page.goto(path)
  const status = response?.status() ?? null

  if (status !== null && status >= 400) {
    await failWithPlanItem(testInfo, {
      ...failure,
      symptom: `${path} 返回 HTTP ${status}`,
    })
  }

  await page.waitForLoadState('domcontentloaded')
  const body = page.locator('body')
  await expect(body).toBeVisible()

  const bodyText = (await body.innerText()).trim()
  if (bodyText.length === 0) {
    await failWithPlanItem(testInfo, {
      ...failure,
      symptom: `${path} body 文本为空，疑似白屏`,
    })
  }
}

export async function failWithPlanItem(testInfo: TestInfo, failure: PlanItemFailure): Promise<never> {
  const symptom = sanitizePlanItemText(failure.symptom)
  const message = [
    `Reviewer exploratory smoke failed: ${failure.title}`,
    '',
    'Suggested ClawCompanyPlan.md item:',
    `- [ ] #<next-id> ${failure.title} → 现象：${symptom}；复现：${failure.reproduction}；期望：${failure.expectation}；验证：${failure.verification}`,
  ].join('\n')

  await testInfo.attach('suggested-plan-item.txt', {
    body: message,
    contentType: 'text/plain',
  })

  throw new Error(message)
}

function sanitizePlanItemText(text: string): string {
  return text
    .replace(ANSI_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
}
