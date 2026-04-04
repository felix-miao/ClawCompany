import { ParsedFileEntry, TaskStatus, AgentRole, TASK_STATUS_VALUES } from './types'

const AGENT_ROLES: readonly string[] = ['pm', 'dev', 'review']
const VALID_FILE_ACTIONS: readonly string[] = ['create', 'modify', 'delete']

export function safeParseJSON<T>(input: string): { success: true; data: T } | { success: false; error: SyntaxError } {
  try {
    const data: T = JSON.parse(input)
    return { success: true, data }
  } catch (e) {
    const error = e instanceof SyntaxError ? e : new SyntaxError(String(e))
    return { success: false, error }
  }
}

export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isNonNullObject(obj) && key in obj
}

export function assertTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUS_VALUES as readonly string[]).includes(value)
}

export function assertAgentRole(value: unknown): value is AgentRole {
  return typeof value === 'string' && AGENT_ROLES.includes(value)
}

export function parseFileEntries(input: unknown): ParsedFileEntry[] {
  if (!Array.isArray(input)) return []

  return input.reduce<ParsedFileEntry[]>((acc, item) => {
    if (!isNonNullObject(item)) return acc
    const path = hasProperty(item, 'path') && typeof item.path === 'string' ? item.path : null
    if (!path) return acc

    const content = hasProperty(item, 'content') && typeof item.content === 'string' ? item.content : ''
    const rawAction = hasProperty(item, 'action') && typeof item.action === 'string' ? item.action : 'create'
    const action = VALID_FILE_ACTIONS.includes(rawAction) ? rawAction as ParsedFileEntry['action'] : 'create'

    acc.push({ path, content, action })
    return acc
  }, [])
}
