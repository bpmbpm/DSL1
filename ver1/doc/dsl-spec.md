# PL/SPARQL Language Specification

## 1. Introduction and Philosophy

PL/SPARQL is a domain-specific language for writing application logic against an RDF triple/quad store. It is designed around two complementary ideas:

**SPARQL as the query core.** SPARQL 1.1 is an expressive, well-understood language for navigating graph-structured data. PL/SPARQL keeps the full SPARQL 1.1 syntax as its query sublanguage. Any valid SPARQL 1.1 SELECT, CONSTRUCT, ASK, DESCRIBE, INSERT, or DELETE statement is valid PL/SPARQL.

**Functional programming as the logic model.** Application logic is expressed as pure functions where possible. Bindings are immutable by default (`const`), side effects are limited to explicit store mutation operations, and higher-order functions (`map`, `filter`, `reduce`) transform SPARQL result sequences. This makes programs easier to reason about and test.

### 1.1 Naming Convention

The naming convention distinguishes constructs by their relationship to JavaScript:

| Origin | Convention | Examples |
|---|---|---|
| Borrowed directly from JS | Same JS name | `let`, `const`, `return`, `map`, `filter`, `reduce` |
| Modified from JS equivalent | `la-` prefix | `la-if`, `la-forEach` |
| PL/SPARQL original | Uppercase keyword | `FUNCTION`, `BIND`, `INSERT`, `DELETE` |
| SPARQL 1.1 keyword | Unchanged | `SELECT`, `WHERE`, `OPTIONAL`, `FILTER`, `UNION` |

The `la-` prefix is a nod to "à la" — meaning the construct is inspired by its JS counterpart but adapted for the SPARQL/RDF context.

### 1.2 Execution Model

A PL/SPARQL program executes against a live in-memory quad store (an N3.js `Store` instance). Functions read from the store using SPARQL query expressions and write to it using update operations. The result of a SELECT query is a **solution sequence** — an ordered list of variable bindings — which can be passed to `map`, `filter`, and `reduce` just like a JavaScript array.

---

## 2. Lexical Structure

### 2.1 Comments

```
# This is a line comment
```

Comments begin with `#` and extend to the end of the line. Block comments are not supported.

### 2.2 Whitespace

Whitespace (spaces, tabs, newlines) is insignificant except as a separator between tokens.

### 2.3 Identifiers

Identifiers follow the pattern `[a-zA-Z_][a-zA-Z0-9_]*`. They are case-sensitive.

### 2.4 Prefixed Names

Prefixed names follow the Turtle/SPARQL convention: `prefix:localName`. The prefix must be declared with `PREFIX`.

```sparql
PREFIX ex: <http://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
```

---

## 3. Data Types and Literals

PL/SPARQL inherits all RDF/SPARQL data types and adds no additional types at the language level.

### 3.1 RDF Literals

| Type | Example | XSD Datatype |
|---|---|---|
| String | `"hello"` | `xsd:string` |
| Integer | `42` | `xsd:integer` |
| Decimal | `3.14` | `xsd:decimal` |
| Boolean | `true`, `false` | `xsd:boolean` |
| Date | `"2024-01-15"^^xsd:date` | `xsd:date` |
| DateTime | `"2024-01-15T10:00:00"^^xsd:dateTime` | `xsd:dateTime` |
| Language string | `"hello"@en` | `rdf:langString` |

### 3.2 IRIs

IRIs can be written as absolute `<http://example.org/foo>` or as prefixed names `ex:foo`.

### 3.3 Blank Nodes

Blank nodes: `_:label` or anonymous `[]`.

### 3.4 Solution Sequences

The result of a SELECT query is a **solution sequence**, typed internally as `SolutionSequence`. It is an ordered, finite list of **solution mappings** (rows), where each row maps variable names to RDF terms.

---

## 4. Variables and Binding

### 4.1 SPARQL Variables

Within SPARQL query patterns, variables are prefixed with `?` or `$`:

