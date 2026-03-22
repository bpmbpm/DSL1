# Building the Calculator with DSL1
## A Step-by-Step Tutorial

*Inspired by the BPMN Runa WFE "Hello, Calculator" walkthrough.*

---

## Table of Contents

1. [System Prerequisites](#1-system-prerequisites)
2. [Project Layout](#2-project-layout)
3. [Creating the Base Ontology](#3-creating-the-base-ontology)
4. [Creating the Calculator Ontology](#4-creating-the-calculator-ontology)
5. [Writing the PL/SPARQL DSL Code](#5-writing-the-plsparql-dsl-code)
6. [Writing the UI DSL](#6-writing-the-ui-dsl)
7. [Running the Translator](#7-running-the-translator)
8. [Testing the Output](#8-testing-the-output)
9. [Deploying to GitHub Pages](#9-deploying-to-github-pages)
10. [Troubleshooting](#10-troubleshooting)
11. [Next Steps](#11-next-steps)

---

## 1. System Prerequisites

Before you begin, ensure the following tools are installed and accessible on
your `PATH`.

### 1.1 Runtime Requirements

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Node.js | 20 LTS | PL/SPARQL translator runtime |
| npm | 10 | Package management |
| Apache Jena / Fuseki | 4.9 | SPARQL tripleStore for local dev |
| Git | 2.40 | Version control and GitHub Pages deploy |

### 1.2 DSL1 Toolchain

Clone the DSL1 repository and install its npm dependencies:

```bash
git clone https://github.com/bpmbpm/DSL1.git
cd DSL1
npm install
```

Verify the installation:

```bash
npx dsl1 --version
# Expected output: dsl1 v1.0.0
```

### 1.3 Ontology Tooling (optional but recommended)

- **Protégé 5.6** — desktop ontology editor for browsing and validating `.ttl`
  files visually.
- **rapper / riot** — command-line RDF validators:

```bash
# Debian/Ubuntu
sudo apt install raptor2-utils

# Validate a Turtle file
rapper -i turtle -o ntriples ver1/ontology/base.ttl
```

### 1.4 Browser Requirements for Testing

Any modern browser (Chrome 120+, Firefox 121+, Safari 17+) is sufficient.
No browser extensions are needed; the translator outputs vanilla ES2022.

---

## 2. Project Layout

After cloning DSL1 and creating the calculator example, your directory tree
should look like this:

```
ver1/
├── ontology/
│   ├── base.ttl              ← foundational OWL/RDF ontology
│   └── calculator.ttl        ← calculator domain ontology
├── examples/
│   └── calculator/
│       ├── calculator.dsl    ← PL/SPARQL business logic
│       ├── calculator.uidsl  ← UI DSL bindings
│       ├── instructions.md   ← this file
│       └── dist/             ← translator output (generated)
│           ├── index.html
│           ├── calculator.js
│           └── calculator.store.trig
└── readme.md
```

Create the `dist` directory now so the translator can write into it:

```bash
mkdir -p ver1/examples/calculator/dist
```

---

## 3. Creating the Base Ontology

The base ontology (`ver1/ontology/base.ttl`) provides the shared vocabulary
used by every domain ontology in the system.

### 3.1 Key Decisions

**Namespace choice:**
The base IRI `https://github.com/bpmbpm/DSL1/ontology#` acts as both a
human-readable documentation URL and a globally unique identifier.  Never
change this IRI once instances are stored, because it forms part of every
individual's identity in the tripleStore.

**owl:Ontology declaration:**
Always include `owl:versionIRI` so reasoners and tools can distinguish
ontology versions without comparing content.

**Annotation properties for DSL binding:**
`dsl:dslFunction`, `dsl:dslUIComponent`, `dsl:bindExpression`, and
`dsl:displayTemplate` are annotation properties added to classes and
individuals.  The translator reads them to generate default UI scaffolding
automatically.

### 3.2 Editing the Base Ontology

Open `ver1/ontology/base.ttl` in a text editor or in Protégé.

To add a new core class:

```turtle
dsl:MyNewConcept
    a owl:Class ;
    rdfs:label "My New Concept" ;
    rdfs:comment "What this concept represents." ;
    rdfs:subClassOf dsl:Entity ;
    dsl:dslUIComponent "FIELD" .
```

Save the file and validate:

```bash
rapper -i turtle ver1/ontology/base.ttl > /dev/null && echo "Valid"
```

---

## 4. Creating the Calculator Ontology

### 4.1 Design the Class Hierarchy

The calculator ontology imports the base ontology and defines six classes:

```
dsl:Application
  └── calc:Calculator

dsl:Process
  └── calc:Operation

dsl:Value
  ├── calc:Operand
  └── calc:Result

ui:Button
  └── calc:Button

ui:Field
  └── calc:Display
```

Open `ver1/ontology/calculator.ttl` in Protégé.  In the **Classes** tab
verify the hierarchy appears as above.

### 4.2 Declare Properties

For each data property, always specify:
- `rdfs:domain` — which class the property applies to
- `rdfs:range` — the XSD datatype or target class
- `owl:FunctionalProperty` — when at most one value per instance is expected

Example for `calc:operationName`:

```turtle
calc:operationName
    a owl:DatatypeProperty , owl:FunctionalProperty ;
    rdfs:domain calc:Operation ;
    rdfs:range  xsd:string .
```

### 4.3 Assert Operation Individuals

The four arithmetic operations are static knowledge asserted in the ontology
itself (not loaded at runtime).  This is intentional: the set of basic
arithmetic operations is closed and unlikely to change.

```turtle
calc:addOperation
    a calc:Operation , owl:NamedIndividual ;
    rdfs:label "Addition" ;
    calc:operationName   "add" ;
    calc:operationSymbol "+" ;
    dsl:order 1 .
```

Repeat for `subtractOperation`, `multiplyOperation`, `divideOperation`.

### 4.4 Assert Button Individuals

Each button individual links back to its corresponding operation via
`dsl:triggers`:

```turtle
calc:plusButton
    a calc:Button , owl:NamedIndividual ;
    calc:buttonLabel "+" ;
    calc:buttonOrder 1^^xsd:integer ;
    dsl:triggers calc:addOperation .
```

### 4.5 Load the Ontology into Fuseki

Start Fuseki in-memory mode:

```bash
fuseki-server --update --mem /calculator
```

Upload the ontologies using the Fuseki web UI at `http://localhost:3030` or
with curl:

```bash
# Upload base ontology
curl -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @ver1/ontology/base.ttl \
  "http://localhost:3030/calculator/data?graph=https://github.com/bpmbpm/DSL1/ontology"

# Upload calculator ontology
curl -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @ver1/ontology/calculator.ttl \
  "http://localhost:3030/calculator/data?graph=calculator"
```

Verify the upload:

```bash
curl -s -G "http://localhost:3030/calculator/sparql" \
  --data-urlencode "query=SELECT (COUNT(*) AS ?n) WHERE { GRAPH <calculator> { ?s ?p ?o } }" \
  -H "Accept: application/sparql-results+json"
```

You should see a count greater than zero.

---

## 5. Writing the PL/SPARQL DSL Code

The file `ver1/examples/calculator/calculator.dsl` contains all business
logic for the calculator.

### 5.1 Module Header

Every `.dsl` file begins with PREFIX declarations (mirroring SPARQL) and a
`USE GRAPH` directive that sets the default named graph for the module:

```sparql
PREFIX calc: <https://github.com/bpmbpm/DSL1/ontology/calculator#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

USE GRAPH <calculator>
```

### 5.2 FUNCTION Syntax

A `FUNCTION` block looks like a SPARQL-augmented JavaScript function:

```
FUNCTION functionName(param1, param2) {
  // PL/SPARQL body
  return expression
}
```

- Parameters are untyped at the DSL level; the translator infers types from
  usage context and ontology range declarations.
- The body may contain `let` bindings, `la-if` branches, `la-forEach` loops,
  inline `SELECT` blocks, and `INSERT`/`DELETE` statements.

### 5.3 The la-if Construct

`la-if` is syntactically identical to a JS `if` statement, but the DSL
evaluator coerces the condition through the SPARQL effective boolean value
(EBV) rules before branching.  This ensures that an empty string, zero, or an
RDF literal `"false"^^xsd:boolean` all evaluate to false consistently:

```
la-if (operationType === "divide") {
  la-if (operand2 === 0) {
    return "Error: Division by zero"
  }
  return operand1 / operand2
}
```

Plain JS `if` is reserved for cases where no SPARQL EBV coercion is needed
(e.g. checking JavaScript `typeof`).

### 5.4 Inline SPARQL SELECT

Inside a FUNCTION body, a bare `SELECT ... WHERE { }` block executes against
the tripleStore and binds its result set to the enclosing `let`:

```
let rows = SELECT ?resultVal WHERE {
  GRAPH <calculator> {
    ?result a calc:Result .
    ?result calc:resultValue ?resultVal .
  }
}
LIMIT 5
```

The variable `rows` becomes an array of binding objects accessible as
`rows[0].resultVal`, etc.

### 5.5 GENERATE_IRI

`GENERATE_IRI(calc:Result)` mints a fresh IRI in the `calc:` namespace
using a UUID-based local name, e.g.
`calc:Result_3f7a2c91-e4b8-4f1a-a9d0-1c2b3d4e5f67`.  This is the standard
way to create new individuals from within PL/SPARQL without needing a
server-side auto-increment.

### 5.6 INSERT INTO GRAPH

Writes new triples to a named graph:

```
INSERT INTO GRAPH <calculator> {
  resultId a calc:Result .
  resultId calc:resultValue result .
}
```

Note that variables and `let`-bound identifiers are used directly without `?`
prefix inside `INSERT` blocks — the `?` prefix is only used inside `SELECT`
and `WHERE` clauses to distinguish SPARQL variables from PL/SPARQL bindings.

### 5.7 la-forEach

Iterates over a result set array with SPARQL-variable syntax for the loop
variable:

```
la-forEach (rows AS ?row) {
  total = total + ?row.resultVal
}
```

This is equivalent to JS `for...of` but the `?row` notation makes clear that
each element is a SPARQL binding object rather than a plain JS object.

---

## 6. Writing the UI DSL

The file `ver1/examples/calculator/calculator.uidsl` wires together the
calculator's visual components and the PL/SPARQL functions.

### 6.1 WINDOW Declaration

Every UI entry point is a `WINDOW`:

```
WINDOW calculatorWindow {
  TITLE  "Calculator"
  WIDTH  480
  HEIGHT 640
  ...
}
```

The translator maps each `WINDOW` to an HTML `<section>` or `<dialog>`
element together with a JavaScript module that manages its lifecycle.

### 6.2 FIELD Binding

A `FIELD` with `BIND TO` attaches a live subscription to a PL/SPARQL query.
When the underlying data in the tripleStore changes, the field re-renders
automatically:

```
FIELD display {
  LABEL    "Result"
  TYPE     text
  READONLY true
  BIND TO  getHistory()
  DISPLAY  ?resultVal
}
```

A `FIELD` without `BIND TO` (like `operand1`) is a plain input, and its value
is accessed from ON CLICK handlers as `operand1.value`.

### 6.3 DROPDOWN with BIND TO

A `DROPDOWN`'s option list is populated by a `BIND TO` clause.  `DISPLAY`
controls the text shown to the user; `VALUE` controls the internal value
passed to PL/SPARQL functions:

```
DROPDOWN operationType {
  BIND TO  getOperations()
  DISPLAY  ?symbol
  VALUE    ?label
}
```

### 6.4 ON CLICK Blocks

`ON CLICK` bodies execute PL/SPARQL expressions.  Call DSL functions directly
by name; use `SHOW ALERT` and `SHOW CONFIRM` for user feedback; call
`.REFRESH()` on list views or labels to re-execute their `BIND TO` query:

```
BUTTON calculateBtn {
  ON CLICK {
    let result = calculate(operand1.value, operand2.value, operationType.value)
    display.value = formatResult(result, 10)
    storeResult(operand1.value, operand2.value, operationType.value, result)
    historyView.REFRESH()
  }
}
```

### 6.5 LISTVIEW Columns

`COLUMNS` is an array of column descriptor objects.  Each column specifies a
header string, the SPARQL variable to project (`VALUE ?varName`), optional
`WIDTH`, `ALIGN`, and `FORMAT` hints:

```
LISTVIEW historyView {
  BIND TO getHistory()
  COLUMNS [
    { HEADER "Op 1"    VALUE ?op1Val    WIDTH 100 },
    { HEADER "Symbol"  VALUE ?symbol    WIDTH 50  ALIGN center },
    { HEADER "Op 2"    VALUE ?op2Val    WIDTH 100 },
    { HEADER "Result"  VALUE ?resultVal WIDTH 120 }
  ]
}
```

---

## 7. Running the Translator

The DSL1 translator (`dsl1 translate`) converts `.dsl` and `.uidsl` files into
browser-ready JavaScript and HTML.

### 7.1 Basic Translation

From the repository root:

```bash
npx dsl1 translate \
  --dsl      ver1/examples/calculator/calculator.dsl \
  --uidsl    ver1/examples/calculator/calculator.uidsl \
  --ontology ver1/ontology/calculator.ttl \
  --base     ver1/ontology/base.ttl \
  --out      ver1/examples/calculator/dist \
  --target   browser-es2022
```

Successful output:

```
[dsl1] Parsing calculator.dsl          ... OK
[dsl1] Parsing calculator.uidsl        ... OK
[dsl1] Loading ontology                ... OK  (42 triples)
[dsl1] Generating JS                   ... OK
[dsl1] Generating HTML scaffold        ... OK
[dsl1] Writing dist/index.html         ... OK
[dsl1] Writing dist/calculator.js      ... OK
[dsl1] Writing dist/calculator.store.trig ... OK
[dsl1] Translation complete.
```

### 7.2 Watch Mode

During development, use `--watch` to retranslate on every file save:

```bash
npx dsl1 translate \
  --dsl   ver1/examples/calculator/calculator.dsl \
  --uidsl ver1/examples/calculator/calculator.uidsl \
  --out   ver1/examples/calculator/dist \
  --watch
```

### 7.3 Translator Flags

| Flag | Description |
|------|-------------|
| `--target browser-es2022` | Output modern ES modules (default) |
| `--target browser-es5` | Output ES5 with Babel transpilation |
| `--inline-store` | Embed initial tripleStore data in the JS bundle |
| `--minify` | Minify the output JS |
| `--sourcemap` | Emit source maps for debugging |
| `--strict` | Treat all warnings as errors |

### 7.4 Understanding the Generated Output

**`dist/index.html`** — A minimal HTML5 shell that loads the JS module and
mounts the calculator window.

**`dist/calculator.js`** — All translated PL/SPARQL functions as ES module
exports.  Each `FUNCTION` block becomes an `async` JS function because
tripleStore reads are asynchronous.

**`dist/calculator.store.trig`** — The initial quad-store state serialised in
TriG format.  In the browser, this is loaded into an in-memory N3.js store on
application startup.  The store is persisted to `localStorage` on page unload.

---

## 8. Testing the Output

### 8.1 Serve Locally

Because the generated code uses ES modules, you need an HTTP server (not
`file://` URLs):

```bash
# Using npx serve (zero-config)
npx serve ver1/examples/calculator/dist

# Or with Python
python3 -m http.server 8080 --directory ver1/examples/calculator/dist
```

Open `http://localhost:3000` (or `:8080`) in your browser.

### 8.2 Manual Test Checklist

Work through each of these scenarios to confirm the calculator works correctly:

- [ ] **Addition:** Enter `12` + `8` → expect `20`
- [ ] **Subtraction:** Enter `100` - `37` → expect `63`
- [ ] **Multiplication:** Enter `6` * `7` → expect `42`
- [ ] **Division:** Enter `22` / `7` → expect `3.1428571428`
- [ ] **Division by zero:** Enter `5` / `0` → expect error message
- [ ] **Empty inputs:** Click Calculate with blank fields → expect alert
- [ ] **History list:** Confirm each calculation appears in the LISTVIEW
- [ ] **Operation frequency:** Confirm counts increment correctly
- [ ] **Clear button:** Confirm fields reset without affecting history
- [ ] **Clear history:** Confirm LISTVIEW empties; confirm confirm dialog fires

### 8.3 Browser DevTools Inspection

Open the browser console and inspect the in-memory store:

```javascript
// Access the running DSL1 store instance
const store = window.__dsl1Store

// Count all Result individuals
const count = store.countQuads(null, null, null, 'calculator')
console.log('Triples in <calculator>:', count)

// Dump all results
store.forEach(quad => console.log(quad.toString()),
              null, null, null, store.namedNode('calculator'))
```

### 8.4 Automated Tests (optional)

If the repository includes a test runner:

```bash
npx dsl1 test ver1/examples/calculator/ --reporter spec
```

Write custom test assertions in `calculator.test.dsl`:

```
TEST "addition of positive integers" {
  ASSERT calculate(3, 4, "add") === 7
}
TEST "division by zero returns error string" {
  ASSERT calculate(1, 0, "divide").startsWith("Error")
}
```

---

## 9. Deploying to GitHub Pages

### 9.1 Repository Setup

Ensure your fork of DSL1 has GitHub Pages enabled:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to `GitHub Actions`.

### 9.2 Manual Deploy

Copy the `dist` folder contents to your GitHub Pages branch:

```bash
# From the repository root
git checkout --orphan gh-pages
git reset --hard
cp -r ver1/examples/calculator/dist/* .
git add .
git commit -m "Deploy calculator example to GitHub Pages"
git push origin gh-pages
git checkout main
```

Your calculator will be live at:
`https://<your-username>.github.io/DSL1/`

### 9.3 Automated Deploy with GitHub Actions

Create `.github/workflows/deploy-calculator.yml`:

```yaml
name: Deploy Calculator to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'ver1/examples/calculator/**'
      - 'ver1/ontology/**'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Translate DSL to browser JS
        run: |
          npx dsl1 translate \
            --dsl      ver1/examples/calculator/calculator.dsl \
            --uidsl    ver1/examples/calculator/calculator.uidsl \
            --ontology ver1/ontology/calculator.ttl \
            --base     ver1/ontology/base.ttl \
            --out      ver1/examples/calculator/dist \
            --target   browser-es2022 \
            --minify

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ver1/examples/calculator/dist

      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

Push this file to `main` and the workflow will trigger automatically on every
commit that touches the calculator or ontology files.

### 9.4 Verifying the Deployment

After the workflow completes (typically 2–3 minutes):

1. Open `https://<your-username>.github.io/DSL1/`.
2. Open **DevTools → Network** and confirm `calculator.js` and
   `calculator.store.trig` load with HTTP 200.
3. Run the manual test checklist from section 8.2.

---

## 10. Troubleshooting

### Turtle parse error

```
rapper: Error - turtle parse error at line N: ...
```

**Fix:** Check for missing semicolons between property-value pairs or a
missing `.` at the end of a statement block.  Open in Protégé for a
highlighted error.

### SPARQL query returns empty results

Verify the named graph is spelled consistently.  `GRAPH <calculator>` and
`GRAPH <Calculator>` are different IRIs.  Check the Fuseki UI at
`http://localhost:3030` → **Dataset** → **query** to inspect graph contents.

### Translator: "Unknown function" warning

If the translator reports an unknown function name in a `BIND TO` clause,
ensure the `USE DSL` directive at the top of the `.uidsl` file points to the
correct `.dsl` file path relative to the workspace root.

### Browser: "Cannot use import statement outside a module"

The generated `calculator.js` uses ES module syntax.  Ensure `index.html`
loads it with `<script type="module">`, and that you are serving via HTTP,
not opening `file://`.

### History not persisting across page reloads

By default, the in-memory N3.js store is saved to `localStorage` only on
`window.beforeunload`.  If the page crashes or is force-closed, data may be
lost.  Use the `--inline-store` translator flag to bake initial ontology data
into the bundle, and consider adding periodic `localStorage` flushes in an
extended ON CLICK block.

---

## 11. Next Steps

With the calculator working end-to-end, you can:

- **Extend the ontology** — add a `calc:MemorySlot` class and `memoryStore` /
  `memoryRecall` functions to implement MS/MR/MC buttons.
- **Add a second window** — create a `statisticsWindow` that shows
  `getOperationFrequency()` as a bar chart using a `CHART` UI DSL component.
- **Explore the task-manager example** — see how `la-forEach`, multi-window
  navigation, and status-filter queries scale to a CRUD application.
- **Write a custom translator plugin** — if you need to target React or Vue
  instead of vanilla DOM, the translator exposes a plugin API for custom
  component code generators.
- **Contribute to the DSL1 project** — open issues, submit PRs, or add your
  own domain ontology under `ver1/examples/`.

---

*End of instructions.md*
