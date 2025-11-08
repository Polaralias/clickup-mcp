import Fuse from "fuse.js"
import type { IFuseOptions } from "fuse.js"

type TaskRecord = {
  id: string
  name: string
  description?: string
  status?: string
  updatedAt?: number
}

const fuseOptions: IFuseOptions<TaskRecord> = {
  includeScore: true,
  threshold: 0.35,
  keys: [
    { name: "name", weight: 0.5 },
    { name: "description", weight: 0.3 },
    { name: "status", weight: 0.2 }
  ]
}

export class TaskSearchIndex {
  private fuse = new Fuse<TaskRecord>([], fuseOptions)
  private tasks = new Map<string, TaskRecord>()

  index(tasks: TaskRecord[]) {
    tasks.forEach((task) => {
      this.tasks.set(task.id, task)
    })
    this.fuse.setCollection(Array.from(this.tasks.values()))
  }

  search(query: string, limit: number) {
    const results = this.fuse.search(query, { limit })
    return results.map((result) => ({
      ...result.item,
      score: result.score ?? 0
    }))
  }

  lookup(taskId: string) {
    return this.tasks.get(taskId)
  }
}
