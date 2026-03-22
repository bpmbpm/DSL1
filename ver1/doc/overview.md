# System Architecture Overview

## 1. Introduction and Goals

This system is a browser-based programming environment built around semantic web technologies. The central premise is that application data lives in a **tripleStore** (an RDF quad store in TriG format), application logic is written in **PL/SPARQL** (a procedural DSL layered on top of SPARQL), and user interfaces are described in a **UI DSL** that binds widgets to data queries. A browser-based **IDE** hosted on GitHub Pages lets users author all three layers and then translate them into a single, standalone JavaScript file deployable anywhere.

The goals of the system are:

- Provide a **semantic-first** programming model where data is always structured as RDF triples, types are defined in OWL/RDF, and queries are expressed in SPARQL.
- Enable **non-expert** users to author ontologies, logic, and UIs through a unified IDE without leaving the browser.
- Produce **portable output**: a single `.js` bundle (with embedded data) that runs without a server.
- Support a **functional programming** style in the DSL with higher-order functions, immutable bindings, and expression-based control flow, while retaining procedural extensions for practical usability.
- Keep the system **self-hosted**: the IDE itself is the only dependency, and it runs on GitHub Pages with no backend.

---

## 2. System Components

### 2.1 Ontology Layer (OWL/RDF Turtle)

The ontology layer defines the **vocabulary** of an application: its classes (concept types), properties, and constraints. Ontologies are authored in **Turtle** (`.ttl`) format, following OWL 2 conventions.

Key responsibilities:

- Define `owl:Class` resources (concept types such as `Person`, `Invoice`, `Product`).
- Define `owl:ObjectProperty` and `owl:DatatypeProperty` for relationships and data fields.
- Declare `rdfs:range`, `rdfs:domain`, `rdfs:label`, and `rdfs:comment` annotations.
- Support OWL restrictions (`owl:Restriction`, `owl:allValuesFrom`, `owl:maxCardinality`, etc.) for validation.

The IDE includes a **Concept Types Editor** (for classes and properties) and an **Individual Editor** (for named instances). Both editors write back to a Turtle string that is parsed and stored in the in-browser tripleStore.

### 2.2 PL/SPARQL DSL

PL/SPARQL is the primary programming language of the system. It extends SPARQL 1.1 with procedural and functional constructs, enabling developers to write application logic that reads from and writes to the tripleStore.

Key characteristics:

- **SPARQL core**: all SPARQL 1.1 query forms (SELECT, CONSTRUCT, ASK, DESCRIBE), graph patterns (triple patterns, OPTIONAL, FILTER, UNION, BIND), and aggregate functions are valid PL/SPARQL.
- **Procedural extensions**: `FUNCTION` definitions, `let`/`const` bindings, `la-if`/`la-forEach` control flow, and `return`.
- **Functional extensions**: `map`, `filter`, `reduce` work on SPARQL result sets (solution sequences).
- **Graph mutation**: `INSERT DATA`, `DELETE DATA`, `INSERT { } WHERE { }`, `DELETE { } WHERE { }` update the live tripleStore.
- **Naming convention**: constructs borrowed verbatim from JavaScript keep their JS names (`let`, `const`, `return`, `map`, `filter`, `reduce`); constructs that are slightly modified from their JS counterparts are prefixed `la-` (e.g., `la-if`, `la-forEach`).

PL/SPARQL source files use the extension `.plsq`.

### 2.3 UI DSL

The UI DSL is a declarative language for describing user interfaces. Its philosophy is to describe **structure and data binding only** — no colors, no pixel positions, no styling. Presentation concerns are intentionally left to the output environment's CSS.

Key constructs:

| Keyword | Purpose |
|---|---|
| `WINDOW` | Top-level application window/view |
| `BUTTON` | Clickable action trigger |
| `DROPDOWN` | Single-selection combo box |
| `MULTISELECT` | Multiple-selection list |
| `LISTVIEW` | Tabular or item list bound to a query |
| `FIELD` | Single data input or display field |
| `BIND TO` | Attach a SPARQL query as the data source |
| `ON CLICK` | Event handler referencing a PL/SPARQL function |
| `ON CHANGE` | Event handler for value-change events |
| `NAVIGATE TO` | Declarative navigation between windows |

UI DSL source files use the extension `.uidsl`.

### 2.4 Translator

The translator is a pipeline that accepts all three source inputs (Turtle ontology, PL/SPARQL logic, UI DSL) and produces a **single JavaScript file** that runs in any modern browser.

Pipeline stages:

1. **Lexer** — tokenises PL/SPARQL and UI DSL source.
2. **Parser** — builds an Abstract Syntax Tree (AST).
3. **Semantic analyser** — validates references against the ontology.
4. **Code generator** — emits JavaScript using `N3.js` for RDF/SPARQL and standard DOM APIs for the UI.

