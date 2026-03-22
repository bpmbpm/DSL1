# UI DSL Specification

## 1. Philosophy

The UI DSL is a declarative language for describing **application structure and data binding**. It deliberately omits all presentation concerns:

- **No colors** — color is a CSS concern, not a structural concern.
- **No pixel positions or sizes** — layout is handled by the target CSS framework.
- **No fonts, borders, or padding** — all visual styling is external.

What the UI DSL does express:

- **Windows** (named views/screens) and their component hierarchies.
- **Widgets** (buttons, dropdowns, lists, fields) and their identifiers.
- **Data bindings** — which SPARQL query populates a widget.
- **Event handlers** — which PL/SPARQL function to call when a user interacts.
- **Navigation** — which window to show next after an action.

This separation ensures the same UI DSL source can be rendered by different CSS frameworks (Bootstrap, Tailwind, Material) simply by swapping the CSS layer, without changing any DSL source.

UI DSL source files use the extension `.uidsl`.

---

## 2. Structural Overview

A UI DSL program consists of one or more **WINDOW declarations**. Each window contains a hierarchy of **widget declarations**. Windows can reference each other for navigation.

```
PREFIX ex: <http://example.org/>

WINDOW MainMenu {
  BUTTON btnNew LABEL "New Person" {
    ON CLICK CALL addPersonFunction
    NAVIGATE TO PersonForm
  }
  LISTVIEW peopleList {
    BIND TO (SELECT ?p ?name WHERE { ?p a ex:Person ; ex:name ?name . })
    COLUMN ?name LABEL "Full Name"
    ON CLICK ROW CALL selectPersonFunction
  }
}

WINDOW PersonForm {
  FIELD firstName LABEL "First Name" {
    BIND TO (SELECT ?v WHERE { ex:currentPerson ex:firstName ?v . })
    ON CHANGE CALL updateFirstName
  }
  BUTTON btnSave LABEL "Save" {
    ON CLICK CALL savePersonFunction
    NAVIGATE TO MainMenu
  }
}
```

---

## 3. PREFIX Declarations

```
PREFIX <prefix>: <IRI>
```

Prefixes declared at the top of a `.uidsl` file apply to all SPARQL queries embedded within it. They follow the same syntax as SPARQL/Turtle PREFIX declarations.

```
PREFIX ex:   <http://example.org/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
```

---

## 4. WINDOW

```
WINDOW <name> {
  <widget-declarations>
}
```

A `WINDOW` represents a distinct view or screen of the application. Only one window is visible at a time. The first declared window is the initial view unless overridden with `INITIAL WINDOW <name>`.

**Attributes:**

| Attribute | Syntax | Description |
|---|---|---|
| `LABEL` | `LABEL "string"` | Human-readable title for the window |
| `ON LOAD` | `ON LOAD CALL <fn>` | PL/SPARQL function to call when the window becomes visible |

```
WINDOW Dashboard LABEL "Dashboard" {
  ON LOAD CALL refreshDashboardData

  LISTVIEW recentItems {
    BIND TO (SELECT ?item ?title WHERE {
      ?item a ex:Item ; ex:title ?title .
    } ORDER BY DESC(?item) LIMIT 10)
    COLUMN ?title LABEL "Recent Items"
  }
}
```

---

## 5. BUTTON

```
BUTTON <name> LABEL "<label>" {
  [ON CLICK CALL <function-name>]
  [ON CLICK CALL <function-name> WITH <arg-expr>]
  [NAVIGATE TO <window-name>]
  [ENABLED WHEN (<sparql-ask-expr>)]
}
```

A `BUTTON` represents a clickable action trigger. It has no data binding (buttons do not display data). Navigation and function invocation can be combined: the function is called first, then navigation occurs.

**Attributes:**

| Attribute | Description |
|---|---|
| `LABEL` | Button text |
| `ON CLICK CALL` | PL/SPARQL function to invoke on click |
| `WITH` | Argument expression passed to the function |
| `NAVIGATE TO` | Window to show after the click handler completes |
| `ENABLED WHEN` | ASK query; button is disabled when query returns false |

```
BUTTON btnDelete LABEL "Delete Selected" {
  ON CLICK CALL deleteSelectedItems WITH selectedItemVar
  ENABLED WHEN (ASK WHERE { ex:currentSelection ex:hasItem ?x . })
}
```

---

## 6. DROPDOWN

`DROPDOWN` declares a single-selection combo box. It is populated by a SPARQL query and fires an event when the selection changes.

```
DROPDOWN <name> LABEL "<label>" {
  BIND TO (<select-query>)
  DISPLAY ?<label-var>
  VALUE ?<value-var>
  ON CHANGE CALL <function-name>
  [DEFAULT VALUE <iri-or-literal>]
}
```

