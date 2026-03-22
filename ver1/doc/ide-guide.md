# IDE User Guide

## 1. IDE Overview

The IDE is a **single-page application** hosted on GitHub Pages. It requires no installation, no server, and no build tools. Open the URL in any modern browser (Chrome 90+, Firefox 88+, Safari 15+, Edge 90+) and start building.

The IDE provides a unified environment for all three source layers of the system:

- **Ontology** — define your data model in OWL/RDF.
- **PL/SPARQL Logic** — write application functions and queries.
- **UI DSL** — declare your user interface and data bindings.

From these three sources, the **Translate** button produces a standalone JavaScript file that is your deployed application.

All data is saved to browser `localStorage` automatically. Nothing is sent to any server.

### 1.1 Accessing the IDE

The IDE is hosted at:
```
https://<your-github-username>.github.io/<repo-name>/
```

For offline use: after visiting the URL once, the IDE is cached by the service worker and works without internet access.

### 1.2 Browser Requirements

| Feature | Minimum version |
|---|---|
| ES2020 JavaScript | Chrome 85, Firefox 79, Safari 14 |
| CSS Grid | All modern browsers |
| localStorage | All modern browsers |
| File System Access API (export) | Chrome 86+ (fallback download link on others) |

---

## 2. IDE Layout

The IDE is divided into a **top toolbar** and a **main panel area**.

```
┌────────────────────────────────────────────────────────────────┐
│  Logo  │ File ▾ │ Import ▾ │ Export ▾ │        │ [Translate]  │
├────────────┬───────────────┬───────────────┬────────────────────┤
│            │               │               │                    │
│ Ontology   │  PL/SPARQL    │  UI DSL       │  Output / Preview  │
│ Editor     │  Editor       │  Editor       │  Panel             │
│            │               │               │                    │
│ ─────────  │               │               │  [ Output JS ]     │
│ Class Tree │               │               │  [ Preview ]       │
│            │               │               │                    │
│ Individuals│               │               │                    │
│ Panel      │               │               │                    │
│            │               │               │                    │
├────────────┴───────────────┴───────────────┴────────────────────┤
│  Diagnostics Panel (errors and warnings)                        │
└────────────────────────────────────────────────────────────────┘
```

The four main panels can be resized by dragging the dividers between them. Each panel can be collapsed to give more space to the others.

---

## 3. Toolbar

### 3.1 File Menu

| Item | Action |
|---|---|
| **New Project** | Clears all three editors and the store; prompts for confirmation |
| **Save to localStorage** | Manually saves current state (auto-save happens every 30 seconds) |
| **Load from localStorage** | Restores last saved state |
| **Project Settings** | Opens a dialog to set the base namespace IRI for the project |

### 3.2 Import Menu

| Item | Action |
|---|---|
| **Import Turtle (.ttl)** | Parses and merges into `urn:ontology` graph |
| **Import TriG (.trig)** | Replaces the entire quad store (with confirmation) |
| **Import PL/SPARQL (.plsq)** | Replaces the DSL editor content |
| **Import UI DSL (.uidsl)** | Replaces the UI DSL editor content |

### 3.3 Export Menu

| Item | Action |
|---|---|
| **Export Turtle (.ttl)** | Downloads ontology graph as Turtle |
| **Export TriG (.trig)** | Downloads full quad store as TriG |
| **Export PL/SPARQL (.plsq)** | Downloads DSL source |
| **Export UI DSL (.uidsl)** | Downloads UI DSL source |
| **Export Output JS (.js)** | Downloads the last translated JS (if available) |

### 3.4 Translate Button

The primary action button. Clicking it:

1. Runs the full translator pipeline (Stages 1–6).
2. If there are errors, highlights them in the Diagnostics panel and marks error lines in the editors.
3. If translation succeeds, populates the Output JS panel and refreshes the Preview panel.

A spinner is shown during translation. Translation typically completes in under one second for typical application sizes.

---

## 4. Ontology Editor Panel

The Ontology Editor is split into three sub-panels:

### 4.1 Class Tree (Concept Types Editor)

