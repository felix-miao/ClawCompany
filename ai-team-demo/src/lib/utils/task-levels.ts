import { Task } from '../core/types'

export function groupTasksByLevels(tasks: Task[]): string[][] {
  if (tasks.length === 0) return []

  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const task of tasks) {
    inDegree.set(task.id, 0)
    adjList.set(task.id, [])
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskMap.has(dep)) continue
      adjList.get(dep)!.push(task.id)
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1)
    }
  }

  const levels: string[][] = []
  let currentLevel: string[] = []

  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      currentLevel.push(id)
    }
  }

  while (currentLevel.length > 0) {
    levels.push(currentLevel)

    const nextLevel: string[] = []
    for (const id of currentLevel) {
      const neighbors = adjList.get(id) || []
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          nextLevel.push(neighbor)
        }
      }
    }

    currentLevel = nextLevel
  }

  return levels
}