**Attributes:**

| Attribute | Description |
|---|---|
| `BIND TO` | SELECT query whose rows populate the options |
| `DISPLAY` | Which variable to show as the option label |
| `VALUE` | Which variable to use as the option value (bound on change) |
| `ON CHANGE CALL` | Function called with the selected value when selection changes |
| `DEFAULT VALUE` | Pre-selected value (IRI or literal) |

```
DROPDOWN departmentPicker LABEL "Department" {
  BIND TO (SELECT ?dept ?label WHERE {
    ?dept a ex:Department ; rdfs:label ?label .
  } ORDER BY ?label)
  DISPLAY ?label
  VALUE ?dept
  ON CHANGE CALL filterByDepartment
  DEFAULT VALUE ex:AllDepartments
}
```

---

## 7. MULTISELECT

`MULTISELECT` declares a multiple-selection list. The selected values are available as a set.

```
MULTISELECT <name> LABEL "<label>" {
  BIND TO (<select-query>)
  DISPLAY ?<label-var>
  VALUE ?<value-var>
  ON CHANGE CALL <function-name>
}
```

Behaviour is the same as `DROPDOWN` except multiple items can be selected simultaneously. The event handler function receives a list (array) of selected values.

```
MULTISELECT tagPicker LABEL "Tags" {
  BIND TO (SELECT ?tag ?name WHERE {
    ?tag a ex:Tag ; ex:name ?name .
  } ORDER BY ?name)
  DISPLAY ?name
  VALUE ?tag
  ON CHANGE CALL updateArticleTags
}
```

---

## 8. LISTVIEW

`LISTVIEW` displays a tabular list of rows from a SPARQL SELECT query. Each row corresponds to one solution mapping. Columns are declared explicitly.

```
LISTVIEW <name> {
  BIND TO (<select-query>)
  COLUMN ?<var> LABEL "<header>"
  [COLUMN ?<var> LABEL "<header>"]
  ...
  [ON CLICK ROW CALL <function-name>]
  [ON CLICK ROW NAVIGATE TO <window-name>]
  [SELECTION SINGLE | MULTIPLE]
}
```

**Attributes:**

| Attribute | Description |
|---|---|
| `BIND TO` | SELECT query providing row data |
| `COLUMN` | Declares a visible column mapped to a query variable |
| `ON CLICK ROW CALL` | Function called with the clicked row's solution mapping |
| `ON CLICK ROW NAVIGATE TO` | Window to show when a row is clicked |
| `SELECTION` | `SINGLE` (default) or `MULTIPLE` row selection mode |

```
LISTVIEW invoiceList {
  BIND TO (SELECT ?inv ?number ?amount ?status WHERE {
    ?inv a ex:Invoice ;
         ex:invoiceNumber ?number ;
         ex:totalAmount ?amount ;
         ex:status ?status .
  } ORDER BY DESC(?number))
  COLUMN ?number LABEL "Invoice #"
  COLUMN ?amount LABEL "Total"
  COLUMN ?status LABEL "Status"
  ON CLICK ROW CALL openInvoice
  ON CLICK ROW NAVIGATE TO InvoiceDetail
  SELECTION SINGLE
}
```

---

## 9. FIELD

`FIELD` is a general-purpose widget for displaying or editing a single data value. It can be read-only (display) or editable (input).

```
FIELD <name> LABEL "<label>" {
  BIND TO (<select-query-returning-single-value>)
  [EDITABLE]
  [ON CHANGE CALL <function-name>]
  [TYPE TEXT | NUMBER | DATE | BOOLEAN | IRI]
}
```

When `EDITABLE` is present, the translator renders an `<input>` element. When absent, it renders a `<span>` or `<td>`.

**Attributes:**

| Attribute | Description |
|---|---|
| `BIND TO` | SELECT query returning exactly one variable and one row |
| `EDITABLE` | Makes the field an input control |
| `ON CHANGE CALL` | Function called with the new value when the field changes |
| `TYPE` | Data type hint: `TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `IRI` |

```
FIELD personName LABEL "Name" {
  BIND TO (SELECT ?name WHERE { ex:currentPerson ex:name ?name . })
  EDITABLE
  TYPE TEXT
  ON CHANGE CALL updatePersonName
}

