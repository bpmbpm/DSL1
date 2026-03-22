# DSL1 — Comparative Analysis and Development Roadmap

---

## Part 1: Comparison with Similar Approaches

DSL1 is a semantics-first application development platform that combines OWL/RDF ontology
modelling, a procedural SPARQL extension (PL/SPARQL), a declarative UI binding language,
and a single-file browser IDE. The following sections compare DSL1 to eight families of
related technology, examining similarities, differences, strengths, and weaknesses.

---

### 1. BPMN / Camunda (Executable Business Process Modelling)

#### What it is
BPMN (Business Process Model and Notation) is a graphical standard for describing business
processes as flowcharts of tasks, gateways, and events. Camunda is the leading open-source
BPMN engine: it parses BPMN 2.0 XML, deploys processes to a server, and executes them by
routing human tasks, service calls, and decision tables through a workflow runtime.

#### Similarities with DSL1
- Both are declarative/semi-declarative: you describe *what* should happen in structured
  notation rather than writing raw imperative code.
- Both support data-driven branching (BPMN gateways ≈ DSL1 `la-if` blocks).
- Both can be connected to external services (BPMN service tasks ≈ DSL1 functions calling
  remote SPARQL endpoints).
- Both aim to close the gap between business analyst intent and running software.

#### Differences
| Aspect | BPMN / Camunda | DSL1 |
|--------|---------------|------|
| Primary model | Process flow (sequence of activities) | Knowledge graph (entities and relations) |
| Data model | Java objects / JSON in process variables | OWL/RDF triples in a quad store |
| Execution environment | JVM / Docker server process | Browser + JavaScript (client-side) |
| UI | Camunda Tasklist (generic form engine) | Custom UI DSL with rich widget bindings |
| Schema | BPMN 2.0 XML | OWL Turtle + PL/SPARQL |
| Persistence | Relational DB (H2, PostgreSQL) | TriG quad store |
| Learning curve | High (BPMN notation, Java, REST APIs) | Medium (SPARQL + DSL syntax) |

#### Strengths of BPMN/Camunda
- Industry-standard notation understood by non-developers
- Robust long-running process management (timers, compensation, escalation)
- Excellent tooling ecosystem (Modeler, Cockpit, Optimize)
- Enterprise-grade scalability and auditability

#### Weaknesses of BPMN/Camunda
- Heavy infrastructure (JVM, database, server)
- Poor fit for data-centric (non-process) applications
- No native semantic web integration; schema is implicit in variables
- BPMN XML is verbose and hard to version in plain text

---

### 2. Low-Code / No-Code Platforms (OutSystems, Mendix, AppSmith)

#### What they are
Low-code platforms provide visual IDE environments where developers drag-and-drop UI
components, define data models in visual entity diagrams, and wire business logic through
GUI action flows. OutSystems and Mendix target enterprise application development;
AppSmith targets internal tooling.

#### Similarities with DSL1
- Both provide an integrated IDE combining data model + logic + UI.
- Both generate runnable applications from higher-level descriptions.
- Both separate the data binding concern (what data goes where) from layout styling.
- Both support CRUD operations as first-class primitives.

#### Differences
| Aspect | Low-code platforms | DSL1 |
|--------|-------------------|------|
| Data model | Proprietary entity diagram / ORM | OWL/RDF ontology (open standard) |
| Logic expression | Visual flowcharts or proprietary scripting | PL/SPARQL text language |
| Portability | Vendor lock-in; output tied to platform | Open formats (Turtle, SPARQL, HTML) |
| AI-friendliness | Not designed for LLM generation | Text-based DSL, ideal for LLM output |
| Semantic reasoning | None | OWL reasoning possible over ontology |
| Deployment | Platform cloud or on-premise runtime | Static HTML, GitHub Pages compatible |
| Cost | Expensive commercial licences | Open / self-hosted |

#### Strengths of low-code platforms
- Extremely fast for common CRUD applications
- No coding skill required for basic apps
- Mature marketplace of connectors (SAP, Salesforce, etc.)
- Automated deployment pipelines

#### Weaknesses of low-code platforms
- Black-box execution; hard to debug or extend
- Vendor lock-in for data, logic, and UI
- Poor semantic interoperability (cannot query across platforms)
- Not machine-writable — LLMs cannot reliably generate proprietary visual models

