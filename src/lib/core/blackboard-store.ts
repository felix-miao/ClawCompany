/**
 * BlackboardStore — persistent, concurrency-safe key-value store backed by a JSON file.
 *
 * Safety guarantees:
 *  - **File lock**: A promise-chain mutex serialises all write operations within
 *    this process so concurrent async callers never interleave writes.
 *  - **Atomic write**: content is written to a `.tmp` file then renamed into
 *    place so a crash mid-write never corrupts the target file.
 *
 * This is intentionally minimal — no dependencies beyond Node's built-in `fs`.
 */

import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

export interface BlackboardData {
  [key: string]: JsonValue
}

/** Maximum number of entries in a set-typed value before trimming the oldest half. */
const SET_MAX_SIZE = 1000

export class BlackboardStore {
  private filePath: string
  /** In-process mutex: all writes are chained onto this promise. */
  private writeLock: Promise<void> = Promise.resolve()

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath)
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async read(): Promise<BlackboardData> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as BlackboardData
    } catch {
      return {}
    }
  }

  async get<T extends JsonValue = JsonValue>(key: string): Promise<T | undefined> {
    const data = await this.read()
    return data[key] as T | undefined
  }

  // ─── Write (serialised + atomic) ──────────────────────────────────────────

  /**
   * Atomically update the blackboard.
   * The `updater` receives the current data and returns the new state.
   * All concurrent calls are queued and executed one-by-one.
   */
  update(updater: (current: BlackboardData) => BlackboardData): Promise<void> {
    // Chain onto the existing lock so writes are strictly sequential.
    this.writeLock = this.writeLock.then(() => this._atomicUpdate(updater))
    return this.writeLock
  }

  async set(key: string, value: JsonValue): Promise<void> {
    return this.update((current) => ({ ...current, [key]: value }))
  }

  async delete(key: string): Promise<void> {
    return this.update((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  // ─── Helpers for Set<string> stored as sorted arrays ──────────────────────

  async getSet(key: string): Promise<Set<string>> {
    const arr = await this.get<string[]>(key)
    return new Set(Array.isArray(arr) ? arr : [])
  }

  async addToSet(key: string, ...values: string[]): Promise<void> {
    return this.update((current) => {
      const existing = Array.isArray(current[key]) ? (current[key] as string[]) : []
      let next = Array.from(new Set([...existing, ...values])).sort()
      // P0-5: cap set size to prevent unbounded growth; keep the newest half.
      if (next.length > SET_MAX_SIZE) {
        next = next.slice(next.length - Math.ceil(SET_MAX_SIZE / 2))
      }
      return { ...current, [key]: next }
    })
  }

  async hasInSet(key: string, value: string): Promise<boolean> {
    const set = await this.getSet(key)
    return set.has(value)
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _atomicUpdate(updater: (current: BlackboardData) => BlackboardData): Promise<void> {
    // Ensure parent directory exists.
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })

    // Read current state.
    let current: BlackboardData
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      current = JSON.parse(raw) as BlackboardData
    } catch {
      current = {}
    }

    const next = updater(current)
    const serialised = JSON.stringify(next, null, 2)

    // Write to a temp file in the same directory, then rename (atomic on POSIX).
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    try {
      await fs.writeFile(tmpPath, serialised, 'utf-8')
      await fs.rename(tmpPath, this.filePath)
    } catch (err) {
      // Best-effort cleanup of the temp file.
      try { await fs.unlink(tmpPath) } catch { /* ignore */ }
      throw err
    }
  }
}

/**
 * Returns a BlackboardStore scoped to a given project.
 * Default location: ~/.clawcompany/blackboard/<projectId>.json
 */
export function createProjectBlackboard(projectId: string, dataDir?: string): BlackboardStore {
  const dir = dataDir ?? path.join(os.homedir(), '.clawcompany', 'blackboard')
  return new BlackboardStore(path.join(dir, `${projectId}.json`))
}
