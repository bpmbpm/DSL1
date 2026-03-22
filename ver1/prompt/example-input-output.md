# DSL1 — Input → Output Examples

Each example shows a plain-text user description followed by the complete three-part
DSL1 output: ontology, PL/SPARQL functions, and UI DSL windows.

---

## Example 1: Book Library Manager

### User Input

> "I need an app to manage my book library. I want to store books with their title, author,
> publication year, and ISBN. Books belong to one or more categories (e.g. Fiction, Science).
> I need to add, edit, and delete books, browse the full list, and search by title or author."

---

### Ontology (`book-library.ttl`)

```turtle
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix :        <https://dsl1.example.org/book-library#> .

<https://dsl1.example.org/book-library>
    a owl:Ontology ;
    rdfs:label   "Book Library Ontology"@en ;
    rdfs:comment "Models a personal book library with categories."@en ;
    owl:versionInfo "1.0.0"^^xsd:string .

# --- Classes ---

:Book a owl:Class ;
    rdfs:label   "Book"@en ;
    rdfs:comment "A physical or digital book in the library."@en .

:Category a owl:Class ;
    rdfs:label   "Category"@en ;
    rdfs:comment "A genre or subject classification for books."@en .

# --- Datatype Properties ---

:bookId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:label  "book identifier"@en ;
    rdfs:domain :Book ;
    rdfs:range  xsd:string .

:title a owl:DatatypeProperty ;
    rdfs:label  "title"@en ;
    rdfs:domain :Book ;
    rdfs:range  xsd:string .

:author a owl:DatatypeProperty ;
    rdfs:label  "author"@en ;
    rdfs:domain :Book ;
    rdfs:range  xsd:string .

:publicationYear a owl:DatatypeProperty ;
    rdfs:label  "publication year"@en ;
    rdfs:domain :Book ;
    rdfs:range  xsd:integer .

:isbn a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:label  "ISBN"@en ;
    rdfs:domain :Book ;
    rdfs:range  xsd:string .

:categoryId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:label  "category identifier"@en ;
    rdfs:domain :Category ;
    rdfs:range  xsd:string .

:categoryName a owl:DatatypeProperty ;
    rdfs:label  "category name"@en ;
    rdfs:domain :Category ;
    rdfs:range  xsd:string .

# --- Object Properties ---

:inCategory a owl:ObjectProperty ;
    rdfs:label  "in category"@en ;
    rdfs:domain :Book ;
    rdfs:range  :Category .

:hasBook a owl:ObjectProperty ;
    rdfs:label    "has book"@en ;
    rdfs:domain   :Category ;
    rdfs:range    :Book ;
    owl:inverseOf :inCategory .

# --- Seed Individuals (default categories) ---

:cat-fiction a :Category ;
    rdfs:label    "Fiction"@en ;
    :categoryId   "cat-fiction"^^xsd:string ;
    :categoryName "Fiction"^^xsd:string .

:cat-science a :Category ;
    rdfs:label    "Science"@en ;
    :categoryId   "cat-science"^^xsd:string ;
    :categoryName "Science"^^xsd:string .

:cat-history a :Category ;
    rdfs:label    "History"@en ;
    :categoryId   "cat-history"^^xsd:string ;
    :categoryName "History"^^xsd:string .

:cat-technology a :Category ;
    rdfs:label    "Technology"@en ;
    :categoryId   "cat-technology"^^xsd:string ;
    :categoryName "Technology"^^xsd:string .
```

---

### PL/SPARQL Functions