FIELD birthDate LABEL "Date of Birth" {
  BIND TO (SELECT ?dob WHERE { ex:currentPerson ex:dateOfBirth ?dob . })
  EDITABLE
  TYPE DATE
  ON CHANGE CALL updateBirthDate
}
```

---

## 10. CANVAS

`CANVAS` declares a drawing surface for graphic primitives produced by PL/SPARQL `DRAW` statements.

```
CANVAS <name> {
  RENDER CALL <function-name>
}
```

The `RENDER CALL` function is a PL/SPARQL function containing `DRAW` primitives. It is called whenever the canvas needs to be repainted (on load and when `REFRESH CANVAS <name>` is called from another function).

```
CANVAS salesChart {
  RENDER CALL drawSalesChart
}
```

---

## 11. NAVIGATE TO

`NAVIGATE TO <window-name>` is used inside `BUTTON` or `ON CLICK ROW` handlers to declare navigation.

It can also be used as a standalone statement inside a PL/SPARQL function by calling the built-in `navigateTo("WindowName")` function (generated by the translator).

---

## 12. Data Binding Details

### 12.1 BIND TO Query Requirements

- The SPARQL SELECT query in a `BIND TO` clause runs against the live in-browser tripleStore.
- For `FIELD`, the query must return exactly one variable (the bound value). If it returns zero rows, the field shows an empty/default state. If it returns more than one row, only the first row is used.
- For `LISTVIEW`, `DROPDOWN`, and `MULTISELECT`, the query returns multiple rows.
- Queries are re-evaluated whenever the store changes (reactive binding) unless `STATIC BIND` is specified.

### 12.2 Reactive Binding

By default, all bindings are reactive: when a store mutation (`INSERT DATA`, `DELETE DATA`, etc.) completes in any PL/SPARQL function, all widgets whose `BIND TO` query results may have changed are re-rendered.

To suppress re-evaluation (for performance):

```
LISTVIEW bigList {
  STATIC BIND TO (SELECT ?x WHERE { ?x a ex:HugeClass . })
  ...
}
```

### 12.3 Parameterised Queries

Binding queries can reference a **current selection variable** using the special token `ex:currentSelection` or a named context variable set by a prior `ON CLICK` handler.

```
FIELD personDetail LABEL "Biography" {
  BIND TO (SELECT ?bio WHERE {
    ex:selectedPerson ex:biography ?bio .
  })
}
```

The IRI `ex:selectedPerson` is updated in the tripleStore by an `ON CLICK ROW` handler, which causes the reactive binding to re-evaluate automatically.

---

## 13. Event Handler Reference

| Event | Widget | Syntax |
|---|---|---|
| Click | BUTTON | `ON CLICK CALL <fn>` |
| Click row | LISTVIEW | `ON CLICK ROW CALL <fn>` |
| Change | DROPDOWN | `ON CHANGE CALL <fn>` |
| Change | MULTISELECT | `ON CHANGE CALL <fn>` |
| Change | FIELD | `ON CHANGE CALL <fn>` |
| Window load | WINDOW | `ON LOAD CALL <fn>` |

All event handler functions are defined in the PL/SPARQL source. The translator generates the DOM event listeners that call them.

---

## 14. Full Grammar (EBNF)

```ebnf
UIProgram        ::= PrefixDecl* (InitialDecl | WindowDecl)* ;

PrefixDecl       ::= 'PREFIX' PNAME_NS IRIREF ;
InitialDecl      ::= 'INITIAL' 'WINDOW' Identifier ;

WindowDecl       ::= 'WINDOW' Identifier WindowAttribute* '{' WidgetDecl* '}' ;
WindowAttribute  ::= LabelAttr | OnLoadAttr ;
LabelAttr        ::= 'LABEL' STRING ;
OnLoadAttr       ::= 'ON' 'LOAD' 'CALL' Identifier ;

WidgetDecl       ::= ButtonDecl
                   | DropdownDecl
                   | MultiselectDecl
                   | ListviewDecl
                   | FieldDecl
                   | CanvasDecl ;

ButtonDecl       ::= 'BUTTON' Identifier LabelAttr '{' ButtonBody '}' ;
ButtonBody       ::= (OnClickAttr | NavigateAttr | EnabledWhenAttr)* ;
OnClickAttr      ::= 'ON' 'CLICK' 'CALL' Identifier ('WITH' Expression)? ;
NavigateAttr     ::= 'NAVIGATE' 'TO' Identifier ;
EnabledWhenAttr  ::= 'ENABLED' 'WHEN' '(' AskQuery ')' ;

DropdownDecl     ::= 'DROPDOWN' Identifier LabelAttr '{' DropdownBody '}' ;
DropdownBody     ::= BindToAttr DisplayAttr ValueAttr OnChangeAttr? DefaultValueAttr? ;
DisplayAttr      ::= 'DISPLAY' Var ;
ValueAttr        ::= 'VALUE' Var ;
DefaultValueAttr ::= 'DEFAULT' 'VALUE' (IRIOrPrefixed | Literal) ;

