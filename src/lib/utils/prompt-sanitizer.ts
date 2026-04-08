import type { Task } from '../core/types'

export function sanitizeUserInput(input: string): string {
  const sanitized = input
    .replace(/<\/?user_input\/?>/g, '')
  return `<user_input>\n${sanitized}\n</user_input>`
}

export function sanitizeTaskPrompt(task: Task): string {
  const sanitizedTitle = task.title.replace(/<\/?task_title>/g, '')
  const sanitizedDesc = task.description.replace(/<\/?task_description>/g, '')
  return `<task_input>
<task_title>${sanitizedTitle}</task_title>
<task_description>${sanitizedDesc}</task_description>
</task_input>`
}
