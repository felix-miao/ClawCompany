import { Task } from '../core/types'

export class DependencyError extends Error {
  readonly cycles: string[][]
  readonly missingDeps: string[]

  constructor(cycles: string[][], missingDeps: string[]) {
    const parts: string[] = []
    if (cycles.length > 0) {
      parts.push(`Circular dependencies: ${cycles.map((c) => c.join(' → ')).join('; ')}`)
    }
    if (missingDeps.length > 0) {
      parts.push(`Missing dependencies: ${missingDeps.join(', ')}`)
    }
    super(parts.join('. '))
    this.name = 'DependencyError'
    this.cycles = cycles
    this.missingDeps = missingDeps
  }
}

export function detectCircularDependencies(tasks: Task[]): string[][] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const cycles: string[][] = []

  function dfs(taskId: string, path: string[]): void {
    if (inStack.has(taskId)) {
      const cycleStart = path.indexOf(taskId)
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), taskId])
      }
      return
    }
    if (visited.has(taskId)) return

    visited.add(taskId)
    inStack.add(taskId)
    path.push(taskId)

    const task = taskMap.get(taskId)
    if (task) {
      for (const dep of task.dependencies) {
        if (taskMap.has(dep)) {
          dfs(dep, path)
        }
      }
    }

    path.pop()
    inStack.delete(taskId)
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, [])
    }
  }

  return cycles
}

export function resolveTaskOrder(tasks: Task[]): Task[] {
  if (tasks.length === 0) return []

  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  const missingDeps: string[] = []
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskMap.has(dep)) {
        missingDeps.push(dep)
      }
    }
  }

  const cycles = detectCircularDependencies(tasks)

  if (missingDeps.length > 0 || cycles.length > 0) {
    throw new DependencyError(cycles, [...new Set(missingDeps)])
  }

  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const task of tasks) {
    inDegree.set(task.id, 0)
    adjList.set(task.id, [])
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      adjList.get(dep)!.push(task.id)
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1)
    }
  }

  const queue: string[] = []
  const originalIndex = new Map(tasks.map((t, i) => [t.id, i]))

  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id)
    }
  }
  queue.sort((a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0))

  const sorted: Task[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(taskMap.get(current)!)

    const neighbors = adjList.get(current) || []
    neighbors.sort((a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0))
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
        queue.sort((a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0))
      }
    }
  }

  return sorted
}
