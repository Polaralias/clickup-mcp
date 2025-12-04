import { describe, expect, it } from "vitest"

import { ListSpacesInput, CreateSpaceTagInput } from "../hierarchy.js"
import {
  CreateTaskInput,
  CreateSubtaskInput,
  DeleteTasksBulkInput,
  SearchTasksInput,
  CommentTaskInput
} from "../task.js"
import { GetDocumentInput } from "../docs.js"
import { CreateListInput } from "../structure.js"
import { StartTimerInput, ReportTimeForContainerInput } from "../time.js"

describe("schema ID coercion", () => {
  it("accepts numeric hierarchy identifiers", () => {
    const spaces = ListSpacesInput.parse({ workspaceId: 123 })
    expect(spaces.workspaceId).toBe("123")

    const tag = CreateSpaceTagInput.parse({
      spaceId: 456,
      name: "tag"
    })
    expect(tag.spaceId).toBe("456")
  })

  it("accepts numeric task identifiers", () => {
    const createTask = CreateTaskInput.parse({
      listId: 789,
      name: "Test task",
      assigneeIds: [1011]
    })
    expect(createTask.listId).toBe("789")
    expect(createTask.assigneeIds?.[0]).toBe("1011")

    const createSubtask = CreateSubtaskInput.parse({
      listId: 555,
      parentTaskId: 777,
      name: "Child"
    })
    expect(createSubtask.parentTaskId).toBe("777")
    expect(createSubtask.listId).toBe("555")

    const bulkDelete = DeleteTasksBulkInput.parse({
      teamId: 1,
      tasks: [{ taskId: 2 }]
    })
    expect(bulkDelete.teamId).toBe("1")
    expect(bulkDelete.tasks[0].taskId).toBe("2")

    const search = SearchTasksInput.parse({ listIds: [3], tagIds: ["backend"] })
    expect(search.listIds?.[0]).toBe("3")
    expect(search.tagIds?.[0]).toBe("backend")

    const comment = CommentTaskInput.parse({ taskId: 5, comment: "Hi" })
    expect(comment.taskId).toBe("5")
  })

  it("accepts numeric document identifiers", () => {
    const document = GetDocumentInput.parse({
      docId: 321,
      includePages: false,
      pageIds: [654]
    })
    expect(document.docId).toBe("321")
    expect(document.pageIds?.[0]).toBe("654")
  })

  it("accepts numeric structure identifiers", () => {
    const list = CreateListInput.parse({ spaceId: 777, name: "List" })
    expect(list.spaceId).toBe("777")
  })

  it("accepts numeric time tracking identifiers", () => {
    const timer = StartTimerInput.parse({ taskId: 888 })
    expect(timer.taskId).toBe("888")

    const report = ReportTimeForContainerInput.parse({ containerId: 999 })
    expect(report.containerId).toBe("999")
  })
})