---

### 3. RDF/SPARQL Tooling (Apache Jena, Virtuoso, GraphDB)

#### What they are
These are triple/quad store databases with SPARQL query engines. Apache Jena is a Java
library and Fuseki is its HTTP SPARQL endpoint server. Virtuoso is a hybrid
relational/RDF store. GraphDB (Ontotext) is a commercial OWL reasoning triple store.
All provide SPARQL 1.1 SELECT/UPDATE and expose HTTP APIs.

#### Similarities with DSL1
- DSL1's data layer is architecturally identical to these stores (TriG quad store format).
- DSL1 PL/SPARQL is a superset of SPARQL 1.1; any standard SPARQL query is valid inside
  a DSL1 function body.
- Ontologies in Turtle format are portable between DSL1 and any of these systems.
- Named graphs are used in all these systems for dataset partitioning.

#### Differences
| Aspect | Jena / Virtuoso / GraphDB | DSL1 |
|--------|--------------------------|------|
| Execution environment | Server JVM / C++ process | Browser (JavaScript) |
| UI development | Not provided | First-class UI DSL |
| Procedural logic | None (pure query/update) | PL/SPARQL with la-if, la-forEach, map/filter/reduce |
| Storage | Persistent server-side store | In-memory or browser IndexedDB / localStorage |
| Deployment | Docker / cloud server | Static HTML file |
| Scale | Billions of triples | Millions of triples (client-side) |
| Standards compliance | Full SPARQL 1.1 | Extended SPARQL subset |

#### Strengths of traditional triple stores
- Production-grade scalability and durability
- Full SPARQL 1.1 compliance including federated queries (SERVICE keyword)
- OWL entailment / reasoning (RDFS, OWL-Horst, OWL-RL profiles)
- Mature transaction and access control features

#### Weaknesses of traditional triple stores
- Require dedicated server infrastructure
- No built-in UI layer
- SPARQL alone is not a complete application language
- Steep learning curve for non-semantic-web developers

---

### 4. OWL / Protégé Workflow

#### What it is
Protégé is the dominant desktop/web ontology editor for OWL. Ontologists use it to define
class hierarchies, property restrictions, and individuals, and to run OWL reasoners
(HermiT, Pellet, FaCT++) for consistency checking and automatic classification.
Protégé is primarily a knowledge engineering tool, not an application development platform.

#### Similarities with DSL1
- Both use OWL/RDF as the canonical data model.
- Both support Turtle as an authoring format.
- Both are oriented around classes, properties, and individuals as primary concepts.
- DSL1's IDE and Protégé both provide forms for editing ontology entities.

#### Differences
| Aspect | Protégé | DSL1 |
|--------|---------|------|
| Purpose | Knowledge engineering / ontology design | Application development |
| Output | Ontology file (no runnable app) | Running browser application |
| Reasoning | Full OWL DL reasoning (HermiT, Pellet) | No built-in reasoner |
| UI | Generic property editor | Custom UI DSL with domain-specific widgets |
| Logic | None (ontology only) | PL/SPARQL functions |
| Audience | Knowledge engineers / ontologists | Application developers |

#### Strengths of Protégé
- Gold-standard tool for ontology authoring
- Deep OWL DL support including restrictions, cardinality, nominals
- Plugin ecosystem (SWRL, SPARQL query, visualization)
- Widely used and documented in academic and enterprise settings

#### Weaknesses of Protégé
- Produces ontologies, not applications
- Desktop Java app; no browser or mobile deployment
- No data persistence layer for instance data
- No UI binding or business logic capabilities

---

### 5. XSLT / Declarative XML Transformation

#### What it is
XSLT (Extensible Stylesheet Language Transformations) is a declarative language for
transforming XML documents into other XML, HTML, or text formats. Coupled with XPath for
addressing XML nodes, XSLT is used for data transformation pipelines, report generation,
and (historically) generating HTML pages from XML data.

#### Similarities with DSL1
- Both are declarative transformation languages: you describe output structure, not
  imperative steps.