```sparql
# -------------------------------------------------------
# Utility: the default data graph URI
# -------------------------------------------------------
const ?GRAPH = <https://dsl1.example.org/data/book-library/default>

# -------------------------------------------------------
# FUNCTION: listBooks — retrieve all books ordered by title
# -------------------------------------------------------
FUNCTION :listBooks() {
    SELECT ?book ?bookId ?title ?author ?publicationYear ?isbn WHERE {
        GRAPH <https://dsl1.example.org/data/book-library/default> {
            ?book a :Book ;
                  :bookId          ?bookId ;
                  :title           ?title ;
                  :author          ?author .
            OPTIONAL { ?book :publicationYear ?publicationYear . }
            OPTIONAL { ?book :isbn            ?isbn . }
        }
    }
    ORDER BY ASC(?title)
    return ?book
}

# -------------------------------------------------------
# FUNCTION: searchBooks — search by title or author substring
# -------------------------------------------------------
FUNCTION :searchBooks(?term) {
    SELECT ?book ?bookId ?title ?author ?publicationYear WHERE {
        GRAPH <https://dsl1.example.org/data/book-library/default> {
            ?book a :Book ;
                  :bookId  ?bookId ;
                  :title   ?title ;
                  :author  ?author .
            OPTIONAL { ?book :publicationYear ?publicationYear . }
        }
        FILTER(
            CONTAINS(LCASE(?title),  LCASE(?term)) ||
            CONTAINS(LCASE(?author), LCASE(?term))
        )
    }
    ORDER BY ASC(?title)
    return ?book
}

# -------------------------------------------------------
# FUNCTION: getBook — fetch a single book by ID
# -------------------------------------------------------
FUNCTION :getBook(?bookId) {
    SELECT ?book ?title ?author ?publicationYear ?isbn WHERE {
        GRAPH <https://dsl1.example.org/data/book-library/default> {
            ?book a :Book ; :bookId ?bookId ; :title ?title ; :author ?author .
            OPTIONAL { ?book :publicationYear ?publicationYear . }
            OPTIONAL { ?book :isbn ?isbn . }
        }
    }
    la-if (BOUND(?book)) {
        return ?book
    } la-else {
        return "ERROR:NOT_FOUND"
    }
}

# -------------------------------------------------------
# FUNCTION: listCategories — all category options for dropdown
# -------------------------------------------------------
FUNCTION :listCategories() {
    SELECT ?cat ?categoryId ?categoryName WHERE {
        GRAPH <https://dsl1.example.org/data/book-library/default> {
            ?cat a :Category ; :categoryId ?categoryId ; :categoryName ?categoryName .
        }
    }
    ORDER BY ASC(?categoryName)
    return ?cat
}

# -------------------------------------------------------
# FUNCTION: createBook — insert a new Book individual
# -------------------------------------------------------
FUNCTION :createBook(?title, ?author, ?publicationYear, ?isbn, ?categoryId) {
    la-if (STRLEN(?title) = 0) {
        return "ERROR:TITLE_REQUIRED"
    } la-else {
        la-if (STRLEN(?author) = 0) {
            return "ERROR:AUTHOR_REQUIRED"
        } la-else {
            const ?newId = STRUUID()
            INSERT DATA {
                GRAPH <https://dsl1.example.org/data/book-library/default> {
                    :newId a :Book ;
                           :bookId          ?newId ;
                           :title           ?title ;
                           :author          ?author ;
                           :publicationYear ?publicationYear ;
                           :isbn            ?isbn ;
                           :inCategory      ?categoryId .
                }
            }
            return ?newId
        }
    }
}

# -------------------------------------------------------
# FUNCTION: updateBook — replace mutable fields for an existing book
# -------------------------------------------------------
FUNCTION :updateBook(?bookId, ?title, ?author, ?publicationYear, ?isbn) {
    DELETE {
        GRAPH <https://dsl1.example.org/data/book-library/default> {
            ?book :title ?oldTitle ; :author ?oldAuthor ;
                  :publicationYear ?oldYear ; :isbn ?oldIsbn .
        }
    }
    INSERT {
        GRAPH <https://dsl1.example.org/data/book-library/default> {
            ?book :title ?title ; :author ?author ;
                  :publicationYear ?publicationYear ; :isbn ?isbn .
        }
    }
    WHERE {
        GRAPH <https://dsl1.example.org/data/book-library/default> {
            ?book :bookId ?bookId ; :title ?oldTitle ; :author ?oldAuthor .
            OPTIONAL { ?book :publicationYear ?oldYear . }
            OPTIONAL { ?book :isbn ?oldIsbn . }
        }
    }
    return ""
}

# -------------------------------------------------------
# FUNCTION: deleteBook — remove all triples for a book
# -------------------------------------------------------
FUNCTION :deleteBook(?bookId) {
    DELETE { GRAPH <https://dsl1.example.org/data/book-library/default> { ?book ?p ?o . } }
    WHERE  { GRAPH <https://dsl1.example.org/data/book-library/default> {
        ?book :bookId ?bookId . ?book ?p ?o .
    }}
    return ""
}
```

---

### UI DSL