The left sub-panel shows all declared OWL classes in a collapsible tree, ordered by `rdfs:subClassOf` hierarchy. Root classes (no superclass) appear at the top level.

**Class tree interactions:**

- **Click** a class to open it in the class detail form (right sub-panel).
- **Right-click** a class for a context menu: Rename, Delete, Add Subclass.
- **Drag** a class onto another to set a `rdfs:subClassOf` relationship.
- **"+ New Class"** button at the top adds a new root class.

### 4.2 Class Detail Form

When a class is selected in the tree, its detail form appears on the right side of the Ontology Editor:

**Class fields:**
- **IRI** (read-only after creation; shows full IRI and prefixed form)
- **Label** (editable, `rdfs:label` value)
- **Comment** (editable, `rdfs:comment` value)
- **Superclass** (dropdown)

**Properties table:** Lists all properties with `rdfs:domain` pointing to this class:

| Column | Editable | Notes |
|---|---|---|
| Property name | No | Shows prefixed IRI |
| Label | Yes | `rdfs:label` |
| Type | No | Datatype / Object |
| Range | Yes | Dropdown: XSD types or classes |
| Functional | Yes | Toggle |

Below the table: **"+ Add Datatype Property"** and **"+ Add Object Property"** buttons.

**Raw Turtle toggle:** A `< / >` button at the top-right of the form switches the entire Ontology Editor to a raw Turtle text editor (CodeMirror). Edits in raw mode are parsed back on toggle.

### 4.3 Individuals Panel

The Individuals Panel appears below the Class Tree. It lists all named individuals in `urn:data`.

**Individuals panel controls:**

- **Class filter dropdown** — shows only individuals of the selected class.
- **Search box** — filters by IRI fragment or label.
- **"+ New Individual"** button — opens the individual creation form.
- **Individual rows** — click to open the individual in the detail form.

**Individual detail form:**

When an individual is opened, the form shows:
- **IRI** (read-only after creation)
- **Type** (class; read-only after creation)
- One form field per declared property for that class:
  - Datatype properties show a text/number/date input.
  - Object properties show a dropdown populated by all individuals of the range class.

Save writes the changes to `urn:data` via a `DELETE/INSERT WHERE` update.

### 4.4 Graph Visualisation

A **graph canvas** (Cytoscape.js) is available as a toggleable panel within the Ontology Editor. Click the **"Graph"** tab above the Class Tree to show it.

The graph displays:
- **Classes** as nodes (labelled with `rdfs:label` or IRI fragment).
- **`rdfs:subClassOf`** edges in grey.
- **Object properties** as directed, labelled edges between class nodes.

Controls:
- **Zoom in/out** with scroll wheel.
- **Pan** by dragging the background.
- **Click a node** to open that class in the detail form.
- **"Fit"** button resets the zoom to show all nodes.
- **"Export PNG"** downloads the current graph as a PNG image.

---

## 5. PL/SPARQL Editor Panel

The DSL Editor is a full-featured code editor powered by **CodeMirror 6**.

### 5.1 Syntax Highlighting

The PL/SPARQL mode highlights:

| Token category | Color scheme |
|---|---|
| SPARQL keywords (`SELECT`, `WHERE`, `FILTER`, etc.) | Blue |
| PL/SPARQL keywords (`FUNCTION`, `la-if`, `la-forEach`) | Purple |
| JS-borrowed keywords (`let`, `const`, `return`, `map`, `filter`, `reduce`) | Teal |
| Prefixed names / IRIs | Orange |
| SPARQL variables (`?name`) | Red |
| String literals | Green |
| Comments | Grey/italic |
| Operators | Dark |

### 5.2 Autocomplete

Autocomplete (triggered by `Ctrl+Space` or automatically after typing a `:`) offers:

- **Prefixed names** — after typing a declared prefix followed by `:`, all classes and properties with that prefix are listed (sourced from the ontology store).
- **SPARQL keywords** — after a word boundary.
- **PL/SPARQL keywords** — `FUNCTION`, `la-if`, `la-else`, `la-forEach`.
- **Declared function names** — after typing an identifier-start character.
- **Variable names in scope** — after `?`.