- XSLT templates ≈ DSL1 UI widget bindings (match a data pattern, produce output).
- XSLT's `xsl:choose` / `xsl:if` are analogous to DSL1's `la-if`.
- XSLT's `xsl:for-each` is analogous to `la-forEach`.

#### Differences
| Aspect | XSLT | DSL1 |
|--------|------|------|
| Input data model | XML tree | RDF graph (triples) |
| Query language | XPath | SPARQL |
| Output | Static transformed document | Live reactive UI |
| Interactivity | None (transformation only) | Full event-driven UI binding |
| Data mutation | None (pure functional) | INSERT/DELETE SPARQL updates |
| Tooling | XML editors, browsers (limited) | Browser IDE |

#### Strengths of XSLT
- Mature, standardised (XSLT 2.0/3.0), excellent tooling
- Pure functional: predictable, testable transformations
- Broad deployment (any XML-capable platform)
- Powerful for document transformation and reporting

#### Weaknesses of XSLT
- Not designed for interactive applications
- XML data model is verbose and less expressive than RDF
- No semantic typing or ontological reasoning
- Syntax is complex (XML-in-XML) and difficult for LLMs to generate reliably

---

### 6. GraphQL Schema + Resolvers

#### What it is
GraphQL is a query language for APIs. A server exposes a typed schema (SDL — Schema
Definition Language) defining object types and their fields. Clients send queries specifying
exactly which fields they need; the server runs resolver functions to fetch data for each
field. The GraphQL approach has become dominant for frontend–backend API design.

#### Similarities with DSL1
- GraphQL SDL types ≈ DSL1 OWL classes (typed entities with named fields).
- GraphQL resolver functions ≈ DSL1 PL/SPARQL FUNCTION definitions.
- GraphQL query field selection ≈ DSL1 SELECT clause.
- Both separate the data schema concern from the UI concern.
- Both are designed for client-side data consumption.

#### Differences
| Aspect | GraphQL | DSL1 |
|--------|---------|------|
| Data model | Typed schema (SDL) | OWL ontology (open standard, inferrable) |
| Query semantics | Tree-structured field selection | Graph pattern matching |
| Data storage | Any backend (SQL, NoSQL, REST) | RDF quad store |
| Semantic richness | No formal semantics | OWL class hierarchy, property domains/ranges |
| UI layer | Not provided | UI DSL |
| Mutation | Mutation operations | INSERT/DELETE SPARQL Update |
| Reasoning | None | OWL reasoning possible |

#### Strengths of GraphQL
- Excellent developer experience; typed, self-documenting APIs
- Efficient: clients request only needed fields (no over-fetching)
- Massive ecosystem (Apollo, Relay, Hasura)
- Works with any existing data source

#### Weaknesses of GraphQL
- No formal semantics; types are structural, not ontological
- Requires a server process; not deployable as a static file
- Does not support knowledge-graph-style traversal natively
- Schema changes require careful API versioning

---

### 7. Semantic Web Application Frameworks (Linked Data, LDViewer, SOLID)

