type SafeParseSuccess<T> = { success: true; data: T }
type SafeParseFailure = { success: false; error: string }
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure

export function extractJSONObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

export function safeJsonParse<T = unknown>(
  json: string,
  context?: string
): SafeParseResult<T> {
  try {
    return { success: true, data: JSON.parse(json) as T }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    const prefix = context ? `${context}: ` : ''
    return { success: false, error: `${prefix}Failed to parse JSON: ${detail}` }
  }
}