```sparql
SELECT ?name ?age WHERE {
  ?person a ex:Person ;
    ex:name ?name ;
    ex:age ?age .
}
```

### 4.2 `let` — Mutable Local Binding

```
let <identifier> = <expression> ;
```

Creates a mutable local variable. Rebinding with `=` is allowed within the same scope.

```
let count = 0 ;
let results = SELECT ?x WHERE { ?x a ex:Item . } ;
```

### 4.3 `const` — Immutable Local Binding

```
const <identifier> = <expression> ;
```

Creates an immutable local binding. Attempting to rebind a `const` is a compile-time error.

```
const allPersons = SELECT ?p ?name WHERE {
  ?p a ex:Person ; ex:name ?name .
} ;
```

### 4.4 Scope

Variables declared with `let` or `const` are scoped to the enclosing `FUNCTION` body or the top-level program block. PL/SPARQL uses **lexical scoping**.

---

## 5. Query Expressions

A **query expression** is a SPARQL query form embedded directly as an expression. The result value is a solution sequence (`SolutionSequence`) for SELECT, a boolean for ASK, and an RDF graph for CONSTRUCT/DESCRIBE.

### 5.1 SELECT

```sparql
SELECT ?var1 ?var2 ... WHERE {
  <graph-pattern>
}
[ORDER BY ...]
[LIMIT n]
[OFFSET n]
```

Example:

```sparql
const employees = SELECT ?emp ?name WHERE {
  ?emp a ex:Employee ;
       ex:name ?name ;
       ex:department ex:Engineering .
} ORDER BY ?name ;
```

### 5.2 ASK

```sparql
ASK WHERE { <graph-pattern> }
```

Returns `true` or `false`.

```sparql
const exists = ASK WHERE { ex:alice a ex:Person . } ;
```

### 5.3 CONSTRUCT

```sparql
CONSTRUCT { <template> } WHERE { <graph-pattern> }
```

Returns a new RDF graph (as a set of triples).

### 5.4 DESCRIBE

```sparql
DESCRIBE <iri-or-var> WHERE { <graph-pattern> }
```

---

## 6. Graph Patterns

All SPARQL 1.1 graph patterns are supported within WHERE clauses.

### 6.1 Triple Patterns

```sparql
?subject ?predicate ?object .
ex:alice ex:name ?name .
?x a ex:Person .          # shorthand for ?x rdf:type ex:Person
```

### 6.2 OPTIONAL

```sparql
WHERE {
  ?p a ex:Person ; ex:name ?name .
  OPTIONAL { ?p ex:phone ?phone . }
}
```

### 6.3 FILTER

```sparql
WHERE {
  ?p ex:age ?age .
  FILTER (?age >= 18)
}
```

FILTER expressions support all SPARQL built-in functions: `BOUND`, `isIRI`, `isLiteral`, `str`, `lang`, `datatype`, `regex`, `strlen`, arithmetic operators, comparison operators, logical operators (`&&`, `||`, `!`).

### 6.4 UNION

```sparql
WHERE {
  { ?x a ex:Cat . } UNION { ?x a ex:Dog . }
}
```

### 6.5 BIND

```sparql
WHERE {
  ?p ex:firstName ?first ; ex:lastName ?last .
  BIND(CONCAT(?first, " ", ?last) AS ?fullName)
}
```

### 6.6 Named Graph Patterns

```sparql
WHERE {
  GRAPH <urn:data> {
    ?x a ex:Person .
  }
}
```

### 6.7 VALUES (Inline Data)

```sparql
WHERE {
  VALUES ?status { ex:Active ex:Pending }
  ?ticket ex:status ?status .
}
```

### 6.8 Subqueries

```sparql
WHERE {
  {
    SELECT ?dept (COUNT(?emp) AS ?empCount) WHERE {
      ?emp ex:department ?dept .
    } GROUP BY ?dept
  }
}
```

---

## 7. Procedural Extensions

