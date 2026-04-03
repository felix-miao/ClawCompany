type SafeParseSuccess<T> = { success: true; data: T }
type SafeParseFailure = { success: false; error: string }
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure

export function extractJSONObject(text: string): Record<string, unknown> | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue

    let depth = 0
    let inString = false
    let escape = false

    for (let j = i; j < text.length; j++) {
      const ch = text[j]

      if (escape) {
        escape = false
        continue
      }

      if (ch === '\\' && inString) {
        escape = true
        continue
      }

      if (ch === '"') {
        inString = !inString
        continue
      }

      if (inString) continue

      if (ch === '{') depth++
      else if (ch === '}') depth--

      if (depth === 0) {
        try {
          return JSON.parse(text.slice(i, j + 1)) as Record<string, unknown>
        } catch {
          break
        }
      }
    }
  }
  return null
}

export function extractJSONArray(text: string): unknown[] | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '[') continue

    if (i > 0 && /[a-zA-Z0-9_]/.test(text[i - 1])) continue

    let depth = 0
    let inString = false
    let escape = false

    for (let j = i; j < text.length; j++) {
      const ch = text[j]

      if (escape) {
        escape = false
        continue
      }

      if (ch === '\\' && inString) {
        escape = true
        continue
      }

      if (ch === '"') {
        inString = !inString
        continue
      }

      if (inString) continue

      if (ch === '[') depth++
      else if (ch === ']') depth--

      if (depth === 0) {
        try {
          return JSON.parse(text.slice(i, j + 1)) as unknown[]
        } catch {
          break
        }
      }
    }
  }
  return null
}

export function extractJSON(text: string): unknown {
  const obj = extractJSONObject(text)
  if (obj !== null) return obj

  const arr = extractJSONArray(text)
  if (arr !== null) return arr

  return null
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
