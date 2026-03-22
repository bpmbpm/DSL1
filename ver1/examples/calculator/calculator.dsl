// ============================================================================
// Calculator Application - PL/SPARQL DSL
// File: calculator.dsl
//
// Demonstrates:
//   FUNCTION definitions, la-if, la-forEach, map, filter,
//   SPARQL SELECT/INSERT, GENERATE_IRI, named-graph scoping.
//
// Naming convention:
//   Identical JS operators keep their JS names  (+, -, *, /, ===, return, let)
//   Modified/extended constructs use the "la-" prefix  (la-if, la-forEach,
//   la-switch, la-try, la-throw)
// ============================================================================

PREFIX calc: <https://github.com/bpmbpm/DSL1/ontology/calculator#>
PREFIX dsl:  <https://github.com/bpmbpm/DSL1/ontology#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

// Load ontology context for this module
USE GRAPH <calculator>

// ============================================================================
// FUNCTION getOperations
//
// Queries the tripleStore for all Operation individuals defined in the
// calculator ontology and returns them ordered by dsl:order.
// Return type: ResultSet { ?op: IRI, ?label: xsd:string, ?symbol: xsd:string }
// ============================================================================
FUNCTION getOperations() {
  SELECT ?op ?label ?symbol ?orderVal WHERE {
    GRAPH <calculator> {
      ?op a calc:Operation .
      ?op calc:operationName   ?label .
      ?op calc:operationSymbol ?symbol .
      ?op dsl:order            ?orderVal .
    }
  }
  ORDER BY ASC(?orderVal)
}

// ============================================================================
// FUNCTION getOperationByName
//
// Looks up a single Operation individual by its operationName string.
// Used internally to validate the operationType argument before dispatch.
// ============================================================================
FUNCTION getOperationByName(opName) {
  SELECT ?op ?symbol WHERE {
    GRAPH <calculator> {
      ?op a calc:Operation .
      ?op calc:operationName ?name .
      FILTER (?name = opName)
    }
  }
  LIMIT 1
}

// ============================================================================
// FUNCTION calculate
//
// Pure arithmetic dispatcher.  Accepts two numeric operands and an operation
// name string.  Returns the numeric result, or an error string on division
// by zero or unknown operation.
//
// la-if is used instead of plain JS if because the DSL evaluator performs
// SPARQL-aware type coercion on the condition before branching.
// ============================================================================
FUNCTION calculate(operand1, operand2, operationType) {

  // Validate inputs
  la-if (operand1 === null || operand2 === null) {
    return "Error: Both operands are required"
  }

  la-if (operationType === null || operationType === "") {
    return "Error: Please select an operation"
  }

  // Dispatch on operationType
  la-if (operationType === "add") {
    return operand1 + operand2
  }

  la-if (operationType === "subtract") {
    return operand1 - operand2
  }

  la-if (operationType === "multiply") {
    return operand1 * operand2
  }

  la-if (operationType === "divide") {
    la-if (operand2 === 0) {
      return "Error: Division by zero"
    }
    return operand1 / operand2
  }

  // Fallback for unknown operation type
  return "Error: Unknown operation: " + operationType
}

// ============================================================================
// FUNCTION storeResult
//
// Writes a completed calculation as an immutable Result individual into the
// <calculator> named graph.  Returns the newly minted result IRI.
//
// GENERATE_IRI mints a fresh IRI in the calc: namespace each invocation,
// analogous to a UUID-based identifier.
// ============================================================================
FUNCTION storeResult(operand1, operand2, operationType, result) {

  // Do not persist error strings
  la-if (typeof result === "string" && result.startsWith("Error")) {
    return null
  }

  let resultId   = GENERATE_IRI(calc:Result)
  let operand1Id = GENERATE_IRI(calc:Operand)
  let operand2Id = GENERATE_IRI(calc:Operand)
  let opIri      = getOperationByName(operationType)[0].op
  let timestamp  = NOW()

  INSERT INTO GRAPH <calculator> {
    resultId   a calc:Result .
    resultId   calc:hasOperand1      operand1Id .
    resultId   calc:hasOperand2      operand2Id .
    resultId   calc:hasOperationType opIri .
    resultId   calc:resultValue      result .
    resultId   calc:resultTimestamp  timestamp .

    operand1Id a calc:Operand .
    operand1Id calc:operandValue operand1 .

    operand2Id a calc:Operand .
    operand2Id calc:operandValue operand2 .
  }

  return resultId
}