### 7.1 `FUNCTION` — Function Definition

```
FUNCTION <name>(<param1>, <param2>, ...) {
  <body>
}
```

Functions are first-class values and can be passed as arguments to `map`, `filter`, `reduce`.

```
FUNCTION getPersonName(personIRI) {
  const result = SELECT ?name WHERE {
    <personIRI> ex:name ?name .
  } ;
  return result[0].name ;
}
```

Parameters are passed by value. IRI parameters are passed as strings internally and re-wrapped when used in triple patterns.

### 7.2 `return`

```
return <expression> ;
```

Exits the enclosing function and produces the given value. `return` with no expression produces `undefined`.

### 7.3 `la-if` — Conditional Execution

`la-if` differs from JavaScript `if` in that it is an **expression** (it returns a value) and the condition must be a boolean-typed RDF literal or a PL/SPARQL boolean expression. There is no implicit type coercion.

```
la-if (<condition>) {
  <then-body>
} la-else {
  <else-body>
}
```

As an expression:

```
const label = la-if (ASK WHERE { ex:alice ex:active true . }) {
  "Active"
} la-else {
  "Inactive"
} ;
```

`la-else` is optional. Without it, `la-if` returns `undefined` when the condition is false.

Nested:

```
la-if (x > 10) {
  "high"
} la-else la-if (x > 5) {
  "medium"
} la-else {
  "low"
}
```

### 7.4 `la-forEach` — Iteration Over Solution Sequences

`la-forEach` differs from JavaScript `forEach` in that it iterates over a **solution sequence** (SPARQL result rows) rather than a plain array, and the iteration variable is a **solution mapping** (an object with variable names as keys).

```
la-forEach (<solution-sequence>) |<row-var>| {
  <body>
}
```

Example:

```
const people = SELECT ?p ?name WHERE { ?p a ex:Person ; ex:name ?name . } ;

la-forEach (people) |row| {
  INSERT DATA {
    GRAPH <urn:processed> {
      row.p ex:processed true .
    }
  }
}
```

Unlike `map`/`filter`/`reduce`, `la-forEach` is used for **side effects** only and returns no value.

### 7.5 `map` — Transform a Solution Sequence

Borrowed from JavaScript. Applied to a `SolutionSequence`, it produces a new array of transformed values.

```
map(<solution-sequence>, <function>)
```

The function receives a single solution mapping (row) and returns a transformed value.

```
const names = map(
  SELECT ?name WHERE { ?p a ex:Person ; ex:name ?name . },
  FUNCTION(row) { return row.name ; }
) ;
```

The result of `map` is a plain JavaScript array of values, not a SolutionSequence.

### 7.6 `filter` — Filter a Solution Sequence

Borrowed from JavaScript. Applied to a `SolutionSequence`, it returns a new `SolutionSequence` containing only rows where the predicate function returns `true`.

```
filter(<solution-sequence>, <predicate-function>)
```

```
const adults = filter(
  SELECT ?p ?age WHERE { ?p ex:age ?age . },
  FUNCTION(row) { return row.age >= 18 ; }
) ;
```

### 7.7 `reduce` — Aggregate a Solution Sequence

Borrowed from JavaScript.

```
reduce(<solution-sequence>, <reducer-function>, <initial-value>)
```

```
const totalSalary = reduce(
  SELECT ?salary WHERE { ?emp ex:salary ?salary . },
  FUNCTION(acc, row) { return acc + row.salary ; },
  0
) ;
```

---

## 8. Graph Mutation Operations

### 8.1 INSERT DATA

Adds a fixed set of triples/quads to the store.

```sparql
INSERT DATA {
  GRAPH <urn:data> {
    ex:bob a ex:Person ;
      ex:name "Bob" ;
      ex:age 30 .
  }
}
```

### 8.2 DELETE DATA

Removes a fixed set of triples/quads from the store.

