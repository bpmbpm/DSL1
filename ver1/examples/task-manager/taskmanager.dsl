// ============================================================================
// Task Manager Application - PL/SPARQL DSL
// File: taskmanager.dsl
//
// Demonstrates:
//   Multi-parameter FUNCTION definitions, optional FILTER patterns,
//   la-if for branching, la-forEach for iteration, SPARQL aggregates,
//   INSERT/DELETE for full CRUD operations, GENERATE_IRI, NOW().
// ============================================================================

PREFIX tm:  <https://github.com/bpmbpm/DSL1/ontology/taskmanager#>
PREFIX dsl: <https://github.com/bpmbpm/DSL1/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

USE GRAPH <taskmanager>

// ============================================================================
// FUNCTION getTasks
//
// Returns all tasks, optionally filtered by status key.
// Pass null or "" for statusFilter to return tasks in all statuses.
// ============================================================================
FUNCTION getTasks(statusFilter) {
  SELECT ?task ?title ?description ?statusLabel ?statusKey
         ?priorityLabel ?priorityKey ?priorityLevel
         ?assigneeName ?projectName ?dueDate ?createdDate WHERE {
    GRAPH <taskmanager> {
      ?task a tm:Task .
      ?task tm:taskTitle       ?title .
      ?task tm:hasStatus       ?status .
      ?task tm:hasPriority     ?priority .
      ?task tm:partOfProject   ?project .

      ?status   tm:statusLabel   ?statusLabel .
      ?status   tm:statusKey     ?statusKey .
      ?priority tm:priorityLabel ?priorityLabel .
      ?priority tm:priorityKey   ?priorityKey .
      ?priority tm:priorityLevel ?priorityLevel .
      ?project  tm:projectName   ?projectName .

      OPTIONAL { ?task tm:taskDescription ?description }
      OPTIONAL { ?task tm:dueDate         ?dueDate }
      OPTIONAL { ?task tm:createdDate     ?createdDate }
      OPTIONAL {
        ?task      tm:assignedTo  ?assignee .
        ?assignee  tm:personName  ?assigneeName .
      }

      // Apply status filter when provided
      FILTER (statusFilter === null || statusFilter === "" ||
              ?statusKey = statusFilter)
    }
  }
  ORDER BY ASC(?priorityLevel) ASC(?dueDate) ASC(?title)
}

// ============================================================================
// FUNCTION getProjects
//
// Lists all Project individuals with their task counts and completion stats.
// ============================================================================
FUNCTION getProjects() {
  SELECT ?project ?name ?description
         (COUNT(?task) AS ?totalTasks)
         (SUM(IF(?statusKey = "done", 1, 0)) AS ?doneTasks) WHERE {
    GRAPH <taskmanager> {
      ?project a tm:Project .
      ?project tm:projectName ?name .
      OPTIONAL { ?project tm:projectDescription ?description }
      OPTIONAL {
        ?task tm:partOfProject ?project .
        ?task tm:hasStatus     ?status .
        ?status tm:statusKey   ?statusKey .
      }
    }
  }
  GROUP BY ?project ?name ?description
  ORDER BY ASC(?name)
}

// ============================================================================
// FUNCTION getTasksByProject
//
// Returns all tasks belonging to a specific project, ordered by priority then
// due date.
// ============================================================================
FUNCTION getTasksByProject(projectId) {
  la-if (projectId === null || projectId === "") {
    return []
  }

  SELECT ?task ?title ?statusLabel ?statusKey
         ?priorityLabel ?priorityLevel ?assigneeName ?dueDate WHERE {
    GRAPH <taskmanager> {
      ?task tm:partOfProject   projectId .
      ?task tm:taskTitle       ?title .
      ?task tm:hasStatus       ?status .
      ?task tm:hasPriority     ?priority .

      ?status   tm:statusLabel   ?statusLabel .
      ?status   tm:statusKey     ?statusKey .
      ?priority tm:priorityLabel ?priorityLabel .
      ?priority tm:priorityLevel ?priorityLevel .

      OPTIONAL { ?task tm:dueDate      ?dueDate }
      OPTIONAL {
        ?task     tm:assignedTo  ?assignee .
        ?assignee tm:personName  ?assigneeName .
      }
    }
  }
  ORDER BY ASC(?priorityLevel) ASC(?dueDate)
}

// ============================================================================
// FUNCTION getPeople
//
// Returns all Person individuals for populating assignee dropdowns.
// ============================================================================
FUNCTION getPeople() {
  SELECT ?person ?name ?email WHERE {
    GRAPH <taskmanager> {
      ?person a tm:Person .
      ?person tm:personName ?name .
      OPTIONAL { ?person tm:personEmail ?email }
    }
  }
  ORDER BY ASC(?name)
}

// ============================================================================
// FUNCTION getStatuses
//
// Returns all Status individuals ordered by lifecycle sequence.
// Used to populate status filter dropdowns.
// ============================================================================
FUNCTION getStatuses() {
  SELECT ?status ?label ?key ?order WHERE {
    GRAPH <taskmanager> {
      ?status a tm:Status .
      ?status tm:statusLabel ?label .
      ?status tm:statusKey   ?key .
      ?status tm:statusOrder ?order .
    }
  }
  ORDER BY ASC(?order)
}

