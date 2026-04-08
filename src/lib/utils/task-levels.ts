import { Task } from '../core/types'
import { resolveTaskGraph, DependencyError } from './task-resolver'

export function groupTasksByLevels(tasks: Task[]): string[][] {
  if (tasks.length === 0) return []

  try {
    return resolveTaskGraph(tasks).levels
  } catch (e) {
    if (e instanceof DependencyError) {
      const validIds = new Set(tasks.map((t) => t.id))
      const filtered = tasks.map((t) => ({
        ...t,
        dependencies: t.dependencies.filter((d) => validIds.has(d)),
      }))

      const visited = new Set<string>()
      const inStack = new Set<string>()

      function hasCycle(id: string): boolean {
        if (inStack.has(id)) return true
        if (visited.has(id)) return false
        visited.add(id)
        inStack.add(id)
        const task = filtered.find((t) => t.id === id)
        if (task) {
          for (const dep of task.dependencies) {
            if (hasCycle(dep)) return true
          }
        }
        inStack.delete(id)
        return false
      }

      const acyclic = filtered.filter((t) => !hasCycle(t.id))
      try {
        return resolveTaskGraph(acyclic).levels
      } catch {
        return []
      }
    }
    return []
  }
}