```
WINDOW :bookListWindow {
    title: "My Book Library"
    layout: vertical
    STATE ?searchTerm   = ""
    STATE ?selectedBook = null
    STATE ?showAddModal = false

    WIDGET nav :mainNav {
        items: [
            { label: "Library" ; target: :bookListWindow }
            { label: "Add Book" ; target: :addBookWindow }
        ]
    }

    WIDGET input :searchInput {
        placeholder: "Search by title or author…"
        bind-value: ?searchTerm
        on-change: :searchBooks(?searchTerm)
    }

    WIDGET table :bookTable {
        bind-items: :searchBooks(?searchTerm)
        columns: [?title, ?author, ?publicationYear, ?isbn]
        on-row-click: :handleRowClick(?row)
    }

    WIDGET panel :detailPanel {
        layout: vertical
        bind-visible: ?selectedBook
        WIDGET label :dTitle  { bind-text: ?selectedBook.title }
        WIDGET label :dAuthor { bind-text: ?selectedBook.author }
        WIDGET label :dYear   { bind-text: ?selectedBook.publicationYear }
        WIDGET label :dIsbn   { bind-text: ?selectedBook.isbn }
        WIDGET button :editBtn   { text: "Edit"   ; on-click: :openEditWindow(?selectedBook.bookId) }
        WIDGET button :deleteBtn { text: "Delete" ; on-click: :deleteBook(?selectedBook.bookId) }
    }
}

WINDOW :addBookWindow {
    title: "Add New Book"
    layout: vertical
    STATE ?title           = ""
    STATE ?author          = ""
    STATE ?publicationYear = ""
    STATE ?isbn            = ""
    STATE ?selectedCat     = null
    STATE ?errorMsg        = ""

    WIDGET form :addBookForm {
        on-submit: :createBook(?title, ?author, ?publicationYear, ?isbn, ?selectedCat.categoryId)
        WIDGET input    :titleInput  { placeholder: "Title *"            ; bind-value: ?title }
        WIDGET input    :authorInput { placeholder: "Author *"           ; bind-value: ?author }
        WIDGET number   :yearInput   { bind-value: ?publicationYear ; min: 1000 ; max: 2100 }
        WIDGET input    :isbnInput   { placeholder: "ISBN (optional)"    ; bind-value: ?isbn }
        WIDGET dropdown :catSelect   {
            bind-items:    :listCategories()
            bind-selected: ?selectedCat
            display-field: ?item.categoryName
            value-field:   ?item.categoryId
        }
        WIDGET label  :errorLabel { bind-text: ?errorMsg }
        WIDGET button :submitBtn  { text: "Save Book" ; on-click: submit }
        WIDGET button :cancelBtn  { text: "Cancel"    ; on-click: :navigateTo(:bookListWindow) }
    }
}
```

---

## Example 2: Employee Hours Tracker

### User Input

> "I need to track employee hours for projects. Employees have a name and department.
> Projects have a name, budget, and status (Active or Closed). Each time log entry records
> which employee worked on which project, the date, and hours spent. I need to see total
> hours per project and per employee, and be able to add or edit time log entries."

---

### Ontology (`employee-hours.ttl`)

