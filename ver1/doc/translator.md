# DSL/UI DSL to JavaScript Translator

## 1. Overview

The translator is a **browser-side compilation pipeline** that accepts three source inputs and produces a single, self-contained JavaScript file:

| Input | Format | Description |
|---|---|---|
| Ontology | Turtle (`.ttl`) | OWL/RDF class and property definitions |
| Application logic | PL/SPARQL (`.plsq`) | Functions, queries, mutations |
| User interface | UI DSL (`.uidsl`) | Widget declarations, data bindings, navigation |

| Output | Format | Description |
|---|---|---|
| Application bundle | JavaScript (`.js`) | Standalone browser application |

The output JS file has **no external dependencies at runtime** beyond what is bundled inline (N3.js for RDF store, a minimal SPARQL evaluator). It can be included in any HTML page or served from GitHub Pages.

The translator itself is written in JavaScript and executes entirely in the browser (no server, no build tools required).

---

## 2. Pipeline Stages

```
┌──────────────────────────────────────────────────────────────┐
│                      Translator Pipeline                     │
│                                                              │
│  Turtle ──┐                                                  │
│           ├──► Stage 1: Source Loading & Validation          │
│  .plsq ───┤         ↓                                        │
│           │    Stage 2: Lexical Analysis (Tokenisation)      │
│  .uidsl ──┘         ↓                                        │
│                Stage 3: Parsing (AST Construction)           │
│                     ↓                                        │
│                Stage 4: Semantic Analysis                    │
│                     ↓                                        │
│                Stage 5: Code Generation                      │
│                     ↓                                        │
│                Stage 6: Bundle Assembly                      │
│                     ↓                                        │
│                  Output JS                                   │
└──────────────────────────────────────────────────────────────┘
```

### Stage 1 — Source Loading and Validation

The translator receives the three source strings. Basic sanity checks are performed before any parsing:

- Turtle source is parsed by N3.js. If N3.js throws, the error position (line/column) is reported back to the IDE and the pipeline halts.
- PL/SPARQL source is checked for non-ASCII characters outside string literals (warning only).
- UI DSL source is checked for balanced braces.

All three sources are passed forward as raw strings to Stage 2.

### Stage 2 — Lexical Analysis

Two separate lexers run: one for PL/SPARQL (`.plsq`) and one for UI DSL (`.uidsl`). The Turtle source does not have its own lexer stage — it is handled by N3.js directly.

**PL/SPARQL Lexer** produces a token stream with the following token types:

| Token type | Examples |
|---|---|
| `KEYWORD` | `SELECT`, `WHERE`, `FUNCTION`, `la-if`, `la-forEach`, `let`, `const`, `return`, `map`, `filter`, `reduce`, `INSERT`, `DELETE`, `DRAW` |
| `IRIREF` | `<http://example.org/foo>` |
| `PREFIXED_NAME` | `ex:Person` |
| `VAR` | `?name`, `$x` |
| `LITERAL_STRING` | `"hello"` |
| `LITERAL_INTEGER` | `42` |
| `LITERAL_DECIMAL` | `3.14` |
| `LITERAL_BOOLEAN` | `true`, `false` |
| `IDENTIFIER` | `myFunction`, `count` |
| `PUNCT` | `{`, `}`, `(`, `)`, `[`, `]`, `;`, `.`, `,`, `|` |
| `OPERATOR` | `+`, `-`, `*`, `/`, `%`, `=`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!` |
| `COMMENT` | Stripped from stream |
| `WHITESPACE` | Stripped from stream |

**UI DSL Lexer** produces a simpler token stream with: `KEYWORD`, `IDENTIFIER`, `STRING`, `SPARQL_BLOCK` (the content of `BIND TO (...)` parentheses is passed as a single token for the SPARQL sub-parser), `PUNCT`.

### Stage 3 — Parsing (AST Construction)

A **recursive-descent parser** consumes each token stream and builds an Abstract Syntax Tree.

#### 3.1 PL/SPARQL AST Node Types

```
Program
  PrefixDecl
  FunctionDecl
    Identifier
    ParamList
    Block
      LetStatement | ConstStatement
      ReturnStatement
      LaIfStatement
        Condition
        ThenBlock
        ElseBlock?
      LaForEachStatement
        SourceExpr
        RowVar
        Block
      MapCall | FilterCall | ReduceCall
      InsertDataStatement
      DeleteDataStatement
      InsertDeleteWhereStatement
      ClearStatement
      DrawStatement
  SelectQuery
    SelectClause
    WhereClause
      GroupGraphPattern
        TriplePattern
        OptionalPattern
        FilterExpr
        UnionPattern
        BindClause
        ValuesClause
        SubQuery
        GraphPattern
    SolutionModifier
  InfixExpression
    Operator
    LeftExpr
    RightExpr
  FunctionCall
  Literal
  Variable
  IRIRef
  PrefixedName