#### What they are
The Semantic Web stack includes Linked Data principles (HTTP URIs, RDF, SPARQL, OWL),
SOLID (Social Linked Data — Tim Berners-Lee's personal data pod architecture),
and viewer/application frameworks like LDViewer, Comunica, and Mashlib that render
RDF data from arbitrary sources as web applications.

#### Similarities with DSL1
- Both use RDF/OWL as the canonical data model.
- Both are oriented toward decentralised, URI-identified resources.
- DSL1 named graphs align with SOLID pods as units of data ownership.
- Both treat the data model as the primary artefact from which UI is derived.

#### Differences
| Aspect | SOLID / Linked Data frameworks | DSL1 |
|--------|-------------------------------|------|
| Data location | Distributed pods / remote servers | Local quad store (browser or server) |
| Authentication | WebID / OpenID Connect | Not defined (v1) |
| UI approach | Generic RDF viewers / React components | Declarative UI DSL |
| Application logic | JavaScript / TypeScript | PL/SPARQL functions |
| Developer experience | Steep; requires RDF expertise | Guided by AI-readable DSL |
| Interoperability | Maximum (any Linked Data source) | Internal quad store (federation planned) |

#### Strengths of Linked Data / SOLID
- True data sovereignty: users own their pods
- Maximum interoperability: any SPARQL-compatible data source
- URI-based identity enables global knowledge graph linking
- Growing ecosystem (Inrupt, Community SOLID Server)

#### Weaknesses of Linked Data / SOLID
- Complex to develop for; many moving parts
- No standard application logic layer
- UI frameworks are immature and inconsistent
- Adoption is limited outside research and early-adopter communities

---

### 8. Traditional 4GL Languages (Progress OpenEdge, Oracle APEX)

#### What they are
Fourth-generation languages (4GLs) emerged in the 1980s–1990s as high-level languages that
let developers build database-backed applications with less code than 3GLs (C, COBOL).
Progress OpenEdge (formerly "Progress ABL") provides a proprietary language and database.
Oracle APEX is a low-code development platform for Oracle Database, generating HTML
applications directly from SQL-based page definitions.

#### Similarities with DSL1
- Both 4GLs and DSL1 are designed to make data-intensive application development faster.
- Both provide an integrated data + logic + UI model.
- Oracle APEX's declarative page regions ≈ DSL1 WINDOW/WIDGET declarations.
- Both support inline query expressions within application logic (SQL in 4GLs, SPARQL in DSL1).

#### Differences
| Aspect | Progress / Oracle APEX | DSL1 |
|--------|----------------------|------|
| Data model | Relational (SQL tables) | Graph (OWL/RDF triples) |
| Schema | DDL (CREATE TABLE) | Turtle ontology |
| Logic language | ABL / PL/SQL | PL/SPARQL |
| Standards | Proprietary | Open (RDF, SPARQL, OWL — W3C standards) |
| Deployment | Server process / Oracle DB | Static HTML file |
| Semantic reasoning | None | OWL inferencing |
| AI generation | Hard (proprietary syntax) | Easy (text-based, designed for LLM output) |
| Cost | Commercial licence | Open |

#### Strengths of 4GL platforms
- Extremely mature and battle-tested in enterprise environments
- Deep integration with existing relational database infrastructure
- Large existing application portfolios and skilled developer base
- Oracle APEX in particular has very fast application development for DB-centric apps

#### Weaknesses of 4GL platforms
- Proprietary lock-in to vendor database and runtime
- Relational model is poorly suited for heterogeneous or linked data
- No semantic interoperability
- Not designed for AI-assisted code generation

---

### Summary Comparison Table

| Dimension | DSL1 | BPMN | Low-code | Triple stores | XSLT | GraphQL | SOLID | 4GL |
|-----------|------|------|----------|--------------|------|---------|-------|-----|
| Open standards | High | Medium | Low | High | High | Medium | High | Low |
| Semantic model | OWL/RDF | None | None | OWL/RDF | XML | Types only | OWL/RDF | None |
| UI layer | DSL | Tasklist | Visual | None | Static | None | Viewers | Integrated |
| Server required | No | Yes | Yes | Yes | No | Yes | Yes | Yes |
| AI-writable | High | Low | Low | Medium | Low | Medium | Low | Low |
| Procedural logic | PL/SPARQL | BPMN flow | Visual | None | Limited | Resolvers | JS | ABL/PL-SQL |
| Deployment | Static HTML | Docker | SaaS | Docker | Any | Server | Pod | Server |

---

## Part 2: Development Roadmap and Expansion Proposals

The following ten proposals describe concrete directions for extending the DSL1 platform
beyond its v1 foundations. Each proposal is rated by estimated impact and implementation
complexity.

---

### Proposal 1: Collaborative Editing with CRDT-Based Multi-User Ontology Editing

**Impact:** High | **Complexity:** High

#### Idea
Today DSL1 is a single-user, single-browser application. Introducing real-time collaborative
editing would allow multiple developers or ontologists to edit the same ontology, PL/SPARQL
functions, and UI DSL simultaneously in their browsers, with changes merged automatically
and conflicts resolved without locks.

#### Benefit
- Enables team ontology modelling sessions analogous to collaborative Google Docs
- Eliminates the "who has the file checked out" problem in knowledge engineering projects
- Accelerates ontology consensus building across domain experts

#### Implementation Sketch
1. Represent each ontology, function, and UI window as a CRDT document (Yjs or Automerge).
2. Sync via a lightweight WebSocket relay server (or SOLID pod + WebSockets on top of it).
3. Each triple or function line becomes a CRDT node; additions and deletions are recorded
   as operations, not as file diffs.
4. The IDE merges incoming remote operations in real time; the Turtle editor highlights
   which user added which triple (presence cursors).
5. Conflict resolution rules: last-write-wins for literal values; set-union for triple
   additions (deletes require consensus or are soft-deleted with a `owl:deprecated` flag).
6. Peer-to-peer mode (WebRTC) for small teams; server-relay mode for larger deployments.

---

### Proposal 2: AI-Assisted DSL Generation (LLM Autocomplete in the IDE)

**Impact:** Very High | **Complexity:** Medium

#### Idea
Embed an LLM (e.g., via OpenAI or a local model like Ollama) directly into the browser IDE.
The AI panel accepts natural-language descriptions and generates complete ontology + PL/SPARQL
+ UI DSL output. The IDE also provides inline autocomplete for partial DSL expressions.

#### Benefit
- Dramatically lowers the barrier to entry for new DSL1 users
- The system-prompt.md and dsl-reference.md files from the prompt/ directory become the
  grounding context for every LLM call, ensuring generated code follows DSL1 conventions
- Mistakes are surfaced in the IDE immediately with SPARQL syntax highlighting

#### Implementation Sketch
1. Add an "AI Assist" side panel to the IDE with a plain-text prompt input field.
2. On submit, call the LLM API with: system prompt = `/prompt/system-prompt.md` +
   user message = the developer's description.
3. Parse the three-block LLM response (Ontology / PL/SPARQL / UI DSL) and load each into
   the corresponding IDE editor tab.
4. For autocomplete: on each keypress in the PL/SPARQL or UI DSL editor, send the
   current function/window context (last N tokens) to the LLM and stream back completions.
5. Cache ontology class and property names in a local index to enable client-side
   autocompletion for known terms without an API call.
6. Provide a "Regenerate" button that re-sends with the existing code as additional context
   ("Keep the ontology, regenerate only the UI DSL").

---

### Proposal 3: Version Control for Ontologies (Git-Like Diff/Merge for Turtle)

**Impact:** High | **Complexity:** Medium

#### Idea
Ontologies evolve over time. DSL1 should provide first-class versioning: a history of every
change to every triple, the ability to diff two versions at the triple level, and a
merge workflow for reconciling parallel branches of ontology development.

#### Benefit
- Makes ontology evolution auditable and reversible
- Enables "ontology branch" workflows (develop a new class hierarchy without affecting
  production, then merge when ready)
- Provides a foundation for SHACL migration validation (verify that data still conforms
  after a schema change)

#### Implementation Sketch
1. Represent each save as a **commit**: a timestamped snapshot of the full TriG state,
   stored in a `https://dsl1.example.org/versions/<domain>/<uuid>` named graph.
2. A commit record stores: parent commit URI, author, timestamp, and a change set
   (list of added triples and deleted triples since the parent).
3. **Diff algorithm**: compare two commits' change sets; display as a colour-coded
   Turtle diff (added lines in green, deleted in red) in the IDE.
4. **Merge algorithm**: three-way merge using the common ancestor commit. Conflicts
   (same triple modified differently in both branches) are flagged for manual resolution.
5. **UI**: a "History" panel in the IDE showing commit log, with "View diff" and
   "Restore this version" actions.
6. Export: allow the commit history to be exported as a Git repository (one commit per
   DSL1 snapshot) for integration with standard DevOps tooling.

---

### Proposal 4: Rule Engine Integration (SWRL / SPIN Rules Alongside PL/SPARQL)

**Impact:** Medium | **Complexity:** Medium

#### Idea
PL/SPARQL covers imperative business logic. But many domain rules are better expressed
declaratively: "If an employee's total logged hours exceed 40 per week, mark their status
as Overtime." SWRL (Semantic Web Rule Language) and SPIN (SPARQL Inference Notation) allow
forward-chaining rules to fire automatically when data changes.

#### Benefit
- Eliminates boilerplate "check condition, update status" function calls
- Derived facts are maintained automatically by the rule engine
- Rules are human-readable and auditable alongside the ontology

#### Implementation Sketch
1. Extend the DSL1 schema to include a `dsl1:Rule` class with a `dsl1:condition` (SPARQL
   ASK or SELECT) and `dsl1:consequence` (SPARQL INSERT).
2. Rules are stored in a dedicated named graph:
   `https://dsl1.example.org/rules/<domain>`.
3. The DSL1 runtime runs a forward-chaining rule engine after every INSERT/DELETE
   operation: evaluate each rule's condition; if true, fire the consequence INSERT.
4. Support SPIN-style macro rules that generate SPARQL from a parameterised template.
5. SWRL import: parse OWL/SWRL annotations in the ontology Turtle file and compile them
   to SPARQL rules automatically.
6. IDE tab: "Rules" editor with syntax highlighting for SPARQL conditions and rule metadata.
7. Conflict detection: warn if two rules could produce contradictory conclusions.

---

### Proposal 5: SOLID / WebID Integration (Personal Data Pods)

**Impact:** High | **Complexity:** High

#### Idea
Integrate SOLID (Social Linked Data) as an optional storage and authentication backend.
Users authenticate with their WebID; their application data is stored in their personal
SOLID pod (any CSS/ESS-compatible server) rather than in browser localStorage.
This makes DSL1 applications privacy-preserving and user-sovereign by default.

#### Benefit
- Data portability: users can switch DSL1 applications without losing their data
- Privacy by design: no central server holds user data
- Interoperability: data in pods is accessible to any SOLID-compatible application
- Enables multi-device sync without a custom backend

#### Implementation Sketch
1. Add a "Storage Backend" setting in the IDE: `localStorage` (default) or `SOLID Pod`.
2. For SOLID mode: implement WebID-OIDC authentication using the `@inrupt/solid-client-authn`
   library compiled into the single HTML file.
3. Map DSL1 named graphs to SOLID resources:
   - `https://dsl1.example.org/data/<domain>/default` →
     `https://<user>.solidcommunity.net/dsl1/<domain>/data.trig`
4. All SPARQL reads become LDO fetches + in-memory SPARQL evaluation (using Comunica or
   N3.js).
5. All SPARQL writes translate to SOLID PATCH requests (using the SOLID SPARQL-Update
   protocol over LDP).
6. Sharing: expose a DSL1 "Share" button that sets ACL permissions on a resource to allow
   read access for specific WebIDs or the public.

---

### Proposal 6: Visual / Graphical DSL Editor (Drag-and-Drop Flowchart to PL/SPARQL)

**Impact:** Medium | **Complexity:** High

#### Idea
Provide an alternative visual authoring mode for PL/SPARQL functions. Instead of writing
text, the developer drags nodes onto a canvas: query blocks, `la-if` diamonds, `la-forEach`
loops, and function call boxes. The IDE generates PL/SPARQL text from the visual graph and
keeps the two representations in sync.

#### Benefit
- Lowers the barrier for developers unfamiliar with SPARQL
- Provides a visual debugging view (highlight which node is executing)
- Makes function logic reviewable by non-developers (project managers, domain experts)

#### Implementation Sketch
1. Use a graph editing library (e.g., React Flow or mxGraph) to render function nodes.
2. Node types: `START`, `SELECT-WHERE`, `INSERT-DATA`, `DELETE`, `la-if`, `la-forEach`,
   `FUNCTION-CALL`, `RETURN`.
3. Each node has a property panel for editing its SPARQL fragment or expression.
4. A bidirectional compiler converts between the node graph (JSON) and PL/SPARQL text.
5. Text → graph: parse the PL/SPARQL AST and map each construct to a node type.
6. Graph → text: depth-first traversal of the node graph emits PL/SPARQL lines with
   correct indentation.
7. Validation: highlight nodes in red if their SPARQL fragments contain syntax errors
   (real-time SPARQL parser feedback).

---

### Proposal 7: Schema.org / Wikidata Ontology Import

**Impact:** High | **Complexity:** Low–Medium

#### Idea
Allow developers to start a new DSL1 project by importing a Schema.org type or Wikidata
entity class as the foundation of their ontology, rather than building from scratch.
For example, importing `schema:Book` would pre-populate the Book class with standard
properties (name, author, isbn, datePublished, etc.).

#### Benefit
- Dramatically speeds up ontology creation for common domains
- Produces interoperable data: a DSL1 book library is natively compatible with any
  Schema.org consumer
- Reduces the risk of idiosyncratic ontology design mistakes

#### Implementation Sketch
1. Bundle a compressed subset of Schema.org JSON-LD in the IDE HTML file (~2 MB).
2. Add an "Import from Schema.org" panel: type to search for a type name; select types
   and their expected properties; click "Import."
3. The importer translates Schema.org JSON-LD to DSL1 Turtle conventions:
   - `schema:name` → `:name a owl:DatatypeProperty ; rdfs:range xsd:string`
   - `schema:author` → `:author a owl:ObjectProperty ; rdfs:range :Person`
4. For Wikidata: use the Wikidata SPARQL endpoint (via federated query) to fetch property
   definitions for a given Wikidata entity class (P31 target).
5. Imported properties are marked with `owl:sameAs <schema:propertyURI>` so the lineage
   is preserved.
6. The developer can then extend, rename, or remove imported properties before generating
   PL/SPARQL functions.

---

### Proposal 8: SHACL Validation for Ontology Data Integrity

**Impact:** High | **Complexity:** Medium

#### Idea
Integrate SHACL (Shapes Constraint Language) to validate that instance data in the quad
store conforms to the ontology schema. SHACL shapes define constraints (required properties,
value ranges, cardinalities, regex patterns) and produce structured validation reports.

#### Benefit
- Catches data quality issues before they cause function failures
- Makes constraints explicit and machine-checkable (not just documented)
- Enables safe migration: run SHACL validation after an ontology change to find all
  non-conforming individuals before deploying

#### Implementation Sketch
1. Extend the ontology template with a SHACL section (see Section 6 of `ontology-template.ttl`).
2. Bundle a SHACL processor written in JavaScript (RDF-Ext or a custom N3.js-based
   implementation) into the IDE.
3. Validation runs automatically:
   - On every INSERT: validate the newly inserted individual against its class shape.
   - On demand: "Validate All" button in the IDE runs full dataset validation.
4. Validation results are displayed in an IDE panel: each violation shows the offending
   individual, violated constraint, and the SHACL message text.
5. Add SHACL-derived form validation in the UI DSL: the translator reads SHACL `sh:minCount`,
   `sh:maxCount`, `sh:pattern`, and `sh:datatype` constraints and emits corresponding
   JavaScript form validation logic automatically.
6. DSL1 function signatures can declare `@validated` to trigger pre-call SHACL checking
   of their argument graph patterns.

---

### Proposal 9: Federation — Query Across Multiple Named Graphs and Remote SPARQL Endpoints

**Impact:** High | **Complexity:** High

#### Idea
Extend PL/SPARQL with SPARQL 1.1 Federation (SERVICE keyword) to allow DSL1 functions to
query not only the local quad store but also remote public or private SPARQL endpoints
(DBpedia, Wikidata, corporate data warehouses, other DSL1 instances).

#### Benefit
- Enables mashup applications that combine local private data with public knowledge graphs
- Allows DSL1 instances to share reference data (e.g., a shared product catalogue served
  by one instance, consumed by many)
- Aligns DSL1 with the Linked Open Data ecosystem

#### Implementation Sketch
1. Add `SERVICE` keyword support to the PL/SPARQL parser (it already exists in SPARQL 1.1;
   DSL1's parser needs to not strip it out).
2. In the browser, remote SPARQL requests are made via `fetch()` to CORS-enabled endpoints.
3. For endpoints without CORS headers, provide a configurable proxy server option
   (a simple Node.js pass-through that adds CORS headers).
4. Define a `GRAPH-ALIAS` directive to give human-readable names to remote endpoint URIs:
   ```sparql
   GRAPH-ALIAS :wikidata = <https://query.wikidata.org/sparql>
   ```
5. Security: all remote endpoint URIs are declared in a whitelist in the IDE settings;
   functions cannot query endpoints not on the whitelist.
6. Caching: results from SERVICE calls are cached in a local named graph with a TTL
   (time-to-live), controlled by a `CACHE-TTL: 300` directive in the function header.
7. Fallback: if a remote endpoint is unavailable, `la-if (BOUND(?remoteResult))` patterns
   allow functions to degrade gracefully.

---

### Proposal 10: Export to Other Targets (React, Vue, Native Mobile)

**Impact:** Very High | **Complexity:** High

#### Idea
The DSL1 translator currently compiles UI DSL + PL/SPARQL to vanilla browser JavaScript
within a single HTML file. Adding compiler backends for React, Vue, and React Native
(or Flutter) would allow DSL1 to serve as a platform-agnostic application description
language that generates idiomatic code for each target.

#### Benefit
- DSL1 applications gain access to component ecosystems (Material UI, Ant Design)
- Developers can use DSL1 as a rapid prototyping tool and then "graduate" the output to a
  production framework
- Organisations can standardise on DSL1 as the internal language while deploying to
  diverse frontend stacks
- React Native / Flutter export enables mobile deployment without rewriting

#### Implementation Sketch
1. Refactor the translator into a multi-pass architecture:
   - Pass 1: Parse DSL1 source → Abstract Syntax Tree (AST) with nodes for windows,
     widgets, functions, and state variables.
   - Pass 2: Optimise / validate the AST (type-check bindings, verify all referenced
     functions exist).
   - Pass 3: Backend-specific code generator traverses the AST and emits target code.
2. **React backend**: each WINDOW → React functional component; each STATE → `useState` hook;
   each `bind-items` → `useEffect` with dependency array; each PL/SPARQL FUNCTION →
   async JavaScript function with inline SPARQL evaluated by Comunica.
3. **Vue backend**: WINDOW → Vue SFC (`.vue` file); STATE → `ref()` in `<script setup>`;
   `bind-items` → `computed()` with async fetch; event handlers → Vue `@click` directives.
4. **React Native backend**: map UI DSL widget types to RN primitives
   (label → `<Text>`, input → `<TextInput>`, list → `<FlatList>`, button → `<Pressable>`).
   Storage uses AsyncStorage instead of browser localStorage.
5. The PL/SPARQL-to-JavaScript compiler (already in the v1 translator) is reused by all
   backends; only the UI rendering layer changes.
6. Export UI in the IDE: "Export As…" dropdown offering: `Single HTML`, `React Project`,
   `Vue Project`, `React Native Project`, with a ZIP download of the generated project.

---

### Roadmap Priority Matrix

| Proposal | Impact | Complexity | Recommended Phase |
|----------|--------|-----------|-------------------|
| AI-Assisted DSL Generation | Very High | Medium | Phase 1 (v1.1) |
| SHACL Validation | High | Medium | Phase 1 (v1.1) |
| Schema.org / Wikidata Import | High | Low–Medium | Phase 1 (v1.1) |
| Version Control | High | Medium | Phase 2 (v1.2) |
| Export to React / Vue | Very High | High | Phase 2 (v1.2) |
| Rule Engine (SWRL/SPIN) | Medium | Medium | Phase 2 (v1.2) |
| SOLID / WebID Integration | High | High | Phase 3 (v2.0) |
| Federation (SERVICE) | High | High | Phase 3 (v2.0) |
| Visual / Graphical DSL Editor | Medium | High | Phase 3 (v2.0) |
| Collaborative CRDT Editing | High | High | Phase 4 (v2.1) |

---

### Closing Remarks

DSL1 occupies a distinctive position in the application development landscape: it is the
only platform that combines W3C-standard semantic web data models (OWL/RDF/SPARQL) with
a concise AI-writable DSL, a declarative UI binding language, and zero-infrastructure
deployment (single HTML file, GitHub Pages). Its closest competitors either require
server infrastructure (triple stores, BPMN engines, 4GLs), lack semantic data models
(low-code platforms, GraphQL), or lack an application logic layer (Protégé, XSLT).

The ten proposals above form a coherent roadmap that progressively strengthens the platform
across three dimensions: developer experience (AI assist, visual editor, Schema.org import),
data integrity (SHACL, version control, rule engine), and ecosystem reach (SOLID, federation,
multi-target export). Implementing even Phase 1 alone would significantly differentiate
DSL1 from all existing alternatives.