```turtle
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix :        <https://dsl1.example.org/employee-hours#> .

<https://dsl1.example.org/employee-hours>
    a owl:Ontology ;
    rdfs:label   "Employee Hours Ontology"@en ;
    rdfs:comment "Tracks employees, projects, and time log entries."@en .

# --- Classes ---

:Employee a owl:Class ;
    rdfs:label   "Employee"@en ;
    rdfs:comment "A person who works on projects."@en .

:Department a owl:Class ;
    rdfs:label   "Department"@en ;
    rdfs:comment "An organisational unit that employees belong to."@en .

:Project a owl:Class ;
    rdfs:label   "Project"@en ;
    rdfs:comment "A work project with a budget and status."@en .

:ProjectStatus a owl:Class ;
    rdfs:label   "Project Status"@en ;
    rdfs:comment "Allowed status values for a project."@en .

:TimeLog a owl:Class ;
    rdfs:label   "Time Log"@en ;
    rdfs:comment "One time-tracking entry: employee + project + date + hours."@en .

# --- Datatype Properties: Employee ---

:employeeId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :Employee ; rdfs:range xsd:string .

:employeeName a owl:DatatypeProperty ;
    rdfs:domain :Employee ; rdfs:range xsd:string .

# --- Datatype Properties: Department ---

:departmentId   a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :Department ; rdfs:range xsd:string .

:departmentName a owl:DatatypeProperty ;
    rdfs:domain :Department ; rdfs:range xsd:string .

# --- Datatype Properties: Project ---

:projectId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :Project ; rdfs:range xsd:string .

:projectName a owl:DatatypeProperty ;
    rdfs:domain :Project ; rdfs:range xsd:string .

:budget a owl:DatatypeProperty ;
    rdfs:domain :Project ; rdfs:range xsd:decimal .

:statusCode a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :ProjectStatus ; rdfs:range xsd:string .

# --- Datatype Properties: TimeLog ---

:timeLogId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :TimeLog ; rdfs:range xsd:string .

:logDate a owl:DatatypeProperty ;
    rdfs:domain :TimeLog ; rdfs:range xsd:date .

:hoursSpent a owl:DatatypeProperty ;
    rdfs:domain :TimeLog ; rdfs:range xsd:decimal .

:notes a owl:DatatypeProperty ;
    rdfs:domain :TimeLog ; rdfs:range xsd:string .

# --- Object Properties ---

:inDepartment a owl:ObjectProperty, owl:FunctionalProperty ;
    rdfs:domain :Employee ; rdfs:range :Department .

:hasStatus a owl:ObjectProperty, owl:FunctionalProperty ;
    rdfs:domain :Project ; rdfs:range :ProjectStatus .

:loggedBy a owl:ObjectProperty, owl:FunctionalProperty ;
    rdfs:domain :TimeLog ; rdfs:range :Employee .

:loggedFor a owl:ObjectProperty, owl:FunctionalProperty ;
    rdfs:domain :TimeLog ; rdfs:range :Project .

# --- Seed Individuals: Project Status ---

:statusActive a :ProjectStatus ;
    rdfs:label  "Active"@en ;
    :statusCode "ACTIVE"^^xsd:string .

:statusClosed a :ProjectStatus ;
    rdfs:label  "Closed"@en ;
    :statusCode "CLOSED"^^xsd:string .
```

---

### PL/SPARQL Functions

```sparql
# -------------------------------------------------------
# FUNCTION: listProjects — all projects with status
# -------------------------------------------------------
FUNCTION :listProjects() {
    SELECT ?project ?projectId ?projectName ?budget ?statusCode WHERE {
        GRAPH <https://dsl1.example.org/data/employee-hours/default> {
            ?project a :Project ;
                     :projectId   ?projectId ;
                     :projectName ?projectName .
            OPTIONAL { ?project :budget ?budget . }
            OPTIONAL {
                ?project :hasStatus ?status .
                ?status  :statusCode ?statusCode .
            }
        }
    }
    ORDER BY ASC(?projectName)
    return ?project
}

# -------------------------------------------------------
# FUNCTION: listEmployees
# -------------------------------------------------------
FUNCTION :listEmployees() {
    SELECT ?emp ?employeeId ?employeeName ?departmentName WHERE {
        GRAPH <https://dsl1.example.org/data/employee-hours/default> {
            ?emp a :Employee ;
                 :employeeId   ?employeeId ;
                 :employeeName ?employeeName .
            OPTIONAL {
                ?emp :inDepartment ?dept .
                ?dept :departmentName ?departmentName .
            }
        }
    }
    ORDER BY ASC(?employeeName)
    return ?emp
}

# -------------------------------------------------------
# FUNCTION: getProjectHours — total hours logged per project
# -------------------------------------------------------
FUNCTION :getProjectHours(?projectId) {
    SELECT ?projectName (SUM(?hoursSpent) AS ?totalHours) WHERE {
        GRAPH <https://dsl1.example.org/data/employee-hours/default> {
            ?log a :TimeLog ;
                 :loggedFor  ?project ;
                 :hoursSpent ?hoursSpent .
            ?project :projectId   ?projectId ;
                     :projectName ?projectName .
        }
    }
    GROUP BY ?projectName
    return ?totalHours
}

# -------------------------------------------------------
# FUNCTION: getEmployeeHours — total hours per employee (all projects)
# -------------------------------------------------------
FUNCTION :getEmployeeHours(?employeeId) {
    SELECT ?employeeName (SUM(?hoursSpent) AS ?totalHours) WHERE {
        GRAPH <https://dsl1.example.org/data/employee-hours/default> {
            ?log a :TimeLog ;
                 :loggedBy   ?emp ;
                 :hoursSpent ?hoursSpent .
            ?emp :employeeId   ?employeeId ;
                 :employeeName ?employeeName .
        }
    }
    GROUP BY ?employeeName
    return ?totalHours
}

# -------------------------------------------------------
# FUNCTION: listTimeLogsForProject
# -------------------------------------------------------
FUNCTION :listTimeLogsForProject(?projectId) {
    SELECT ?log ?timeLogId ?logDate ?hoursSpent ?employeeName ?notes WHERE {
        GRAPH <https://dsl1.example.org/data/employee-hours/default> {
            ?log a :TimeLog ;
                 :timeLogId  ?timeLogId ;
                 :logDate    ?logDate ;
                 :hoursSpent ?hoursSpent ;
                 :loggedFor  ?project ;
                 :loggedBy   ?emp .
            ?project :projectId ?projectId .
            ?emp     :employeeName ?employeeName .
            OPTIONAL { ?log :notes ?notes . }
        }
    }
    ORDER BY DESC(?logDate)
    return ?log
}

# -------------------------------------------------------
# FUNCTION: createTimeLog
# -------------------------------------------------------
FUNCTION :createTimeLog(?employeeId, ?projectId, ?logDate, ?hoursSpent, ?notes) {
    la-if (?hoursSpent <= 0) {
        return "ERROR:HOURS_MUST_BE_POSITIVE"
    } la-else {
        const ?newId = STRUUID()
        INSERT DATA {
            GRAPH <https://dsl1.example.org/data/employee-hours/default> {
                :newId a :TimeLog ;
                       :timeLogId  ?newId ;
                       :logDate    ?logDate ;
                       :hoursSpent ?hoursSpent ;
                       :notes      ?notes ;
                       :loggedBy   ?employeeId ;
                       :loggedFor  ?projectId .
            }
        }
        return ?newId
    }
}

# -------------------------------------------------------
# FUNCTION: deleteTimeLog
# -------------------------------------------------------
FUNCTION :deleteTimeLog(?timeLogId) {
    DELETE { GRAPH <https://dsl1.example.org/data/employee-hours/default> { ?log ?p ?o . } }
    WHERE  { GRAPH <https://dsl1.example.org/data/employee-hours/default> {
        ?log :timeLogId ?timeLogId . ?log ?p ?o .
    }}
    return ""
}
```