Autocomplete entries show the `rdfs:label` and `rdfs:comment` of ontology terms as a tooltip.

### 5.3 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Space` | Trigger autocomplete |
| `Ctrl+/` | Toggle line comment |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+F` | Find |
| `Ctrl+H` | Find and replace |
| `Alt+Up` / `Alt+Down` | Move line up/down |
| `Ctrl+Enter` | Trigger translate (same as Translate button) |

### 5.4 Error Markers

After a translation run, lines with errors or warnings receive inline markers:
- **Red gutter mark** + red underline for errors.
- **Amber gutter mark** + amber underline for warnings.

Hovering over an underlined term shows the diagnostic message.

---

## 6. UI DSL Editor Panel

The UI DSL Editor is a second CodeMirror instance with a custom language mode for the UI DSL syntax.

### 6.1 Syntax Highlighting

| Token category | Color scheme |
|---|---|
| UI DSL keywords (`WINDOW`, `BUTTON`, `LISTVIEW`, etc.) | Blue |
| Attribute keywords (`LABEL`, `BIND TO`, `ON CLICK`, etc.) | Purple |
| Widget names (identifiers) | Dark |
| SPARQL blocks inside `BIND TO (...)` | Highlighted as SPARQL sub-language |
| String literals | Green |

### 6.2 Autocomplete

- **Widget keywords** after `{`.
- **Window names** after `NAVIGATE TO `.
- **PL/SPARQL function names** after `CALL `.
- **Prefixed names** after declaring a `PREFIX`.
- **SPARQL variable names** after `DISPLAY ?` and `VALUE ?`.

### 6.3 Live Structure Outline

A collapsible **outline panel** on the left side of the UI DSL editor lists all declared `WINDOW` names. Clicking a window name in the outline scrolls the editor to that declaration.

---

## 7. Output and Preview Panel

The rightmost panel has two tabs: **Output JS** and **Preview**.

### 7.1 Output JS Tab

After a successful translation, the generated JavaScript is displayed here in a read-only CodeMirror instance with JavaScript syntax highlighting.

Controls:
- **Copy to clipboard** — copies the entire JS string.
- **Download** — triggers a file download of `output.js`.
- **Minify** — toggle to run the whitespace-stripping pass; re-translates if not already done.
- **Line count** — displayed in the status bar.

### 7.2 Preview Tab

The Preview tab contains a sandboxed `<iframe>`. After translation, the IDE:

1. Creates an HTML string: `<!DOCTYPE html><html><body><script>[output JS]</script></body></html>`.
2. Writes it to the iframe via `srcdoc`.

The preview updates automatically on each successful translation.

The iframe is sandboxed with `allow-scripts` but **not** `allow-same-origin`, ensuring the preview JS cannot access the IDE's own localStorage or DOM.

**Preview controls:**
- **Reload** — re-runs the preview from the current output JS.
- **Open in new tab** — opens the preview HTML in a new browser tab (useful for fullscreen testing).
- **Device width selector** — constrains the iframe width to common breakpoints: Desktop, Tablet (768px), Mobile (375px).

---

## 8. Diagnostics Panel

The Diagnostics Panel sits at the bottom of the IDE, below the four main panels. It is collapsed by default and expands automatically when there are errors after a translation attempt.

**Panel contents:**

Each diagnostic item shows:
- An icon (red circle = error, amber triangle = warning).
- Source file label (`turtle`, `plsq`, or `uidsl`).
- Line number and column.
- Message text.

**Clicking a diagnostic item:**
- Focuses the relevant editor panel.
- Scrolls to the error line.
- Briefly highlights the error range.

**Clear button:** Clears all diagnostics (does not fix them).

---

## 9. Import / Export Workflows

### 9.1 Starting from an Existing Turtle Ontology

1. Click **Import → Import Turtle (.ttl)**.
2. Select your `.ttl` file.
3. The IDE parses and loads the ontology into `urn:ontology`.
4. The Class Tree populates with the imported classes.
5. Begin writing PL/SPARQL and UI DSL referencing the imported terms.

### 9.2 Collaborating via File Exchange

Since the IDE has no server-side persistence, collaboration is file-based:

1. **Export TriG (.trig)** — exports the complete working dataset (ontology + data).
2. Share the `.trig` file with a collaborator.
3. Collaborator opens the IDE and clicks **Import → Import TriG (.trig)**.
4. They also receive the `.plsq` and `.uidsl` files via **Export PL/SPARQL** and **Export UI DSL**.

### 9.3 Round-Trip Editing

All three source files (`.ttl`, `.plsq`, `.uidsl`) can be edited externally (in any text editor) and re-imported. The IDE does not add any markers or IDs to the source files; they remain clean text.

---

## 10. Deploying to GitHub Pages

The output of the Translate step is a single `.js` file. To deploy a complete application to GitHub Pages:

### Step 1 — Create a GitHub repository

```bash
git init my-app
cd my-app
git remote add origin https://github.com/<user>/my-app.git
```

### Step 2 — Create an HTML page

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Application</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <script src="app.js"></script>
</body>
</html>
```

### Step 3 — Export and place the output JS

1. In the IDE, click **Translate**.
2. Click **Export Output JS (.js)**.
3. Save it as `app.js` in the repository root.

### Step 4 — Add CSS (optional)

Create `style.css` with any layout and visual styling. The generated DOM uses standard HTML elements (`<section>`, `<button>`, `<table>`, `<input>`, `<select>`) with no inline styles, so any CSS framework (Bootstrap, Tailwind) can be applied by adding a `<link>` tag to `index.html`.

### Step 5 — Push and enable GitHub Pages

```bash
git add index.html app.js style.css
git commit -m "Deploy application"
git push -u origin main
```

In the GitHub repository settings, go to **Pages** → set **Source** to `main` branch, root folder. GitHub Pages will publish the site at `https://<user>.github.io/my-app/`.

### Step 6 — Updating the application

After making changes in the IDE:
1. Click **Translate**.
2. Click **Export Output JS (.js)**.
3. Replace `app.js` in the repository.
4. Commit and push.

There is no CI/CD step required; GitHub Pages serves static files directly.

---

## 11. Keyboard Reference (Quick Card)

| Action | Shortcut |
|---|---|
| Translate | `Ctrl+Enter` |
| Autocomplete | `Ctrl+Space` |
| Toggle comment | `Ctrl+/` |
| Find | `Ctrl+F` |
| Find & replace | `Ctrl+H` |
| Save to localStorage | `Ctrl+S` |
| Switch to Ontology panel | `Alt+1` |
| Switch to DSL panel | `Alt+2` |
| Switch to UI DSL panel | `Alt+3` |
| Switch to Output/Preview | `Alt+4` |
| Toggle Diagnostics panel | `Alt+D` |
| Toggle Graph Visualisation | `Alt+G` |

---

## 12. Troubleshooting

### "Translation failed — prefix not declared"

All prefixes used in the PL/SPARQL or UI DSL sources must be declared at the top of that file with `PREFIX`. Check that each `PREFIX` line matches between your `.plsq` and `.uidsl` files.

### "Function not found: myFunction"

A `CALL myFunction` in the UI DSL could not find `FUNCTION myFunction` in the PL/SPARQL source. Check spelling and that the function is declared at the top level (not nested inside another function).

### Preview is blank

- Check the Diagnostics panel for errors that may have caused translation to fail.
- Open the browser developer console while the Preview tab is visible and look for JavaScript errors from within the iframe.
- Ensure the initial window has at least one widget.

### Autocomplete not showing ontology terms

- Confirm that the ontology has been saved (or that the raw Turtle in the Ontology Editor has been applied).
- Check that the PREFIX declaration in the editor matches the namespace used in the ontology.
- Click outside the editor and back in to trigger a re-index.

### localStorage quota exceeded

The browser allows approximately 5–10 MB of localStorage. For projects with large instance datasets, export to TriG regularly and consider reducing the number of individuals stored in `urn:data`. The IDE will warn when approaching 80% of the estimated quota.
