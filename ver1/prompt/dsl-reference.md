# DSL1 Quick-Reference Card

---

## PL/SPARQL Keywords

### Declarations & Binding

```sparql
FUNCTION :name(?p1, ?p2) { ... return ?value }
let ?var   = <expression>
const ?VAR = <expression>
return ?value
```

### Control Flow

```sparql
la-if (?cond) { ... }
la-if (?cond) { ... } la-else { ... }

la-forEach (?row IN ?resultSet) { ... }
```

### Higher-Order Functions

```sparql
let ?out = map(?list,    FUNCTION(?x) { return <expr> })
let ?out = filter(?list, FUNCTION(?x) { return <bool-expr> })
let ?out = reduce(?list, <init>, FUNCTION(?acc, ?x) { return <expr> })
```

### SPARQL Query Blocks

```sparql
SELECT ?a ?b WHERE {
    GRAPH <https://dsl1.example.org/data/<domain>/default> {
        ?s a :Class ; :prop ?a .
        OPTIONAL { ?s :opt ?b . }
    }
    FILTER(<condition>)
    BIND(<expr> AS ?derived)
}
ORDER BY ASC(?a) | DESC(?a)
LIMIT <n>
OFFSET <n>
GROUP BY ?a
```

### SPARQL Update Blocks

```sparql
# Unconditional add
INSERT DATA {
    GRAPH <...> { :id a :Class ; :prop ?val . }
}

# Unconditional remove
DELETE DATA {
    GRAPH <...> { :id :prop ?val . }
}

# Conditional replace
DELETE { GRAPH <...> { ?s :prop ?old . } }
INSERT { GRAPH <...> { ?s :prop ?new . } }
WHERE  { GRAPH <...> { ?s :id ?targetId ; :prop ?old . } }

# Delete individual and all its triples
DELETE { GRAPH <...> { ?s ?p ?o . } }
WHERE  { GRAPH <...> { ?s :id ?targetId . ?s ?p ?o . } }
```

### Aggregate Patterns

```sparql
SELECT ?category (COUNT(?item) AS ?total) (SUM(?qty) AS ?sum) WHERE {
    GRAPH <...> { ?item a :Item ; :category ?category ; :quantity ?qty . }
}
GROUP BY ?category
ORDER BY DESC(?total)
```

### SPARQL Built-in Functions (selection)

| Function | Description |
|----------|-------------|
| `STRUUID()` | Generate UUID string — use for new IDs |
| `NOW()` | Current datetime as `xsd:dateTime` |
| `STR(?x)` | Cast to string |
| `LCASE(?s)` | Lowercase |
| `UCASE(?s)` | Uppercase |
| `CONTAINS(?s, ?sub)` | Substring test |
| `STRSTARTS(?s, ?pre)` | Prefix test |
| `STRENDS(?s, ?suf)` | Suffix test |
| `STRLEN(?s)` | String length |
| `CONCAT(?a, ?b, ...)` | Concatenate |
| `SUBSTR(?s, ?start, ?len)` | Substring |
| `REPLACE(?s, ?pat, ?rep)` | Regex replace |
| `BOUND(?v)` | True if variable is bound |
| `IF(?c, ?t, ?f)` | Inline ternary (only inside BIND/FILTER) |
| `COALESCE(?a, ?b)` | First bound value |
| `ABS(?n)` | Absolute value |
| `ROUND(?n)` | Round to integer |
| `FLOOR(?n)` | Floor |
| `CEIL(?n)` | Ceiling |
| `xsd:integer(?s)` | Cast to integer |
| `xsd:decimal(?s)` | Cast to decimal |

---

## UI DSL Keywords

### Window & State

```
WINDOW :windowName {
    title: "Title"
    layout: vertical | horizontal | grid(<n>)
    STATE ?var = <default>
    WIDGET ...
}
```

### Widget Types — Quick Syntax

```
WIDGET label      :id { bind-text: ?var | text: "literal" }
WIDGET input      :id { placeholder: "…" ; bind-value: ?var ; on-change: :fn(?var) }
WIDGET textarea   :id { bind-value: ?var ; on-change: :fn(?var) }
WIDGET button     :id { text: "Label" ; on-click: :fn(?a, ?b) }
WIDGET number     :id { bind-value: ?var ; min: 0 ; max: 100 ; step: 1 }
WIDGET checkbox   :id { text: "Label" ; bind-checked: ?bool ; on-change: :fn(?bool) }
WIDGET datepicker :id { bind-value: ?date ; on-change: :fn(?date) }
WIDGET dropdown   :id { bind-items: :fn() ; bind-selected: ?sel ; display-field: ?item.label ; value-field: ?item.id }
WIDGET list       :id { bind-items: :fn(?p) ; item-template { WIDGET ... } ; on-select: :fn(?item) }
WIDGET table      :id { bind-items: :fn(?p) ; columns: [?a, ?b, ?c] ; on-row-click: :fn(?row) }
WIDGET panel      :id { layout: vertical ; bind-visible: ?bool ; WIDGET ... }
WIDGET modal      :id { bind-visible: ?bool ; title: "Title" ; WIDGET ... }
WIDGET form       :id { on-submit: :fn(?f1, ?f2) ; WIDGET input :f1 { ... } ; WIDGET button :sub { text: "Save" ; on-click: submit } }
WIDGET nav        :id { items: [{ label: "L" ; target: :win }] }
```

