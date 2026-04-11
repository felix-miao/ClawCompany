import type { Task } from '../core/types'

/**
 * Escapes XML special characters in user-supplied text so they cannot
 * break out of the enclosing XML tags and inject new structure.
 * Handles: & < > " '
 */
function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Strip prompt-injection trigger phrases that could hijack system behaviour.
 * We remove common patterns like "Ignore previous instructions",
 * "You are now", "New instruction:", etc.
 */
function stripInjectionPhrases(text: string): string {
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi,
    /you\s+are\s+now\s+/gi,
    /new\s+instructions?\s*:/gi,
    /system\s+prompt\s*:/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /###\s*instruction/gi,
    /###\s*system/gi,
  ]

  let sanitized = text
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]')
  }
  return sanitized
}

export function sanitizeUserInput(input: string): string {
  const stripped = stripInjectionPhrases(input)
  const escaped = escapeXML(stripped)
  return `<user_input>\n${escaped}\n</user_input>`
}

export function sanitizeTaskPrompt(task: Task): string {
  const sanitizedTitle = escapeXML(stripInjectionPhrases(task.title))
  const sanitizedDesc = escapeXML(stripInjectionPhrases(task.description))
  return `<task_input>
<task_title>${sanitizedTitle}</task_title>
<task_description>${sanitizedDesc}</task_description>
</task_input>`
}

/**
 * Sanitize PM analysis text before it is injected into dev-agent context.
 * PM output is LLM-generated but can still carry attacker-crafted payloads
 * if the original user request contained a prompt injection attempt.
 *
 * We only strip injection trigger phrases here (no XML escaping needed since
 * the analysis is inserted as plain text into the context, not inside XML tags).
 */
export function sanitizePMAnalysis(analysis: string): string {
  if (!analysis || typeof analysis !== 'string') return ''
  return stripInjectionPhrases(analysis)
}