The translator itself is written in JavaScript and runs inside the IDE (browser-side). There is no server-side compilation step.

### 2.5 Browser-Based IDE

The IDE is a single-page application hosted on GitHub Pages. It is divided into panels:

- **Ontology Editor**: split into a Concept Types pane and an Individuals pane, with a graph visualisation canvas.
- **DSL Code Editor**: a code editor (CodeMirror-based) for PL/SPARQL with syntax highlighting and autocomplete driven by the ontology.
- **UI DSL Editor**: a code editor for UI DSL source.
- **Translate** button: runs the translator pipeline in-browser.
- **Output JS** panel: shows the generated JavaScript, with a copy/download button.
- **Preview** panel: executes the generated JS in a sandboxed `<iframe>`.

---

## 3. Data Storage

### 3.1 TripleStore / QuadStore (TriG Format)

All application data at runtime is stored in an in-browser **quad store** — an RDF dataset where each triple belongs to a named graph (the fourth element). The serialisation format is **TriG**, which is the quad-aware superset of Turtle.

A TriG dataset looks like:

```trig
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Default graph — ontology
{
  ex:Person a owl:Class .
  ex:name a owl:DatatypeProperty ;
    rdfs:domain ex:Person ;
    rdfs:range xsd:string .
}

# Named graph — instance data
<http://example.org/data> {
  ex:alice a ex:Person ;
    ex:name "Alice" .
}
```

At design time, the IDE maintains two logical layers in the store:

| Named Graph | Contents |
|---|---|
| `urn:ontology` | OWL/RDF class and property definitions |
| `urn:data` | Named individual instances |
| `urn:ui` | UI DSL metadata (parsed, stored as RDF) |

At runtime (in the translated JS output), the embedded quad store is initialised from the serialised TriG, then kept live in memory via N3.js `Store` operations.

### 3.2 Persistence in the IDE

The IDE stores the working dataset in the browser's `localStorage` as a TriG string. Users can export/import `.trig` files explicitly. No data is ever sent to a server.

---

## 4. Component Integration

```
┌─────────────────────────────────────────────────────────┐
│                    Browser-Based IDE                    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Ontology    │  │  PL/SPARQL   │  │   UI DSL     │  │
│  │  Editor      │  │  Editor      │  │   Editor     │  │
│  │  (.ttl)      │  │  (.plsq)     │  │  (.uidsl)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
│                           │                             │
│                    ┌──────▼───────┐                     │
│                    │  Translator  │                     │
│                    │  Pipeline    │                     │
│                    └──────┬───────┘                     │
│                           │                             │
│             ┌─────────────┴─────────────┐               │
│             │                           │               │
│      ┌──────▼───────┐           ┌───────▼──────┐        │
│      │  Output JS   │           │   Preview    │        │
│      │  Panel       │           │   (iframe)   │        │
│      └──────────────┘           └──────────────┘        │
└─────────────────────────────────────────────────────────┘
```

The ontology drives autocomplete in both the DSL editor and the UI DSL editor. When the translator runs:

1. The Turtle ontology is parsed with N3.js into an in-browser store.
2. The PL/SPARQL AST nodes referencing ontology terms are validated against that store.
3. UI DSL bindings are checked to ensure their `BIND TO` SPARQL queries are syntactically and semantically valid.
4. The code generator emits a single JS module containing: the serialised TriG data, an N3.js store initialisation, translated logic functions, and DOM-building code for each `WINDOW`.

---

## 5. Technology Stack

| Layer | Technology |
|---|---|
| RDF parsing/serialisation | N3.js (Turtle, TriG, N-Quads) |
| SPARQL query execution | sparqljs (parse) + custom evaluator over N3.js Store |
| Code editing | CodeMirror 6 |
| Graph visualisation | Cytoscape.js |
| IDE hosting | GitHub Pages (static, no server) |
| Output JS runtime | Vanilla browser JS + embedded N3.js + embedded sparqljs |
| Ontology standard | OWL 2 / RDF 1.1 |
| Query language base | SPARQL 1.1 |

All dependencies are bundled into the IDE's single HTML file so it works offline after the first load.

---

## 6. Design Principles

1. **No server required** — every operation from authoring to translation to preview happens in the browser.
2. **Semantic data model** — data is always RDF; there are no ad-hoc JSON schemas.
3. **Separation of concerns** — ontology (structure), PL/SPARQL (logic), UI DSL (presentation structure) are kept in distinct source files and editors.
4. **Functional-first logic** — PL/SPARQL encourages immutable bindings and expression-based programming; mutation is explicit and limited to store operations.
5. **Portable output** — the translated JS has no runtime dependency on the IDE; it is a self-contained application.
6. **Incremental adoption** — users can start with just an ontology and simple SPARQL SELECT queries, then layer on procedural logic and UI descriptions as their application grows.
