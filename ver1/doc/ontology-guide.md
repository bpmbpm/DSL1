# Ontology Layer Guide

## 1. Introduction

The ontology layer is the **vocabulary foundation** of every application built with this system. Before writing any PL/SPARQL logic or UI DSL, you define your domain model: what kinds of things exist (classes), what properties those things have, and what relationships connect them.

This guide covers:
- The OWL/RDF Turtle format used by the system.
- How to use the IDE's Concept Types Editor and Individual Editor.
- How to define properties for existing types.
- How ontology data lives in the tripleStore/quadStore (TriG).
- Namespace and prefix conventions.
- Step-by-step walkthroughs.

---

## 2. OWL/RDF Turtle Basics

### 2.1 Turtle Syntax Refresher

Turtle (`.ttl`) is a human-readable serialisation of RDF. The key constructs:

**Prefix declarations:**
```turtle
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:   <http://example.org/> .
```

**Declaring a class:**
```turtle
ex:Person a owl:Class ;
  rdfs:label "Person"@en ;
  rdfs:comment "A human individual."@en .
```

**Declaring a datatype property:**
```turtle
ex:name a owl:DatatypeProperty ;
  rdfs:domain ex:Person ;
  rdfs:range  xsd:string ;
  rdfs:label  "name"@en .
```

**Declaring an object property:**
```turtle
ex:worksFor a owl:ObjectProperty ;
  rdfs:domain ex:Person ;
  rdfs:range  ex:Organisation ;
  rdfs:label  "works for"@en .
```

**Declaring an individual:**
```turtle
ex:alice a ex:Person ;
  ex:name    "Alice Smith" ;
  ex:age     30 ;
  ex:worksFor ex:AcmeCorp .
```

### 2.2 OWL Constructs Supported

The system supports a practical subset of OWL 2:

| Construct | Usage |
|---|---|
| `owl:Class` | Declare a class |
| `owl:DatatypeProperty` | Property with a literal value |
| `owl:ObjectProperty` | Property with an IRI value |
| `owl:AnnotationProperty` | Metadata property (e.g., `rdfs:label`) |
| `rdfs:subClassOf` | Class hierarchy |
| `rdfs:subPropertyOf` | Property hierarchy |
| `rdfs:domain` | States which class a property applies to |
| `rdfs:range` | States the type of a property's value |
| `owl:inverseOf` | Declares inverse properties |
| `owl:FunctionalProperty` | At most one value per subject |
| `owl:Restriction` | Local property restrictions |
| `owl:allValuesFrom` | Universal restriction |
| `owl:someValuesFrom` | Existential restriction |
| `owl:maxCardinality` | Maximum number of values |
| `owl:minCardinality` | Minimum number of values |

Full OWL reasoning is **not** performed at runtime. Restrictions are used for IDE-side validation (the translator checks that instances conform to declared cardinalities).

---

## 3. Namespace and Prefix Conventions

Every application should declare its own base namespace. Convention:

```turtle
@prefix app:  <http://myapp.example.org/ontology#> .
@prefix data: <http://myapp.example.org/data/> .
```

**Standard prefixes always included by the IDE:**

| Prefix | Namespace |
|---|---|
| `rdf:` | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` |
| `rdfs:` | `http://www.w3.org/2000/01/rdf-schema#` |
| `owl:` | `http://www.w3.org/2002/07/owl#` |
| `xsd:` | `http://www.w3.org/2001/XMLSchema#` |

**Convention for application prefixes:**

- Use short, lowercase, mnemonic prefixes: `inv:` for invoicing, `hr:` for HR, `proj:` for project management.
- Keep ontology IRIs (class/property definitions) separate from instance data IRIs.
- Use `#` anchor fragment for ontology terms (`<http://example.org/ontology#Person>`).
- Use path segments for instances (`<http://example.org/data/alice>`).

---

## 4. TriG Integration (TripleStore / QuadStore)

The IDE maintains the ontology and instance data in an in-browser RDF **quad store** using TriG format. Each named graph serves a specific role:

```trig
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:   <http://example.org/> .

# ── Named graph: ontology ────────────────────────────────────
<urn:ontology> {
  ex:Person a owl:Class ;
    rdfs:label "Person"@en .

  ex:name a owl:DatatypeProperty ;
    rdfs:domain ex:Person ;
    rdfs:range  xsd:string .

  ex:Organisation a owl:Class ;
    rdfs:label "Organisation"@en .

  ex:worksFor a owl:ObjectProperty ;
    rdfs:domain ex:Person ;
    rdfs:range  ex:Organisation .
}

# ── Named graph: instance data ───────────────────────────────
<urn:data> {
  ex:alice a ex:Person ;
    ex:name    "Alice Smith" ;
    ex:worksFor ex:AcmeCorp .

  ex:AcmeCorp a ex:Organisation ;
    ex:name "Acme Corporation" .
}
```