```sparql
DELETE DATA {
  GRAPH <urn:data> {
    ex:bob ex:age 30 .
  }
}
```

### 8.3 INSERT / DELETE WHERE

Pattern-based update using a WHERE clause.

```sparql
DELETE { GRAPH <urn:data> { ?p ex:age ?old . } }
INSERT { GRAPH <urn:data> { ?p ex:age 31 . } }
WHERE  { GRAPH <urn:data> { ex:bob ex:age ?old . } }
```

### 8.4 CLEAR

Removes all triples from a named graph.

```sparql
CLEAR GRAPH <urn:data>
```

---

## 9. Operators and Built-in Functions

### 9.1 Arithmetic Operators

`+`, `-`, `*`, `/`, `%` (modulo)

### 9.2 Comparison Operators

`=`, `!=`, `<`, `>`, `<=`, `>=`

For RDF terms, these follow SPARQL ordering semantics (IRIs, then blank nodes, then literals by type/value).

### 9.3 Logical Operators

`&&` (and), `||` (or), `!` (not)

### 9.4 String Functions

| Function | Description |
|---|---|
| `CONCAT(s1, s2, ...)` | String concatenation |
| `STRLEN(s)` | String length |
| `SUBSTR(s, start, len?)` | Substring |
| `UCASE(s)` | Uppercase |
| `LCASE(s)` | Lowercase |
| `CONTAINS(s, sub)` | Substring test |
| `STRSTARTS(s, prefix)` | Prefix test |
| `STRENDS(s, suffix)` | Suffix test |
| `REGEX(s, pattern, flags?)` | Regular expression match |
| `REPLACE(s, pattern, replacement)` | Regex replace |

### 9.5 Numeric Functions

`ABS`, `ROUND`, `CEIL`, `FLOOR`, `RAND`

### 9.6 Date/Time Functions

`NOW()`, `YEAR(?dt)`, `MONTH(?dt)`, `DAY(?dt)`, `HOURS(?dt)`, `MINUTES(?dt)`, `SECONDS(?dt)`

### 9.7 Type Functions

`STR(?x)` — RDF term to string
`LANG(?x)` — language tag of a literal
`DATATYPE(?x)` — datatype IRI of a typed literal
`IRI(str)` — construct an IRI from a string
`BNODE()` — create a fresh blank node
`isIRI(?x)`, `isLiteral(?x)`, `isBlank(?x)`, `isBound(?x)`

### 9.8 Aggregate Functions (within SELECT)

`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP_CONCAT`, `SAMPLE`

---

## 10. Graphic Representation Primitives

PL/SPARQL includes a declarative description of graphic primitives that the translator maps to canvas/SVG drawing calls in the output JS. These are used for data visualisation.

### 10.1 `DRAW RECTANGLE`

```
DRAW RECTANGLE (x, y, width, height) ;
```

Emits a rectangle on the current drawing context.

### 10.2 `DRAW CIRCLE`

```
DRAW CIRCLE (cx, cy, radius) ;
```

### 10.3 `DRAW LINE`

```
DRAW LINE (x1, y1, x2, y2) ;
```

### 10.4 `DRAW TEXT`

```
DRAW TEXT (x, y, string) ;
```

### 10.5 `DRAW PATH`

```
DRAW PATH [ (x1,y1), (x2,y2), (x3,y3), ... ] ;
```

Draws an open polyline through the given points.

### 10.6 `DRAW POLYGON`

```
DRAW POLYGON [ (x1,y1), (x2,y2), (x3,y3), ... ] ;
```

Draws a closed polygon.

These primitives are always relative to a **drawing context** established by a `CANVAS` UI DSL element (see UI DSL spec). The translator converts them to `CanvasRenderingContext2D` calls.

---

## 11. Full Grammar (EBNF)