```

#### 3.2 UI DSL AST Node Types

```
UIProgram
  PrefixDecl
  InitialWindowDecl
  WindowDecl
    LabelAttr
    OnLoadAttr
    ButtonDecl
      LabelAttr
      OnClickAttr
        FunctionRef
        ArgExpr?
      NavigateAttr
      EnabledWhenAttr
    DropdownDecl
      LabelAttr
      BindToAttr (SelectQuery AST)
      DisplayVar
      ValueVar
      OnChangeAttr
      DefaultValueAttr
    MultiselectDecl (same as Dropdown)
    ListviewDecl
      BindToAttr
      ColumnDecl[]
      OnClickRowAttr
      SelectionAttr
    FieldDecl
      LabelAttr
      BindToAttr
      EditableFlag
      TypeAttr
      OnChangeAttr
    CanvasDecl
      RenderFunctionRef
```

### Stage 4 — Semantic Analysis

The semantic analyser traverses both ASTs simultaneously and validates them against the ontology (loaded by N3.js in Stage 1).

**Checks performed:**

1. **IRI resolution** — every prefixed name in both ASTs is resolved to a full IRI using the declared prefixes. Unresolvable names are errors.

2. **Ontology term validation** — IRIs used as subject/predicate/object in triple patterns are checked against the ontology:
   - Class IRIs used with `rdf:type` are checked to exist in `urn:ontology`.
   - Property IRIs used as predicates are checked to exist.
   - Domain/range compatibility is warned (not errored, to allow flexibility).

3. **Function reference resolution** — every `ON CLICK CALL`, `ON CHANGE CALL`, `RENDER CALL`, and `ON LOAD CALL` reference in the UI DSL must resolve to a `FUNCTION` declared in the PL/SPARQL AST.

4. **Window reference resolution** — every `NAVIGATE TO` identifier must match a declared `WINDOW` name.

5. **Variable binding validation** — within a SPARQL SELECT query, variables used in SELECT clause but not bound in WHERE clause produce a warning.

6. **`BIND TO` query validation** — the SELECT query inside each `BIND TO` is re-parsed by the SPARQL sub-parser and validated for syntax.

7. **`FIELD` single-value check** — fields with `BIND TO` must bind a query that returns exactly one variable (warning if more).

Semantic errors are collected and returned as an array of `{ type, message, location }` objects. Errors halt code generation; warnings do not.

### Stage 5 — Code Generation

The code generator performs a depth-first walk of both ASTs and emits JavaScript strings. It uses a **string builder** (array of fragments joined at the end) for performance.

#### 5.1 PL/SPARQL to JavaScript

**`FUNCTION` → JS function:**
```
# PL/SPARQL
FUNCTION greet(nameIRI) {
  const result = SELECT ?name WHERE { nameIRI ex:name ?name . } ;
  return result[0].name ;
}
```
```javascript
// Generated JS
function greet(nameIRI) {
  const result = __sparqlSelect(
    `SELECT ?name WHERE { ${__iri(nameIRI)} <http://example.org/name> ?name . }`
  );
  return result[0] ? result[0].name.value : undefined;
}
```

**`let`/`const` → JS `let`/`const`:**
Direct translation. The right-hand side is recursively translated.

**`la-if` → JS ternary / if-else:**
`la-if` with a return value is translated to an immediately-invoked arrow function containing an if-else chain, preserving expression semantics:
```javascript
// la-if as expression
const label = (() => {
  if (__sparqlAsk(`ASK WHERE { ... }`)) { return "Active"; }
  else { return "Inactive"; }
})();
```

**`la-forEach` → JS `for...of`:**
```javascript
for (const row of __sparqlSelect(`SELECT ...`)) {
  __sparqlUpdate(`INSERT DATA { ... }`);
}
```

**`map` / `filter` / `reduce` → JS array methods:**
The solution sequence is treated as an array; standard JS array methods are called.
```javascript
const names = __sparqlSelect(`SELECT ?name WHERE ...`).map(row => row.name.value);
```

**SPARQL SELECT → `__sparqlSelect()` call:**
```javascript
const results = __sparqlSelect(`SELECT ?p ?name WHERE { ?p <...rdf-type> <...Person> ; <...name> ?name . }`);
```

**INSERT DATA / DELETE DATA → `__sparqlUpdate()` call:**
```javascript
__sparqlUpdate(`INSERT DATA { GRAPH <urn:data> { <...alice> <...name> "Alice" . } }`);
```

**DRAW primitives → Canvas 2D calls:**
```javascript
// DRAW RECTANGLE (x, y, w, h)
__ctx.strokeRect(x, y, w, h);
// DRAW CIRCLE (cx, cy, r)
__ctx.beginPath(); __ctx.arc(cx, cy, r, 0, 2 * Math.PI); __ctx.stroke();
// DRAW TEXT (x, y, s)
__ctx.fillText(s, x, y);
```

#### 5.2 UI DSL to JavaScript

**`WINDOW` → DOM section:**
```javascript
function __renderWindow_MainMenu() {
  const win = document.createElement('section');
  win.id = 'window-MainMenu';
  // ... child widgets appended
  return win;
}
```

**`BUTTON` → `<button>` element:**
```javascript
const btnNew = document.createElement('button');
btnNew.textContent = 'New Person';
btnNew.addEventListener('click', () => {
  addPersonFunction();
  __navigateTo('PersonForm');
});
```

**`ENABLED WHEN` → disabled attribute reactive check:**
```javascript
function __updateEnabled_btnDelete() {
  btnDelete.disabled = !__sparqlAsk(`ASK WHERE { ... }`);
}
__storeListeners.push(__updateEnabled_btnDelete);
```

**`LISTVIEW` → `<table>` with reactive data:**
```javascript
function __renderListview_invoiceList() {
  const table = document.createElement('table');
  // ... header from COLUMN declarations
  function __refresh() {
    const rows = __sparqlSelect(`SELECT ?inv ?number ...`);
    tbody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      // ... cells from COLUMN variables
      tr.addEventListener('click', () => { openInvoice(row); __navigateTo('InvoiceDetail'); });
      tbody.appendChild(tr);
    });
  }
  __storeListeners.push(__refresh);
  __refresh();
  return table;
}
```

**`DROPDOWN` → `<select>` element:**
```javascript
const departmentPicker = document.createElement('select');
function __refreshDropdown_departmentPicker() {
  const opts = __sparqlSelect(`SELECT ?dept ?label WHERE ...`);
  departmentPicker.innerHTML = '';
  opts.forEach(row => {
    const opt = document.createElement('option');
    opt.value = row.dept.value;
    opt.textContent = row.label.value;
    departmentPicker.appendChild(opt);
  });
}
departmentPicker.addEventListener('change', () => filterByDepartment(departmentPicker.value));
__storeListeners.push(__refreshDropdown_departmentPicker);
__refreshDropdown_departmentPicker();
```

**`FIELD` (editable) → `<input>` element:**
```javascript
const personName = document.createElement('input');
personName.type = 'text';
function __refreshField_personName() {
  const r = __sparqlSelect(`SELECT ?name WHERE { ... }`);
  personName.value = r[0] ? r[0].name.value : '';
}
personName.addEventListener('change', () => updatePersonName(personName.value));
__storeListeners.push(__refreshField_personName);
__refreshField_personName();
```

#### 5.3 Store Reactivity System

All `BIND TO` queries re-run after every store mutation. The code generator emits a listener array (`__storeListeners`) and wraps every `__sparqlUpdate()` call to notify all listeners after the mutation completes:

```javascript
function __sparqlUpdate(query) {
  // ... execute update on __store
  __storeListeners.forEach(fn => fn());
}
```

### Stage 6 — Bundle Assembly

The final output JS is assembled by concatenating:

1. **Minified N3.js** — embedded inline.
2. **Minified SPARQL evaluator** — a lightweight SPARQL 1.1 SELECT/ASK executor built on N3.js `Store`.
3. **Store initialisation** — the serialised TriG dataset is embedded as a string literal; on load, it is parsed into an N3.js `Store` instance (`__store`).
4. **Translated PL/SPARQL functions** — all `FUNCTION` declarations, `let`/`const` top-level bindings.
5. **Translated UI DSL** — `__renderWindow_*` functions for each `WINDOW`.
6. **Application bootstrap** — selects the initial window and appends it to `document.body`.

The bundle is not minified by default (readability is preserved so users can inspect the output). A **"Minify output"** option in the IDE runs a simple whitespace/comment-stripping pass.

---

## 3. How SPARQL Queries Translate to N3.js Calls

The SPARQL evaluator layer wraps N3.js with a minimal executor. It does not use a full SPARQL engine like Comunica (too large); instead it handles the SPARQL patterns most commonly emitted by the translator:

| SPARQL feature | Implementation |
|---|---|
| Triple patterns | `store.getQuads(s, p, o, graph)` |
| `OPTIONAL` | Left outer join via two `getQuads` calls with union logic |
| `FILTER` | Post-filter on result array |
| `UNION` | Concatenate two result arrays, deduplicate |
| `BIND` | Evaluate expression, add variable to each row |
| `VALUES` | Filter rows against explicit value table |
| `ORDER BY` | `Array.sort()` with SPARQL term ordering |
| `LIMIT` / `OFFSET` | `Array.slice()` |
| `GROUP BY` + aggregates | `Array.reduce()` with group accumulator |
| `GRAPH` | Pass graph IRI to `getQuads` |
| Subqueries | Recursive `__sparqlSelect()` call |

`INSERT DATA` / `DELETE DATA` map to `store.addQuads()` / `store.removeQuads()`.
Pattern-based `INSERT/DELETE WHERE` maps to: run SELECT to get matching rows, then batch-add/remove the computed quad sets.

---

## 4. Error Handling and Validation

### 4.1 Error Categories

| Category | Stage | Behaviour |
|---|---|---|
| Turtle parse error | Stage 1 | Pipeline halts; error with line/col shown |
| Lexer error (unknown token) | Stage 2 | Token replaced with `ERROR` node; pipeline continues to collect more errors |
| Parser error | Stage 3 | Attempt error recovery; collect all syntax errors before halting |
| Undefined IRI prefix | Stage 4 | Error; pipeline halts |
| Undefined function reference | Stage 4 | Error; pipeline halts |
| Undefined window reference | Stage 4 | Error; pipeline halts |
| Domain/range violation | Stage 4 | Warning; pipeline continues |
| FIELD multi-value binding | Stage 4 | Warning; pipeline continues |
| Code generation error | Stage 5 | Internal error; reported with AST node reference |

### 4.2 Error Object Format

```javascript
{
  type: "error" | "warning",
  stage: "lexer" | "parser" | "semantic" | "codegen",
  source: "plsq" | "uidsl" | "turtle",
  message: "Human-readable description",
  line: 42,
  column: 15,
  nodeType: "FunctionCall"   // AST node type, if applicable
}
```

### 4.3 IDE Error Display

Errors are shown in the IDE's **Diagnostics panel** below the editors. Each error is a clickable item that jumps to the relevant line in the appropriate editor panel. Warnings are shown in amber; errors in red.

---

## 5. Translator API

The translator exposes a single JavaScript function:

```javascript
/**
 * Translate PL/SPARQL + UI DSL + Turtle ontology to standalone JS.
 *
 * @param {string} turtleSource   - OWL/RDF ontology in Turtle format
 * @param {string} plsqSource     - PL/SPARQL application logic
 * @param {string} uidslSource    - UI DSL widget declarations
 * @param {string} trigData       - TriG instance data (optional)
 * @param {object} options        - { minify: boolean, targetElement: string }
 * @returns {{ js: string|null, errors: Error[], warnings: Error[] }}
 */