---

### UI DSL

```
WINDOW :dashboardWindow {
    title: "Employee Hours Dashboard"
    layout: vertical
    STATE ?selectedProjectId = null
    STATE ?projectLogs       = []
    STATE ?projectTotalHours = 0

    WIDGET nav :mainNav {
        items: [
            { label: "Dashboard"  ; target: :dashboardWindow }
            { label: "Log Hours"  ; target: :logHoursWindow }
            { label: "Employees"  ; target: :employeesWindow }
        ]
    }

    WIDGET table :projectsTable {
        bind-items: :listProjects()
        columns: [?projectName, ?budget, ?statusCode]
        on-row-click: :loadProjectDetail(?row.projectId)
    }

    WIDGET panel :projectDetailPanel {
        layout: vertical
        bind-visible: ?selectedProjectId

        WIDGET label :totalLabel {
            bind-text: ?projectTotalHours
        }

        WIDGET table :logsTable {
            bind-items: :listTimeLogsForProject(?selectedProjectId)
            columns: [?logDate, ?employeeName, ?hoursSpent, ?notes]
            on-row-click: :openEditLogModal(?row)
        }

        WIDGET button :addLogBtn {
            text: "Log Hours for this Project"
            on-click: :openLogHoursModal(?selectedProjectId)
        }
    }
}

WINDOW :logHoursWindow {
    title: "Log Hours"
    layout: vertical
    STATE ?selectedEmployee = null
    STATE ?selectedProject  = null
    STATE ?logDate          = ""
    STATE ?hoursSpent       = 0
    STATE ?notes            = ""
    STATE ?errorMsg         = ""

    WIDGET form :logHoursForm {
        on-submit: :createTimeLog(
            ?selectedEmployee.employeeId,
            ?selectedProject.projectId,
            ?logDate, ?hoursSpent, ?notes
        )
        WIDGET dropdown :empSelect {
            bind-items:    :listEmployees()
            bind-selected: ?selectedEmployee
            display-field: ?item.employeeName
            value-field:   ?item.employeeId
        }
        WIDGET dropdown :projSelect {
            bind-items:    :listProjects()
            bind-selected: ?selectedProject
            display-field: ?item.projectName
            value-field:   ?item.projectId
        }
        WIDGET datepicker :dateInput  { bind-value: ?logDate }
        WIDGET number     :hoursInput { bind-value: ?hoursSpent ; min: 0.5 ; max: 24 ; step: 0.5 }
        WIDGET textarea   :notesInput { bind-value: ?notes }
        WIDGET label      :errLabel   { bind-text: ?errorMsg }
        WIDGET button     :saveBtn    { text: "Save Entry" ; on-click: submit }
    }
}
```