// ============================================================================
// FUNCTION getHistory
//
// Retrieves the most recent calculation Results from the <calculator> graph,
// joining through operand and operation individuals to build a flat projection
// suitable for rendering in a LISTVIEW.
// ============================================================================
FUNCTION getHistory() {
  SELECT ?result ?op1Val ?symbol ?op2Val ?resultVal ?timestamp WHERE {
    GRAPH <calculator> {
      ?result   a calc:Result .
      ?result   calc:hasOperand1      ?op1 .
      ?result   calc:hasOperand2      ?op2 .
      ?result   calc:hasOperationType ?opType .
      ?result   calc:resultValue      ?resultVal .
      ?result   calc:resultTimestamp  ?timestamp .

      ?op1      calc:operandValue     ?op1Val .
      ?op2      calc:operandValue     ?op2Val .
      ?opType   calc:operationSymbol  ?symbol .
    }
  }
  ORDER BY DESC(?timestamp)
  LIMIT 10
}

// ============================================================================
// FUNCTION getHistoryCount
//
// Returns a single integer: the total number of completed calculations stored.
// ============================================================================
FUNCTION getHistoryCount() {
  SELECT (COUNT(?result) AS ?total) WHERE {
    GRAPH <calculator> {
      ?result a calc:Result .
    }
  }
}

// ============================================================================
// FUNCTION clearHistory
//
// Removes all Result, Operand individuals from the <calculator> graph.
// This is a destructive operation; use with care.
// ============================================================================
FUNCTION clearHistory() {
  DELETE FROM GRAPH <calculator> {
    ?result   a calc:Result .
    ?result   calc:hasOperand1      ?op1 .
    ?result   calc:hasOperand2      ?op2 .
    ?result   calc:hasOperationType ?opType .
    ?result   calc:resultValue      ?resultVal .
    ?result   calc:resultTimestamp  ?timestamp .

    ?op1      a calc:Operand .
    ?op1      calc:operandValue ?op1Val .

    ?op2      a calc:Operand .
    ?op2      calc:operandValue ?op2Val .
  }
  WHERE {
    GRAPH <calculator> {
      ?result   a calc:Result .
      OPTIONAL { ?result calc:hasOperand1 ?op1 }
      OPTIONAL { ?result calc:hasOperand2 ?op2 }
      OPTIONAL { ?result calc:hasOperationType ?opType }
      OPTIONAL { ?result calc:resultValue ?resultVal }
      OPTIONAL { ?result calc:resultTimestamp ?timestamp }
      OPTIONAL { ?op1   calc:operandValue ?op1Val }
      OPTIONAL { ?op2   calc:operandValue ?op2Val }
    }
  }
  return true
}

// ============================================================================
// FUNCTION formatResult
//
// Pure helper: formats a numeric result for display, capping decimal places.
// Uses la-if rather than the JS ternary because the DSL type system needs to
// coerce xsd:decimal to xsd:string explicitly.
// ============================================================================
FUNCTION formatResult(value, decimalPlaces) {
  la-if (typeof value === "string") {
    // Pass error strings through unchanged
    return value
  }

  let places = decimalPlaces === null ? 10 : decimalPlaces
  let rounded = ROUND(value, places)

  // Strip trailing zeros: convert to string then trim
  let str = STRING(rounded)
  return str
}

// ============================================================================
// FUNCTION getRecentAverage
//
// Demonstrates la-forEach over a result set and accumulation.
// Computes the arithmetic mean of the last N result values.
// ============================================================================
FUNCTION getRecentAverage(limit) {
  let rows = SELECT ?resultVal WHERE {
    GRAPH <calculator> {
      ?result a calc:Result .
      ?result calc:resultValue ?resultVal .
      FILTER (datatype(?resultVal) = xsd:decimal)
    }
  }
  ORDER BY DESC(?result)
  LIMIT limit

  la-if (rows.length === 0) {
    return null
  }

  let total = 0
  la-forEach (rows AS ?row) {
    total = total + ?row.resultVal
  }

  return total / rows.length
}

// ============================================================================
// FUNCTION getOperationFrequency
//
// Groups history by operation type and returns counts, demonstrating
// aggregation inside a PL/SPARQL FUNCTION.
// ============================================================================
FUNCTION getOperationFrequency() {
  SELECT ?opName ?symbol (COUNT(?result) AS ?count) WHERE {
    GRAPH <calculator> {
      ?result  a calc:Result .
      ?result  calc:hasOperationType ?opType .
      ?opType  calc:operationName    ?opName .
      ?opType  calc:operationSymbol  ?symbol .
    }
  }
  GROUP BY ?opName ?symbol
  ORDER BY DESC(?count)
}