function translate(turtleSource, plsqSource, uidslSource, trigData, options) { ... }
```

The IDE calls this function when the user clicks **Translate**. The returned `js` string is displayed in the Output JS panel and run in the Preview iframe.

---

## 6. Example: End-to-End Translation

### Input: Turtle (ontology)

```turtle
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
ex:Task a owl:Class .
ex:title a owl:DatatypeProperty ; rdfs:domain ex:Task ; rdfs:range xsd:string .
ex:done  a owl:DatatypeProperty ; rdfs:domain ex:Task ; rdfs:range xsd:boolean .
```

### Input: PL/SPARQL (`.plsq`)

```
PREFIX ex: <http://example.org/>

FUNCTION markDone(taskIRI) {
  INSERT DATA { GRAPH <urn:data> { taskIRI ex:done true . } }
}
```

### Input: UI DSL (`.uidsl`)

```
PREFIX ex: <http://example.org/>
WINDOW TaskList LABEL "Tasks" {
  LISTVIEW tasks {
    BIND TO (SELECT ?t ?title WHERE { ?t a ex:Task ; ex:title ?title . })
    COLUMN ?title LABEL "Task"
    ON CLICK ROW CALL markDone
  }
}
```

### Output: JavaScript (simplified)

```javascript
// [N3.js embedded]
// [SPARQL evaluator embedded]

const __store = new N3.Store();
// [TriG data parsed and loaded into __store]

function markDone(row) {
  __sparqlUpdate(
    `INSERT DATA { GRAPH <urn:data> { ${row.t.value} <http://example.org/done> true . } }`
  );
}

function __renderWindow_TaskList() {
  const section = document.createElement('section');
  section.id = 'window-TaskList';

  const h1 = document.createElement('h1');
  h1.textContent = 'Tasks';
  section.appendChild(h1);

  const table = document.createElement('table');
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  ['Task'].forEach(h => { const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th); });
  const tbody = table.createTBody();

  function __refresh() {
    tbody.innerHTML = '';
    __sparqlSelect(
      'SELECT ?t ?title WHERE { ?t <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/Task> ; <http://example.org/title> ?title . }'
    ).forEach(row => {
      const tr = tbody.insertRow();
      const td = tr.insertCell(); td.textContent = row.title.value;
      tr.addEventListener('click', () => markDone(row));
    });
  }

  __storeListeners.push(__refresh);
  __refresh();
  section.appendChild(table);
  return section;
}

const __storeListeners = [];
document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(__renderWindow_TaskList());
});
```