MultiselectDecl  ::= 'MULTISELECT' Identifier LabelAttr '{' MultiselectBody '}' ;
MultiselectBody  ::= BindToAttr DisplayAttr ValueAttr OnChangeAttr? ;

ListviewDecl     ::= 'LISTVIEW' Identifier '{' ListviewBody '}' ;
ListviewBody     ::= (StaticBind | BindToAttr) ColumnDecl+ ListviewEvent* SelectionAttr? ;
ColumnDecl       ::= 'COLUMN' Var LabelAttr ;
ListviewEvent    ::= 'ON' 'CLICK' 'ROW' 'CALL' Identifier
                   | 'ON' 'CLICK' 'ROW' 'NAVIGATE' 'TO' Identifier ;
SelectionAttr    ::= 'SELECTION' ('SINGLE' | 'MULTIPLE') ;

FieldDecl        ::= 'FIELD' Identifier LabelAttr '{' FieldBody '}' ;
FieldBody        ::= BindToAttr 'EDITABLE'? TypeAttr? OnChangeAttr? ;
TypeAttr         ::= 'TYPE' ('TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'IRI') ;

CanvasDecl       ::= 'CANVAS' Identifier '{' 'RENDER' 'CALL' Identifier '}' ;

BindToAttr       ::= 'BIND' 'TO' '(' SelectQuery ')' ;
StaticBind       ::= 'STATIC' 'BIND' 'TO' '(' SelectQuery ')' ;
OnChangeAttr     ::= 'ON' 'CHANGE' 'CALL' Identifier ;

Var              ::= '?' Identifier ;
Identifier       ::= [a-zA-Z_][a-zA-Z0-9_]* ;
STRING           ::= '"' [^"]* '"' ;
IRIOrPrefixed    ::= IRIREF | PrefixedName ;
IRIREF           ::= '<' [^>]* '>' ;
PrefixedName     ::= PNAME_NS ':' PNAME_LN ;
```

---

## 15. Complete Example

```
PREFIX ex:   <http://example.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

INITIAL WINDOW ProjectList

WINDOW ProjectList LABEL "Projects" {
  ON LOAD CALL loadProjects

  BUTTON btnNewProject LABEL "New Project" {
    ON CLICK CALL createNewProject
    NAVIGATE TO ProjectDetail
  }

  DROPDOWN statusFilter LABEL "Filter by Status" {
    BIND TO (SELECT ?status ?label WHERE {
      VALUES (?status ?label) {
        (ex:Active   "Active")
        (ex:Archived "Archived")
        (ex:Draft    "Draft")
      }
    })
    DISPLAY ?label
    VALUE ?status
    ON CHANGE CALL filterProjectsByStatus
  }

  LISTVIEW projectTable {
    BIND TO (SELECT ?proj ?name ?status ?owner WHERE {
      ?proj a ex:Project ;
            ex:name   ?name ;
            ex:status ?status ;
            ex:owner  ?owner .
    } ORDER BY ?name)
    COLUMN ?name   LABEL "Project Name"
    COLUMN ?status LABEL "Status"
    COLUMN ?owner  LABEL "Owner"
    ON CLICK ROW CALL selectProject
    ON CLICK ROW NAVIGATE TO ProjectDetail
    SELECTION SINGLE
  }
}

WINDOW ProjectDetail LABEL "Project Detail" {
  FIELD projectName LABEL "Name" {
    BIND TO (SELECT ?name WHERE { ex:currentProject ex:name ?name . })
    EDITABLE
    TYPE TEXT
    ON CHANGE CALL updateProjectName
  }

  FIELD projectStatus LABEL "Status" {
    BIND TO (SELECT ?status WHERE { ex:currentProject ex:status ?status . })
    TYPE IRI
  }

  MULTISELECT memberPicker LABEL "Team Members" {
    BIND TO (SELECT ?person ?name WHERE {
      ?person a ex:Person ; ex:name ?name .
    } ORDER BY ?name)
    DISPLAY ?name
    VALUE ?person
    ON CHANGE CALL updateProjectMembers
  }

  BUTTON btnSave LABEL "Save" {
    ON CLICK CALL saveProject
    NAVIGATE TO ProjectList
  }

  BUTTON btnCancel LABEL "Cancel" {
    NAVIGATE TO ProjectList
  }

  BUTTON btnDelete LABEL "Delete Project" {
    ON CLICK CALL deleteProject
    NAVIGATE TO ProjectList
    ENABLED WHEN (ASK WHERE { ex:currentProject a ex:Project . })
  }
}
```