### Binding Directives

| Directive | Direction | Use on |
|-----------|-----------|--------|
| `bind-text: ?var` | var → display | label |
| `bind-value: ?var` | two-way | input, textarea, number, datepicker |
| `bind-checked: ?var` | two-way | checkbox |
| `bind-items: :fn(?p)` | fn result → widget | list, table, dropdown |
| `bind-selected: ?var` | two-way | dropdown |
| `bind-visible: ?var` | var → visibility | panel, modal, any widget |
| `bind-disabled: ?var` | var → disabled state | button, input |

### Event Directives

| Directive | Triggered by |
|-----------|--------------|
| `on-click: :fn(...)` | Button click |
| `on-change: :fn(?v)` | Input value change |
| `on-submit: :fn(...)` | Form submit |
| `on-select: :fn(?item)` | List item selected |
| `on-row-click: :fn(?row)` | Table row clicked |
| `on-load: :fn()` | Widget first render |

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| OWL Class | UpperCamelCase | `Book`, `EmployeeHour` |
| OWL Property | lowerCamelCase | `title`, `hiredDate`, `worksFor` |
| OWL Individual | lowerCamelCase or kebab-case | `book001`, `category-fiction` |
| PL/SPARQL Function | lowerCamelCase, prefixed | `:listBooks`, `:createEmployee` |
| PL/SPARQL CONST | UPPER_SNAKE_CASE | `?MAX_RETRIES`, `?DEFAULT_GRAPH` |
| UI Window | lowerCamelCase, prefixed | `:bookListWindow`, `:addBookWindow` |
| UI Widget ID | lowerCamelCase, prefixed | `:titleInput`, `:saveButton` |
| STATE variable | lowerCamelCase | `?selectedBook`, `?isLoading` |
| Named graph (schema) | `.../schema/<domain>` | `https://dsl1.example.org/schema/books` |
| Named graph (data) | `.../data/<domain>/default` | `https://dsl1.example.org/data/books/default` |

---

## Common Patterns

### CRUD Function Set (per entity)

```sparql
# List all
FUNCTION :listBooks() {
    SELECT ?b ?id ?title ?author WHERE {
        GRAPH <https://dsl1.example.org/data/books/default> {
            ?b a :Book ; :bookId ?id ; :title ?title ; :author ?author .
        }
    }
    ORDER BY ASC(?title)
    return ?b
}

# Get one by ID
FUNCTION :getBook(?bookId) {
    SELECT ?b ?title ?author ?year WHERE {
        GRAPH <https://dsl1.example.org/data/books/default> {
            ?b a :Book ; :bookId ?bookId ; :title ?title ; :author ?author .
            OPTIONAL { ?b :year ?year . }
        }
    }
    la-if (BOUND(?b)) {
        return ?b
    } la-else {
        return "ERROR:NOT_FOUND"
    }
}

# Create
FUNCTION :createBook(?title, ?author, ?year) {
    const ?newId = STRUUID()
    INSERT DATA {
        GRAPH <https://dsl1.example.org/data/books/default> {
            :newId a :Book ;
                   :bookId ?newId ;
                   :title  ?title ;
                   :author ?author ;
                   :year   ?year .
        }
    }
    return ?newId
}

# Update
FUNCTION :updateBook(?bookId, ?title, ?author) {
    DELETE { GRAPH <https://dsl1.example.org/data/books/default> {
        ?b :title ?oldTitle ; :author ?oldAuthor .
    }}
    INSERT { GRAPH <https://dsl1.example.org/data/books/default> {
        ?b :title ?title ; :author ?author .
    }}
    WHERE  { GRAPH <https://dsl1.example.org/data/books/default> {
        ?b :bookId ?bookId ; :title ?oldTitle ; :author ?oldAuthor .
    }}
    return ""
}

# Delete
FUNCTION :deleteBook(?bookId) {
    DELETE { GRAPH <https://dsl1.example.org/data/books/default> { ?b ?p ?o . } }
    WHERE  { GRAPH <https://dsl1.example.org/data/books/default> {
        ?b :bookId ?bookId . ?b ?p ?o .
    }}
    return ""
}
```