---

## Example 3: Quiz Application

### User Input

> "I need a simple quiz application. A quiz has a title and a set of questions. Each question
> has a text prompt, four answer choices, and one correct answer. Users take quizzes and
> their score (number of correct answers) is recorded after submission."

---

### Ontology (`quiz-app.ttl`)

```turtle
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix :     <https://dsl1.example.org/quiz-app#> .

<https://dsl1.example.org/quiz-app>
    a owl:Ontology ;
    rdfs:label   "Quiz Application Ontology"@en ;
    rdfs:comment "Models quizzes, questions, answer choices, and results."@en .

# --- Classes ---

:Quiz a owl:Class ;
    rdfs:label   "Quiz"@en ;
    rdfs:comment "A collection of questions on a topic."@en .

:Question a owl:Class ;
    rdfs:label   "Question"@en ;
    rdfs:comment "A single question within a quiz."@en .

:AnswerChoice a owl:Class ;
    rdfs:label   "Answer Choice"@en ;
    rdfs:comment "One of four possible answers for a question."@en .

:QuizResult a owl:Class ;
    rdfs:label   "Quiz Result"@en ;
    rdfs:comment "A user's completed quiz attempt and score."@en .

# --- Datatype Properties: Quiz ---

:quizId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :Quiz ; rdfs:range xsd:string .

:quizTitle a owl:DatatypeProperty ;
    rdfs:domain :Quiz ; rdfs:range xsd:string .

:quizDescription a owl:DatatypeProperty ;
    rdfs:domain :Quiz ; rdfs:range xsd:string .

# --- Datatype Properties: Question ---

:questionId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :Question ; rdfs:range xsd:string .

:questionText a owl:DatatypeProperty ;
    rdfs:domain :Question ; rdfs:range xsd:string .

:questionOrder a owl:DatatypeProperty ;
    rdfs:domain :Question ; rdfs:range xsd:integer .

# --- Datatype Properties: AnswerChoice ---

:choiceId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :AnswerChoice ; rdfs:range xsd:string .

:choiceText a owl:DatatypeProperty ;
    rdfs:domain :AnswerChoice ; rdfs:range xsd:string .

:choiceLetter a owl:DatatypeProperty ;
    rdfs:label  "choice letter (A/B/C/D)"@en ;
    rdfs:domain :AnswerChoice ; rdfs:range xsd:string .

:isCorrect a owl:DatatypeProperty ;
    rdfs:label  "is the correct answer"@en ;
    rdfs:domain :AnswerChoice ; rdfs:range xsd:boolean .

# --- Datatype Properties: QuizResult ---

:resultId a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain :QuizResult ; rdfs:range xsd:string .

:score a owl:DatatypeProperty ;
    rdfs:domain :QuizResult ; rdfs:range xsd:integer .

:totalQuestions a owl:DatatypeProperty ;
    rdfs:domain :QuizResult ; rdfs:range xsd:integer .

:completedAt a owl:DatatypeProperty ;
    rdfs:domain :QuizResult ; rdfs:range xsd:dateTime .

# --- Object Properties ---

:hasQuestion a owl:ObjectProperty ;
    rdfs:domain :Quiz     ; rdfs:range :Question .

:belongsToQuiz a owl:ObjectProperty ;
    rdfs:domain :Question ; rdfs:range :Quiz ;
    owl:inverseOf :hasQuestion .

:hasChoice a owl:ObjectProperty ;
    rdfs:domain :Question    ; rdfs:range :AnswerChoice .

:forQuestion a owl:ObjectProperty ;
    rdfs:domain :AnswerChoice ; rdfs:range :Question ;
    owl:inverseOf :hasChoice .

:forQuiz a owl:ObjectProperty, owl:FunctionalProperty ;
    rdfs:domain :QuizResult ; rdfs:range :Quiz .
```

---

### PL/SPARQL Functions

