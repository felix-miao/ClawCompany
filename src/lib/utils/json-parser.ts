type SafeParseSuccess<T> = { success: true; data: T }
type SafeParseFailure = { success: false; error: string }
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure

interface ParseOptions {
  openingChar: '{' | '['
  closingChar: '}' | ']'
  skipPrevCharCheck?: boolean
}

function escapeContentForDoubleQuotes(content: string): string {
  let result = ''
  let i = 0
  while (i < content.length) {
    if (content[i] === '\\' && i + 1 < content.length) {
      result += content[i] + content[i + 1]
      i += 2
    } else if (content[i] === '"') {
      result += '\\"'
      i++
    } else {
      result += content[i]
      i++
    }
  }
  return result
}

function removeComments(text: string): string {
  let result = ''
  let i = 0
  let inString: '"' | "'" | null = null
  let escape = false

  while (i < text.length) {
    const ch = text[i]

    if (escape) {
      result += ch
      escape = false
      i++
      continue
    }

    if (inString) {
      result += ch
      if (ch === '\\') escape = true
      else if (ch === inString) inString = null
      i++
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = ch
      result += ch
      i++
      continue
    }

    if (ch === '/' && i + 1 < text.length) {
      if (text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++
        continue
      }
      if (text[i + 1] === '*') {
        i += 2
        while (i < text.length && !(text[i] === '*' && i + 1 < text.length && text[i + 1] === '/')) i++
        i += 2
        continue
      }
    }

    result += ch
    i++
  }

  return result
}

function convertSingleQuotes(text: string): string {
  let result = ''
  let i = 0
  let inDoubleString = false
  let doubleEscape = false

  while (i < text.length) {
    const ch = text[i]

    if (doubleEscape) {
      result += ch
      doubleEscape = false
      i++
      continue
    }

    if (inDoubleString) {
      result += ch
      if (ch === '\\') doubleEscape = true
      else if (ch === '"') inDoubleString = false
      i++
      continue
    }

    if (ch === '"') {
      inDoubleString = true
      result += ch
      i++
      continue
    }

    if (ch === "'") {
      i++
      let content = ''
      let strEscape = false
      while (i < text.length) {
        const c = text[i]
        if (strEscape) {
          if (c === "'") {
            content += "'"
          } else {
            content += '\\' + c
          }
          strEscape = false
          i++
          continue
        }
        if (c === '\\') {
          strEscape = true
          i++
          continue
        }
        if (c === "'") {
          i++
          break
        }
        content += c
        i++
      }
      result += '"' + escapeContentForDoubleQuotes(content) + '"'
      continue
    }

    result += ch
    i++
  }

  return result
}

function convertUndefinedToNull(text: string): string {
  let result = ''
  let i = 0
  let inString = false
  let escape = false

  while (i < text.length) {
    const ch = text[i]

    if (escape) {
      result += ch
      escape = false
      i++
      continue
    }

    if (inString) {
      result += ch
      if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      i++
      continue
    }

    if (ch === '"') {
      inString = true
      result += ch
      i++
      continue
    }

    if (text.slice(i, i + 9) === 'undefined') {
      const prevOk = i === 0 || !/[a-zA-Z0-9_]/.test(text[i - 1])
      const nextOk = i + 9 >= text.length || !/[a-zA-Z0-9_]/.test(text[i + 9])
      if (prevOk && nextOk) {
        result += 'null'
        i += 9
        continue
      }
    }

    result += ch
    i++
  }

  return result
}

function quoteUnquotedKeys(text: string): string {
  let result = ''
  let i = 0
  let inString = false
  let escape = false

  while (i < text.length) {
    const ch = text[i]

    if (escape) {
      result += ch
      escape = false
      i++
      continue
    }

    if (inString) {
      result += ch
      if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      i++
      continue
    }

    if (ch === '"') {
      inString = true
      result += ch
      i++
      continue
    }

    if (ch === '{' || ch === ',') {
      result += ch
      i++
      while (i < text.length && /\s/.test(text[i])) {
        result += text[i]
        i++
      }
      if (i < text.length && text[i] === '"') continue
      if (i < text.length && (text[i] === '}' || text[i] === ']')) continue
      if (i < text.length && /[a-zA-Z_]/.test(text[i])) {
        let key = ''
        while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
          key += text[i]
          i++
        }
        let afterKey = ''
        while (i < text.length && /\s/.test(text[i])) {
          afterKey += text[i]
          i++
        }
        if (i < text.length && text[i] === ':') {
          result += '"' + key + '"' + afterKey + ':'
          i++
          continue
        }
        result += key + afterKey
        continue
      }
      continue
    }

    result += ch
    i++
  }

  return result
}

function removeTrailingCommas(text: string): string {
  let result = ''
  let i = 0
  let inString = false
  let escape = false

  while (i < text.length) {
    const ch = text[i]

    if (escape) {
      result += ch
      escape = false
      i++
      continue
    }

    if (inString) {
      result += ch
      if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      i++
      continue
    }

    if (ch === '"') {
      inString = true
      result += ch
      i++
      continue
    }

    if (ch === ',') {
      let look = i + 1
      while (look < text.length && /\s/.test(text[look])) look++
      if (look < text.length && (text[look] === '}' || text[look] === ']')) {
        i++
        continue
      }
    }

    result += ch
    i++
  }

  return result
}

export function sanitizeJSON(text: string): string {
  let result = text
  result = removeComments(result)
  result = convertSingleQuotes(result)
  result = convertUndefinedToNull(result)
  result = quoteUnquotedKeys(result)
  result = removeTrailingCommas(result)
  return result
}

function parseJSONStructure(text: string, options: ParseOptions): unknown | null {
  const { openingChar, closingChar, skipPrevCharCheck = false } = options

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== openingChar) continue

    if (!skipPrevCharCheck && i > 0 && /[a-zA-Z0-9_]/.test(text[i - 1])) continue

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

      if (ch === openingChar) depth++
      else if (ch === closingChar) depth--

      if (depth === 0) {
        const raw = text.slice(i, j + 1)
        try {
          return JSON.parse(raw)
        } catch {
          // pass
        }
        try {
          return JSON.parse(sanitizeJSON(raw))
        } catch {
          break
        }
      }
    }
  }
  return null
}

export function extractJSONObject(text: string): Record<string, unknown> | null {
  const result = parseJSONStructure(text, {
    openingChar: '{',
    closingChar: '}'
  })
  return result as Record<string, unknown> | null
}

export function extractJSONArray(text: string): unknown[] | null {
  const result = parseJSONStructure(text, {
    openingChar: '[',
    closingChar: ']'
  })
  return (result as unknown[] | null)
}

export function extractJSON(text: string): Record<string, unknown> | unknown[] | null {
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
  } catch {
    // pass
  }
  try {
    return { success: true, data: JSON.parse(sanitizeJSON(json)) as T }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    const prefix = context ? `${context}: ` : ''
    return { success: false, error: `${prefix}Failed to parse JSON: ${detail}` }
  }
}