```ebnf
Program          ::= (PrefixDecl | FunctionDecl | Statement)* ;

PrefixDecl       ::= 'PREFIX' PNAME_NS IRIREF ;

FunctionDecl     ::= 'FUNCTION' Identifier '(' ParamList? ')' Block ;
ParamList        ::= Identifier (',' Identifier)* ;

Block            ::= '{' Statement* '}' ;

Statement        ::= LetStatement
                   | ConstStatement
                   | ReturnStatement
                   | LaIfStatement
                   | LaForEachStatement
                   | MapStatement
                   | FilterStatement
                   | ReduceStatement
                   | UpdateOperation
                   | DrawStatement
                   | ExpressionStatement ;

LetStatement     ::= 'let' Identifier '=' Expression ';' ;
ConstStatement   ::= 'const' Identifier '=' Expression ';' ;
ReturnStatement  ::= 'return' Expression? ';' ;

LaIfStatement    ::= 'la-if' '(' Expression ')' Block
                     ('la-else' 'la-if' '(' Expression ')' Block)*
                     ('la-else' Block)? ;

LaForEachStatement ::= 'la-forEach' '(' Expression ')' '|' Identifier '|' Block ;

MapStatement     ::= 'map' '(' Expression ',' FunctionExpr ')' ;
FilterStatement  ::= 'filter' '(' Expression ',' FunctionExpr ')' ;
ReduceStatement  ::= 'reduce' '(' Expression ',' FunctionExpr ',' Expression ')' ;

FunctionExpr     ::= FunctionDecl | Identifier ;

UpdateOperation  ::= InsertData | DeleteData | InsertDeleteWhere | ClearGraph ;

InsertData       ::= 'INSERT' 'DATA' '{' QuadData '}' ;
DeleteData       ::= 'DELETE' 'DATA' '{' QuadData '}' ;
InsertDeleteWhere::= ('DELETE' '{' QuadPattern '}')?
                     ('INSERT' '{' QuadPattern '}')?
                     'WHERE' '{' GroupGraphPattern '}' ;
ClearGraph       ::= 'CLEAR' 'GRAPH' IRIOrPrefixed ;

Expression       ::= SelectQuery
                   | AskQuery
                   | ConstructQuery
                   | InfixExpression
                   | PrimaryExpression ;

SelectQuery      ::= 'SELECT' SelectClause 'WHERE' '{' GroupGraphPattern '}'
                     SolutionModifier ;

SelectClause     ::= ('DISTINCT'? (SelectVar+ | '*')) ;
SelectVar        ::= Var | ('(' Expression 'AS' Var ')') ;

SolutionModifier ::= OrderClause? LimitClause? OffsetClause? ;
OrderClause      ::= 'ORDER' 'BY' (('ASC'|'DESC') '(' Expression ')' | Expression)+ ;
LimitClause      ::= 'LIMIT' INTEGER ;
OffsetClause     ::= 'OFFSET' INTEGER ;

GroupGraphPattern ::= TriplesBlock? (GraphPatternNotTriples TriplesBlock?)* ;
TriplesBlock     ::= TriplePattern+ ;
TriplePattern    ::= VarOrTerm VarOrTerm VarOrTerm '.' ;

GraphPatternNotTriples ::= GroupOrUnionGraphPattern
                          | OptionalGraphPattern
                          | MinusGraphPattern
                          | GraphGraphPattern
                          | BindClause
                          | InlineData
                          | Filter
                          | SubQuery ;

OptionalGraphPattern  ::= 'OPTIONAL' '{' GroupGraphPattern '}' ;
GroupOrUnionGraphPattern ::= '{' GroupGraphPattern '}' ('UNION' '{' GroupGraphPattern '}')* ;
Filter               ::= 'FILTER' '(' Expression ')' ;
BindClause           ::= 'BIND' '(' Expression 'AS' Var ')' ;
InlineData           ::= 'VALUES' VarList '{' DataBlock '}' ;
GraphGraphPattern    ::= 'GRAPH' (Var | IRIOrPrefixed) '{' GroupGraphPattern '}' ;
SubQuery             ::= '{' SelectQuery '}' ;

DrawStatement    ::= 'DRAW' DrawPrimitive ';' ;
DrawPrimitive    ::= 'RECTANGLE' '(' Expr ',' Expr ',' Expr ',' Expr ')'
                   | 'CIRCLE'    '(' Expr ',' Expr ',' Expr ')'
                   | 'LINE'      '(' Expr ',' Expr ',' Expr ',' Expr ')'
                   | 'TEXT'      '(' Expr ',' Expr ',' Expr ')'
                   | 'PATH'      '[' PointList ']'
                   | 'POLYGON'   '[' PointList ']' ;
PointList        ::= '(' Expr ',' Expr ')' (',' '(' Expr ',' Expr ')')* ;

InfixExpression  ::= PrimaryExpression (InfixOp PrimaryExpression)* ;
InfixOp          ::= '+' | '-' | '*' | '/' | '%' | '=' | '!=' | '<' | '>'
                   | '<=' | '>=' | '&&' | '||' ;

PrimaryExpression ::= Literal | IRIOrPrefixed | Var | '(' Expression ')'
                    | FunctionCall | Identifier ;

FunctionCall     ::= Identifier '(' ArgList? ')' ;
ArgList          ::= Expression (',' Expression)* ;

Var              ::= '?' Identifier | '$' Identifier ;
IRIOrPrefixed    ::= IRIREF | PrefixedName ;
Literal          ::= STRING | INTEGER | DECIMAL | BOOLEAN | RDFTypedLiteral ;
RDFTypedLiteral  ::= STRING '^^' IRIOrPrefixed ;
```