// ============================================================================
// FUNCTION getPriorities
//
// Returns all Priority individuals ordered by urgency level (high first).
// ============================================================================
FUNCTION getPriorities() {
  SELECT ?priority ?label ?key ?level WHERE {
    GRAPH <taskmanager> {
      ?priority a tm:Priority .
      ?priority tm:priorityLabel ?label .
      ?priority tm:priorityKey   ?key .
      ?priority tm:priorityLevel ?level .
    }
  }
  ORDER BY ASC(?level)
}

// ============================================================================
// FUNCTION createTask
//
// Inserts a new Task individual into the <taskmanager> graph.
// Returns the IRI of the newly created task.
//
// Required: title, projectId
// Optional: description, assigneeId, priorityKey (defaults to "medium"),
//           dueDate (xsd:date string)
// ============================================================================
FUNCTION createTask(title, description, projectId, assigneeId, priorityKey, dueDate) {

  // Validate required parameters
  la-if (title === null || title === "") {
    return "Error: Task title is required"
  }
  la-if (projectId === null || projectId === "") {
    return "Error: Project is required"
  }

  // Resolve priority IRI; default to medium
  let effectivePriorityKey = priorityKey === null ? "medium" : priorityKey
  let priorityRows = SELECT ?priority WHERE {
    GRAPH <taskmanager> {
      ?priority a tm:Priority .
      ?priority tm:priorityKey effectivePriorityKey .
    }
  }
  LIMIT 1

  la-if (priorityRows.length === 0) {
    return "Error: Unknown priority key: " + effectivePriorityKey
  }

  // Resolve default status (todo)
  let statusRows = SELECT ?status WHERE {
    GRAPH <taskmanager> {
      ?status a tm:Status .
      ?status tm:statusKey "todo" .
    }
  }
  LIMIT 1

  la-if (statusRows.length === 0) {
    return "Error: Status 'todo' not found in ontology"
  }

  let taskId     = GENERATE_IRI(tm:Task)
  let priorityId = priorityRows[0].priority
  let statusId   = statusRows[0].status
  let now        = NOW()

  INSERT INTO GRAPH <taskmanager> {
    taskId a tm:Task .
    taskId tm:taskTitle     title .
    taskId tm:hasStatus     statusId .
    taskId tm:hasPriority   priorityId .
    taskId tm:partOfProject projectId .
    taskId tm:createdDate   now .
  }

  // Insert optional description
  la-if (description !== null && description !== "") {
    INSERT INTO GRAPH <taskmanager> {
      taskId tm:taskDescription description .
    }
  }

  // Insert optional assignee
  la-if (assigneeId !== null && assigneeId !== "") {
    INSERT INTO GRAPH <taskmanager> {
      taskId tm:assignedTo assigneeId .
    }
  }

  // Insert optional due date
  la-if (dueDate !== null && dueDate !== "") {
    let dueDateTyped = CAST(dueDate, xsd:date)
    INSERT INTO GRAPH <taskmanager> {
      taskId tm:dueDate dueDateTyped .
    }
  }

  return taskId
}

// ============================================================================
// FUNCTION updateTaskStatus
//
// Transitions a Task to a new status.  If the new status is "done", also
// records the completedDate timestamp.
// ============================================================================
FUNCTION updateTaskStatus(taskId, newStatusKey) {

  la-if (taskId === null || taskId === "") {
    return "Error: taskId is required"
  }
  la-if (newStatusKey === null || newStatusKey === "") {
    return "Error: newStatusKey is required"
  }

  // Resolve the new status IRI
  let statusRows = SELECT ?newStatus WHERE {
    GRAPH <taskmanager> {
      ?newStatus a tm:Status .
      ?newStatus tm:statusKey newStatusKey .
    }
  }
  LIMIT 1

  la-if (statusRows.length === 0) {
    return "Error: Unknown status key: " + newStatusKey
  }

  let newStatusId = statusRows[0].newStatus

  // Remove old status triple
  DELETE FROM GRAPH <taskmanager> {
    taskId tm:hasStatus ?oldStatus .
  }
  WHERE {
    GRAPH <taskmanager> {
      taskId tm:hasStatus ?oldStatus .
    }
  }

  // Insert new status triple
  INSERT INTO GRAPH <taskmanager> {
    taskId tm:hasStatus newStatusId .
  }

  // Record completion time when status transitions to done
  la-if (newStatusKey === "done") {
    let now = NOW()

    // Remove any existing completedDate before inserting
    DELETE FROM GRAPH <taskmanager> {
      taskId tm:completedDate ?oldDate .
    }
    WHERE {
      GRAPH <taskmanager> {
        OPTIONAL { taskId tm:completedDate ?oldDate }
      }
    }

    INSERT INTO GRAPH <taskmanager> {
      taskId tm:completedDate now .
    }
  }

  return taskId
}