```sparql
# -------------------------------------------------------
# FUNCTION: listQuizzes
# -------------------------------------------------------
FUNCTION :listQuizzes() {
    SELECT ?quiz ?quizId ?quizTitle ?quizDescription WHERE {
        GRAPH <https://dsl1.example.org/data/quiz-app/default> {
            ?quiz a :Quiz ; :quizId ?quizId ; :quizTitle ?quizTitle .
            OPTIONAL { ?quiz :quizDescription ?quizDescription . }
        }
    }
    ORDER BY ASC(?quizTitle)
    return ?quiz
}

# -------------------------------------------------------
# FUNCTION: getQuestionsForQuiz — ordered question list
# -------------------------------------------------------
FUNCTION :getQuestionsForQuiz(?quizId) {
    SELECT ?question ?questionId ?questionText ?questionOrder WHERE {
        GRAPH <https://dsl1.example.org/data/quiz-app/default> {
            ?question a :Question ;
                      :questionId    ?questionId ;
                      :questionText  ?questionText ;
                      :questionOrder ?questionOrder ;
                      :belongsToQuiz ?quiz .
            ?quiz :quizId ?quizId .
        }
    }
    ORDER BY ASC(?questionOrder)
    return ?question
}

# -------------------------------------------------------
# FUNCTION: getChoicesForQuestion — four answer choices
# -------------------------------------------------------
FUNCTION :getChoicesForQuestion(?questionId) {
    SELECT ?choice ?choiceId ?choiceLetter ?choiceText ?isCorrect WHERE {
        GRAPH <https://dsl1.example.org/data/quiz-app/default> {
            ?choice a :AnswerChoice ;
                    :choiceId     ?choiceId ;
                    :choiceLetter ?choiceLetter ;
                    :choiceText   ?choiceText ;
                    :isCorrect    ?isCorrect ;
                    :forQuestion  ?question .
            ?question :questionId ?questionId .
        }
    }
    ORDER BY ASC(?choiceLetter)
    return ?choice
}

# -------------------------------------------------------
# FUNCTION: scoreQuiz — evaluate a map of questionId → choiceId answers
# Returns an integer score (count of correct answers)
# -------------------------------------------------------
FUNCTION :scoreQuiz(?quizId, ?answers) {
    let ?questions = :getQuestionsForQuiz(?quizId)
    let ?score = 0

    la-forEach (?q IN ?questions) {
        let ?choices      = :getChoicesForQuestion(?q.questionId)
        let ?chosenChoice = filter(?choices,
            FUNCTION(?c) { return ?c.choiceId = ?answers[?q.questionId] })

        la-if (BOUND(?chosenChoice) && ?chosenChoice.isCorrect = true) {
            let ?score = ?score + 1
        }
    }

    return ?score
}

# -------------------------------------------------------
# FUNCTION: submitQuizResult — persist a completed attempt
# -------------------------------------------------------
FUNCTION :submitQuizResult(?quizId, ?score, ?totalQuestions) {
    const ?newId = STRUUID()
    const ?now   = NOW()

    INSERT DATA {
        GRAPH <https://dsl1.example.org/data/quiz-app/default> {
            :newId a :QuizResult ;
                   :resultId       ?newId ;
                   :score          ?score ;
                   :totalQuestions ?totalQuestions ;
                   :completedAt    ?now ;
                   :forQuiz        ?quizId .
        }
    }
    return ?newId
}

# -------------------------------------------------------
# FUNCTION: createQuiz — add a new quiz shell (no questions)
# -------------------------------------------------------
FUNCTION :createQuiz(?title, ?description) {
    la-if (STRLEN(?title) = 0) {
        return "ERROR:TITLE_REQUIRED"
    } la-else {
        const ?newId = STRUUID()
        INSERT DATA {
            GRAPH <https://dsl1.example.org/data/quiz-app/default> {
                :newId a :Quiz ;
                       :quizId          ?newId ;
                       :quizTitle       ?title ;
                       :quizDescription ?description .
            }
        }
        return ?newId
    }
}

# -------------------------------------------------------
# FUNCTION: addQuestion — append a question to a quiz
# -------------------------------------------------------
FUNCTION :addQuestion(?quizId, ?text, ?order, ?choiceA, ?choiceB, ?choiceC, ?choiceD, ?correctLetter) {
    const ?qId  = STRUUID()
    const ?cIdA = STRUUID()
    const ?cIdB = STRUUID()
    const ?cIdC = STRUUID()
    const ?cIdD = STRUUID()

    INSERT DATA {
        GRAPH <https://dsl1.example.org/data/quiz-app/default> {
            :qId a :Question ;
                 :questionId    ?qId ;
                 :questionText  ?text ;
                 :questionOrder ?order ;
                 :belongsToQuiz ?quizId .

            :cIdA a :AnswerChoice ; :choiceId ?cIdA ;
                  :choiceLetter "A" ; :choiceText ?choiceA ;
                  :isCorrect (?correctLetter = "A") ; :forQuestion ?qId .
            :cIdB a :AnswerChoice ; :choiceId ?cIdB ;
                  :choiceLetter "B" ; :choiceText ?choiceB ;
                  :isCorrect (?correctLetter = "B") ; :forQuestion ?qId .
            :cIdC a :AnswerChoice ; :choiceId ?cIdC ;
                  :choiceLetter "C" ; :choiceText ?choiceC ;
                  :isCorrect (?correctLetter = "C") ; :forQuestion ?qId .
            :cIdD a :AnswerChoice ; :choiceId ?cIdD ;
                  :choiceLetter "D" ; :choiceText ?choiceD ;
                  :isCorrect (?correctLetter = "D") ; :forQuestion ?qId .
        }
    }
    return ?qId
}
```