---

## 12. Worked Examples

### 12.1 Hello World — Query and Display

```
PREFIX ex: <http://example.org/>

const greeting = SELECT ?msg WHERE {
  ex:config ex:greeting ?msg .
} ;

return greeting[0].msg ;
```

### 12.2 Function with Conditional Logic

```
PREFIX ex: <http://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

FUNCTION classifyAge(personIRI) {
  const result = SELECT ?age WHERE {
    personIRI ex:age ?age .
  } ;
  const age = result[0].age ;

  return la-if (age < 18) {
    "minor"
  } la-else la-if (age < 65) {
    "adult"
  } la-else {
    "senior"
  } ;
}
```

### 12.3 Batch Insert Using `la-forEach`

```
PREFIX ex: <http://example.org/>

const unprocessed = SELECT ?item WHERE {
  ?item a ex:QueueItem .
  FILTER NOT EXISTS { ?item ex:processed true . }
} ;

la-forEach (unprocessed) |row| {
  INSERT DATA {
    GRAPH <urn:data> {
      row.item ex:processed true ;
               ex:processedAt "2024-01-15"^^xsd:date .
    }
  }
}
```

### 12.4 Aggregation with `reduce`

```
PREFIX ex: <http://example.org/>

const sales = SELECT ?amount WHERE {
  ?sale a ex:Sale ; ex:amount ?amount .
} ;

const total = reduce(sales, FUNCTION(acc, row) {
  return acc + row.amount ;
}, 0) ;

return total ;
```

### 12.5 Data Transformation with `map`

```
PREFIX ex: <http://example.org/>

const people = SELECT ?p ?first ?last WHERE {
  ?p a ex:Person ;
     ex:firstName ?first ;
     ex:lastName  ?last .
} ;

const fullNames = map(people, FUNCTION(row) {
  return CONCAT(row.first, " ", row.last) ;
}) ;
```

### 12.6 Graph Mutation — Rename a Person

```
PREFIX ex: <http://example.org/>

FUNCTION renamePerson(personIRI, newName) {
  const oldName = SELECT ?n WHERE { personIRI ex:name ?n . } ;

  DELETE DATA {
    GRAPH <urn:data> { personIRI ex:name oldName[0].n . }
  }

  INSERT DATA {
    GRAPH <urn:data> { personIRI ex:name newName . }
  }
}
```
