import Fuse from "fuse.js"
import type { IFuseOptions } from "fuse.js"
import type { TaskResolutionRecord } from "../usecases/tasks/resolveTaskReference.js"

type SearchResult = TaskResolutionRecord & { score: number }

const fuseOptions: IFuseOptions<TaskResolutionRecord> = {
  includeScore: true,
  threshold: 0.35,
  keys: [
    { name: "name", weight: 0.5 },
    { name: "description", weight: 0.3 },
    { name: "status", weight: 0.2 }
  ]
}

export class TaskSearchIndex {
  private fuse = new Fuse<TaskResolutionRecord>([], fuseOptions)
  private tasks = new Map<string, TaskResolutionRecord>()

  index(tasks: TaskResolutionRecord[]) {
    tasks.forEach((task) => {
      if (task.id) {
        this.tasks.set(task.id, task)
      }
    })
    this.fuse.setCollection(Array.from(this.tasks.values()))
  }

  search(query: string, limit: number): SearchResult[] {
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