---

### UI DSL

```
WINDOW :quizListWindow {
    title: "Quiz App"
    layout: vertical
    STATE ?quizzes = []

    WIDGET nav :mainNav {
        items: [
            { label: "Take a Quiz"   ; target: :quizListWindow }
            { label: "Manage Quizzes"; target: :manageQuizzesWindow }
        ]
    }

    WIDGET list :quizList {
        bind-items: :listQuizzes()
        item-template {
            WIDGET label  :qTitle { bind-text: ?item.quizTitle }
            WIDGET label  :qDesc  { bind-text: ?item.quizDescription }
            WIDGET button :startBtn { text: "Start Quiz" ; on-click: :beginQuiz(?item.quizId) }
        }
    }
}

WINDOW :takeQuizWindow {
    title: "Quiz"
    layout: vertical
    STATE ?quizId          = null
    STATE ?questions       = []
    STATE ?currentIndex    = 0
    STATE ?currentQuestion = null
    STATE ?choices         = []
    STATE ?answers         = {}
    STATE ?submitted       = false
    STATE ?score           = 0

    WIDGET panel :questionPanel {
        layout: vertical
        bind-visible: ?currentQuestion

        WIDGET label :questionText  { bind-text: ?currentQuestion.questionText }
        WIDGET label :questionCount { bind-text: ?currentIndex }

        WIDGET list :choicesList {
            bind-items: :getChoicesForQuestion(?currentQuestion.questionId)
            item-template {
                WIDGET button :choiceBtn {
                    bind-text: ?item.choiceText
                    on-click: :recordAnswer(?currentQuestion.questionId, ?item.choiceId)
                }
            }
        }

        WIDGET button :nextBtn {
            text: "Next Question"
            on-click: :advanceQuestion()
        }
        WIDGET button :submitBtn {
            text: "Submit Quiz"
            on-click: :submitQuiz(?quizId, ?answers)
        }
    }

    WIDGET panel :resultsPanel {
        layout: vertical
        bind-visible: ?submitted
        WIDGET label :scoreLabel  { bind-text: ?score }
        WIDGET button :retryBtn   { text: "Try Again"    ; on-click: :resetQuiz(?quizId) }
        WIDGET button :homeBtn    { text: "Back to List" ; on-click: :navigateTo(:quizListWindow) }
    }
}

WINDOW :manageQuizzesWindow {
    title: "Manage Quizzes"
    layout: vertical
    STATE ?selectedQuizId = null
    STATE ?newTitle       = ""
    STATE ?newDesc        = ""

    WIDGET table :quizTable {
        bind-items: :listQuizzes()
        columns: [?quizTitle, ?quizDescription]
        on-row-click: :selectQuiz(?row.quizId)
    }

    WIDGET form :createQuizForm {
        on-submit: :createQuiz(?newTitle, ?newDesc)
        WIDGET input  :titleInput { placeholder: "Quiz Title *" ; bind-value: ?newTitle }
        WIDGET input  :descInput  { placeholder: "Description"  ; bind-value: ?newDesc }
        WIDGET button :createBtn  { text: "Create Quiz" ; on-click: submit }
    }

    WIDGET panel :questionEditorPanel {
        layout: vertical
        bind-visible: ?selectedQuizId

        WIDGET list :questionList {
            bind-items: :getQuestionsForQuiz(?selectedQuizId)
            item-template {
                WIDGET label :qText { bind-text: ?item.questionText }
            }
        }

        WIDGET button :addQuestionBtn {
            text: "Add Question"
            on-click: :openAddQuestionModal(?selectedQuizId)
        }
    }
}
```