// ============================================================================
// FUNCTION updateTask
//
// Updates mutable fields on an existing Task: title, description, assignee,
// priority, dueDate.  Pass null for fields that should remain unchanged.
// ============================================================================
FUNCTION updateTask(taskId, title, description, assigneeId, priorityKey, dueDate) {

  la-if (taskId === null || taskId === "") {
    return "Error: taskId is required"
  }

  // Update title
  la-if (title !== null && title !== "") {
    DELETE FROM GRAPH <taskmanager> {
      taskId tm:taskTitle ?old .
    }
    WHERE { GRAPH <taskmanager> { taskId tm:taskTitle ?old } }

    INSERT INTO GRAPH <taskmanager> {
      taskId tm:taskTitle title .
    }
  }

  // Update description
  la-if (description !== null) {
    DELETE FROM GRAPH <taskmanager> {
      taskId tm:taskDescription ?old .
    }
    WHERE { GRAPH <taskmanager> { OPTIONAL { taskId tm:taskDescription ?old } } }

    la-if (description !== "") {
      INSERT INTO GRAPH <taskmanager> {
        taskId tm:taskDescription description .
      }
    }
  }

  // Update assignee
  la-if (assigneeId !== null) {
    DELETE FROM GRAPH <taskmanager> {
      taskId tm:assignedTo ?old .
    }
    WHERE { GRAPH <taskmanager> { OPTIONAL { taskId tm:assignedTo ?old } } }

    la-if (assigneeId !== "") {
      INSERT INTO GRAPH <taskmanager> {
        taskId tm:assignedTo assigneeId .
      }
    }
  }

  // Update priority
  la-if (priorityKey !== null && priorityKey !== "") {
    let priorityRows = SELECT ?newPriority WHERE {
      GRAPH <taskmanager> {
        ?newPriority a tm:Priority .
        ?newPriority tm:priorityKey priorityKey .
      }
    }
    LIMIT 1

    la-if (priorityRows.length > 0) {
      DELETE FROM GRAPH <taskmanager> {
        taskId tm:hasPriority ?old .
      }
      WHERE { GRAPH <taskmanager> { taskId tm:hasPriority ?old } }

      INSERT INTO GRAPH <taskmanager> {
        taskId tm:hasPriority priorityRows[0].newPriority .
      }
    }
  }

  // Update due date
  la-if (dueDate !== null) {
    DELETE FROM GRAPH <taskmanager> {
      taskId tm:dueDate ?old .
    }
    WHERE { GRAPH <taskmanager> { OPTIONAL { taskId tm:dueDate ?old } } }

    la-if (dueDate !== "") {
      let dueDateTyped = CAST(dueDate, xsd:date)
      INSERT INTO GRAPH <taskmanager> {
        taskId tm:dueDate dueDateTyped .
      }
    }
  }

  return taskId
}

// ============================================================================
// FUNCTION deleteTask
//
// Removes all triples about a Task from the <taskmanager> graph.
// ============================================================================
FUNCTION deleteTask(taskId) {
  la-if (taskId === null || taskId === "") {
    return "Error: taskId is required"
  }

  DELETE FROM GRAPH <taskmanager> {
    taskId ?p ?o .
  }
  WHERE {
    GRAPH <taskmanager> {
      taskId ?p ?o .
    }
  }

  return true
}

// ============================================================================
// FUNCTION getTaskSummaryByStatus
//
// Returns aggregated task counts grouped by status, useful for a Kanban-style
// summary header.
// ============================================================================
FUNCTION getTaskSummaryByStatus() {
  SELECT ?statusLabel ?statusKey ?statusOrder (COUNT(?task) AS ?count) WHERE {
    GRAPH <taskmanager> {
      ?status tm:statusLabel ?statusLabel .
      ?status tm:statusKey   ?statusKey .
      ?status tm:statusOrder ?statusOrder .
      OPTIONAL {
        ?task tm:hasStatus ?status .
        ?task a tm:Task .
      }
    }
  }
  GROUP BY ?statusLabel ?statusKey ?statusOrder
  ORDER BY ASC(?statusOrder)
}

// ============================================================================
// FUNCTION getOverdueTasks
//
// Returns tasks whose dueDate is before today and status is not "done".
// Uses the built-in NOW() function to compute today's date at query time.
// ============================================================================
FUNCTION getOverdueTasks() {
  let today = DATE(NOW())

  SELECT ?task ?title ?dueDate ?statusLabel ?priorityLabel ?assigneeName WHERE {
    GRAPH <taskmanager> {
      ?task a tm:Task .
      ?task tm:taskTitle   ?title .
      ?task tm:dueDate     ?dueDate .
      ?task tm:hasStatus   ?status .
      ?task tm:hasPriority ?priority .

      ?status   tm:statusKey     ?statusKey .
      ?status   tm:statusLabel   ?statusLabel .
      ?priority tm:priorityLabel ?priorityLabel .
      ?priority tm:priorityLevel ?priorityLevel .

      FILTER (?dueDate < today && ?statusKey != "done")

      OPTIONAL {
        ?task     tm:assignedTo  ?assignee .
        ?assignee tm:personName  ?assigneeName .
      }
    }
  }
  ORDER BY ASC(?dueDate) ASC(?priorityLevel)
}