### Search / Filter Pattern

```sparql
FUNCTION :searchBooks(?term, ?category) {
    SELECT ?b ?title ?author WHERE {
        GRAPH <https://dsl1.example.org/data/books/default> {
            ?b a :Book ; :title ?title ; :author ?author .
            OPTIONAL { ?b :inCategory ?cat . ?cat :categoryId ?category . }
        }
        FILTER(CONTAINS(LCASE(?title), LCASE(?term))
            || CONTAINS(LCASE(?author), LCASE(?term)))
    }
    ORDER BY ASC(?title)
    return ?b
}
```

### Aggregate / Summary Pattern

```sparql
FUNCTION :categorySummary() {
    SELECT ?catName (COUNT(?b) AS ?count) WHERE {
        GRAPH <https://dsl1.example.org/data/books/default> {
            ?b a :Book ; :inCategory ?cat .
            ?cat :name ?catName .
        }
    }
    GROUP BY ?catName
    ORDER BY DESC(?count)
    return ?catName
}
```

### Master-Detail Window Pattern

```
WINDOW :masterDetailWindow {
    title: "Books"
    layout: horizontal
    STATE ?selectedId = null
    STATE ?selected   = null
    STATE ?searchTerm = ""

    WIDGET panel :masterPanel {
        layout: vertical
        WIDGET input :searchInput { bind-value: ?searchTerm ; on-change: :searchBooks(?searchTerm, "") }
        WIDGET list  :itemList {
            bind-items: :searchBooks(?searchTerm, "")
            item-template {
                WIDGET label :rowTitle { bind-text: ?item.title }
            }
            on-select: :loadDetail(?item.bookId)
        }
    }

    WIDGET panel :detailPanel {
        layout: vertical
        bind-visible: ?selected
        WIDGET label  :dTitle  { bind-text: ?selected.title }
        WIDGET label  :dAuthor { bind-text: ?selected.author }
        WIDGET button :editBtn { text: "Edit"   ; on-click: :openEditModal(?selectedId) }
        WIDGET button :delBtn  { text: "Delete" ; on-click: :deleteBook(?selectedId) }
    }
}
```

### Form + Validation Pattern

```sparql
FUNCTION :validateBookForm(?title, ?author) {
    la-if (!BOUND(?title) || STRLEN(?title) = 0) {
        return "ERROR:TITLE_REQUIRED"
    } la-else {
        la-if (!BOUND(?author) || STRLEN(?author) = 0) {
            return "ERROR:AUTHOR_REQUIRED"
        } la-else {
            return "OK"
        }
    }
}

FUNCTION :submitBookForm(?title, ?author, ?year) {
    let ?valid = :validateBookForm(?title, ?author)
    la-if (STRSTARTS(?valid, "ERROR:")) {
        return ?valid
    } la-else {
        let ?id = :createBook(?title, ?author, ?year)
        return ?id
    }
}
```

---

## Ontology Quick Patterns

```turtle
# Class
:MyClass a owl:Class ; rdfs:label "My Class"@en ; rdfs:subClassOf :ParentClass .

# Datatype property with cardinality
:propName a owl:DatatypeProperty ; rdfs:domain :MyClass ; rdfs:range xsd:string .

# Object property (bidirectional)
:hasPart    a owl:ObjectProperty ; rdfs:domain :Parent ; rdfs:range :Child .
:isPartOf   a owl:ObjectProperty ; rdfs:domain :Child  ; rdfs:range :Parent ;
            owl:inverseOf :hasPart .

# Functional property (at most one value)
:primaryKey a owl:DatatypeProperty, owl:FunctionalProperty ;
            rdfs:domain :MyClass ; rdfs:range xsd:string .

# Enumeration individual
:statusActive a :Status ; rdfs:label "Active"@en ; :statusCode "ACTIVE"^^xsd:string .
:statusClosed a :Status ; rdfs:label "Closed"@en ; :statusCode "CLOSED"^^xsd:string .
```

---

## Error Handling Pattern

```sparql
# Return errors as "ERROR:<CODE>" strings
FUNCTION :safeOp(?input) {
    la-if (!BOUND(?input)) {
        return "ERROR:MISSING_INPUT"
    } la-else {
        # ... do work ...
        return ?result
    }
}

# Caller checks with STRSTARTS
FUNCTION :caller(?input) {
    let ?result = :safeOp(?input)
    la-if (STRSTARTS(?result, "ERROR:")) {
        # surface error to UI
        return ?result
    } la-else {
        # happy path
        return ?result
    }
}
```