### 4.1 Named Graph Roles

| Named Graph IRI | Contents |
|---|---|
| `urn:ontology` | OWL classes and properties |
| `urn:data` | Named individual instances |
| `urn:ui` | UI DSL metadata stored as RDF |
| `urn:session` | Transient session state (selected items, current context) |

The `urn:session` graph is cleared on application startup. It holds ephemeral state like the currently selected item that parameterises reactive bindings.

---

## 5. Concept Types Editor

The **Concept Types Editor** is the left panel of the IDE's Ontology tab. It provides a form-driven interface for defining OWL classes and properties without writing raw Turtle.

### 5.1 Creating a New Class

1. Click **"+ New Class"** in the Concept Types Editor.
2. Fill in:
   - **IRI fragment** — the local name within your app namespace (e.g., `Invoice`).
   - **Label** — human-readable name in English (e.g., `Invoice`).
   - **Comment** — optional description.
   - **Superclass** — optional; select from the dropdown of existing classes.
3. Click **Save**.

The editor writes the following Turtle into `urn:ontology`:
```turtle
ex:Invoice a owl:Class ;
  rdfs:label   "Invoice"@en ;
  rdfs:comment "A commercial invoice document."@en ;
  rdfs:subClassOf ex:Document .
```

### 5.2 Adding a Datatype Property

1. Select the class in the class list.
2. Click **"+ Add Property"** → **"Datatype Property"**.
3. Fill in:
   - **Property IRI fragment** (e.g., `invoiceNumber`).
   - **Label** (e.g., `Invoice Number`).
   - **Range** — select from: `xsd:string`, `xsd:integer`, `xsd:decimal`, `xsd:boolean`, `xsd:date`, `xsd:dateTime`, `xsd:anyURI`.
   - **Cardinality** — optional: min/max values.
   - **Functional** — toggle for at-most-one constraint.
4. Click **Save**.

Generated Turtle:
```turtle
ex:invoiceNumber a owl:DatatypeProperty , owl:FunctionalProperty ;
  rdfs:domain ex:Invoice ;
  rdfs:range  xsd:string ;
  rdfs:label  "Invoice Number"@en .
```

### 5.3 Adding an Object Property

1. Select the source class.
2. Click **"+ Add Property"** → **"Object Property"**.
3. Fill in:
   - **Property IRI fragment** (e.g., `billedTo`).
   - **Label** (e.g., `Billed To`).
   - **Range class** — select from existing classes.
   - **Inverse property name** — optional.
4. Click **Save**.

Generated Turtle:
```turtle
ex:billedTo a owl:ObjectProperty ;
  rdfs:domain ex:Invoice ;
  rdfs:range  ex:Customer ;
  rdfs:label  "Billed To"@en .

ex:receivedInvoice owl:inverseOf ex:billedTo ;
  rdfs:label "Received Invoice"@en .
```

### 5.4 Class Hierarchy

The Concept Types Editor displays classes in a tree, grouped by `rdfs:subClassOf`. You can drag a class onto another to set a superclass relationship. The editor updates the Turtle accordingly.

---

## 6. Individual Editor

The **Individual Editor** is the right panel of the IDE's Ontology tab. It lets you create and edit named instances (OWL individuals).

### 6.1 Creating a New Individual

1. Click **"+ New Individual"** in the Individual Editor.
2. Select the **class** (type) from the dropdown — this controls which properties are shown.
3. Fill in:
   - **IRI fragment** (e.g., `inv-001`) — becomes `ex:inv-001`.
   - All datatype and object property fields displayed for the selected class.
4. Click **Save**.

The editor writes to `urn:data`:
```turtle
ex:inv-001 a ex:Invoice ;
  ex:invoiceNumber "INV-001" ;
  ex:issueDate     "2024-01-15"^^xsd:date ;
  ex:billedTo      ex:customer-42 ;
  ex:totalAmount   1500.00 .
```

### 6.2 Editing an Individual

1. Use the search box or browse the individual list to find the individual.
2. Click the individual's row.
3. The property fields are populated with current values.
4. Edit values and click **Save**.

The editor generates the appropriate `DELETE/INSERT WHERE` SPARQL update to change only the modified properties.

### 6.3 Deleting an Individual

Click the trash icon on an individual's row. The editor issues:
```sparql
DELETE WHERE {
  GRAPH <urn:data> { ex:inv-001 ?p ?o . }
}
```

This removes all triples about the individual from the data graph.

---

## 7. Graph Visualisation

The Ontology tab includes a **graph canvas** (powered by Cytoscape.js) that shows:

- Classes as large, labelled nodes.
- Subclass relationships as directed edges labelled `subClassOf`.
- Object properties as directed edges between class nodes, labelled with the property name.

Clicking a node opens that class in the Concept Types Editor. The visualisation updates live as you edit.

