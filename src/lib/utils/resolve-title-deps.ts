import { Task } from '../core/types'

export function resolveTitleDependencies(tasks: Task[]): Task[] {
  if (tasks.length === 0) return []

  const titleToId = new Map<string, string>()
  const idSet = new Set<string>()

  for (const task of tasks) {
    idSet.add(task.id)
    if (!titleToId.has(task.title)) {
      titleToId.set(task.title, task.id)
    }
  }

  return tasks.map((task) => {
    const resolvedDeps = task.dependencies.map((dep) => {
      if (idSet.has(dep)) return dep

      const mappedId = titleToId.get(dep)
      if (mappedId) return mappedId

      return dep
    })

    return { ...task, dependencies: resolvedDeps }
  })
}