---

## 8. Editing Turtle Directly

Advanced users can switch to **Raw Turtle mode** in the Concept Types Editor by clicking the **"< / > Edit Turtle"** button. This shows the full Turtle source for the `urn:ontology` graph and allows free-form editing.

When you switch back to form mode, the editor re-parses the Turtle. Parse errors are highlighted inline.

---

## 9. Step-by-Step: Adding a New Concept Type and Instances

This walkthrough adds a `Product` class with properties, then creates two product instances.

### Step 1 — Declare the class

1. Open the IDE → **Ontology** tab → **Concept Types Editor**.
2. Click **"+ New Class"**.
3. Enter:
   - IRI fragment: `Product`
   - Label: `Product`
   - Comment: `A sellable product.`
4. Click **Save**.

### Step 2 — Add properties

1. Select `Product` in the class list.
2. Click **"+ Add Property"** → **"Datatype Property"**:
   - IRI: `productCode`, Label: `Product Code`, Range: `xsd:string`, Functional: ✓
3. Save.
4. Click **"+ Add Property"** → **"Datatype Property"**:
   - IRI: `productName`, Label: `Product Name`, Range: `xsd:string`
5. Save.
6. Click **"+ Add Property"** → **"Datatype Property"**:
   - IRI: `unitPrice`, Label: `Unit Price`, Range: `xsd:decimal`
7. Save.

### Step 3 — Create instances

1. Open the **Individual Editor** tab.
2. Click **"+ New Individual"**.
3. Select class `Product`.
4. Fill in:
   - IRI fragment: `prod-001`
   - Product Code: `WIDGET-A`
   - Product Name: `Blue Widget`
   - Unit Price: `9.99`
5. Click **Save**.
6. Repeat for a second product (`prod-002`, `WIDGET-B`, `Red Widget`, `12.49`).

### Step 4 — Verify in raw Turtle

Switch to **Raw Turtle mode**. You should see:

```turtle
# In urn:ontology
ex:Product a owl:Class ;
  rdfs:label   "Product"@en ;
  rdfs:comment "A sellable product."@en .

ex:productCode a owl:DatatypeProperty , owl:FunctionalProperty ;
  rdfs:domain ex:Product ;
  rdfs:range  xsd:string ;
  rdfs:label  "Product Code"@en .

ex:productName a owl:DatatypeProperty ;
  rdfs:domain ex:Product ;
  rdfs:range  xsd:string ;
  rdfs:label  "Product Name"@en .

ex:unitPrice a owl:DatatypeProperty ;
  rdfs:domain ex:Product ;
  rdfs:range  xsd:decimal ;
  rdfs:label  "Unit Price"@en .

# In urn:data
ex:prod-001 a ex:Product ;
  ex:productCode "WIDGET-A" ;
  ex:productName "Blue Widget" ;
  ex:unitPrice   9.99 .

ex:prod-002 a ex:Product ;
  ex:productCode "WIDGET-B" ;
  ex:productName "Red Widget" ;
  ex:unitPrice   12.49 .
```

### Step 5 — Use in PL/SPARQL

Open the **DSL Editor**. The autocomplete now offers `ex:Product`, `ex:productCode`, `ex:productName`, `ex:unitPrice` as you type.

```sparql
PREFIX ex: <http://example.org/>

const products = SELECT ?p ?name ?price WHERE {
  ?p a ex:Product ;
     ex:productName ?name ;
     ex:unitPrice   ?price .
} ORDER BY ?name ;
```

---

## 10. Import and Export

### Export Ontology

- In the Ontology tab, click **Export → Turtle (.ttl)**. Downloads the `urn:ontology` graph.
- Click **Export → TriG (.trig)**. Downloads the full quad store (ontology + data).

### Import Ontology

- Click **Import → Turtle (.ttl)**. The parsed triples are merged into `urn:ontology`.
- Click **Import → TriG (.trig)**. The full dataset replaces the current store (with a confirmation prompt).

Imported files are validated: parse errors are shown in the editor, and the import is rejected if the file is not valid Turtle/TriG.

---

## 11. Protégé-Style Workflow

Users familiar with Protégé will find the following mapping helpful:

| Protégé concept | This system equivalent |
|---|---|
| Class hierarchy panel | Concept Types Editor — class tree |
| Object property panel | "Add Object Property" form |
| Data property panel | "Add Datatype Property" form |
| Individual browser | Individual Editor |
| OWLViz / class graph | Graph Visualisation canvas |
| Reasoner | Not applicable (no OWL reasoning) |
| DL Query | PL/SPARQL SELECT in DSL Editor |
| Export as Turtle | Export → Turtle (.ttl) |

The key difference from Protégé: this system does **not** run an OWL reasoner. Subclass inferences and property chain inferences are not automatically computed. The tripleStore contains only the **asserted** triples.
