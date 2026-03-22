// ============================================================================
// Inventory Management Application - PL/SPARQL DSL
// File: inventory.dsl
//
// Demonstrates:
//   Optional FILTER parameters, arithmetic on xsd:decimal/xsd:integer,
//   aggregation (SUM, COUNT), signed delta updates with bounds checking,
//   la-if for validation, la-forEach for accumulation, GENERATE_IRI,
//   multi-step INSERT/DELETE for stock quantity updates.
// ============================================================================

PREFIX inv: <https://github.com/bpmbpm/DSL1/ontology/inventory#>
PREFIX dsl: <https://github.com/bpmbpm/DSL1/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

USE GRAPH <inventory>

// ============================================================================
// FUNCTION getProducts
//
// Returns all products, optionally filtered by category IRI.
// Pass null or "" for categoryFilter to return all products.
// Joins through StockEntry to compute totalQty across all locations.
// ============================================================================
FUNCTION getProducts(categoryFilter) {
  SELECT ?product ?code ?name ?description
         ?categoryName ?supplierName
         ?unitPrice ?reorderThreshold
         (SUM(COALESCE(?qty, 0)) AS ?totalQty) WHERE {
    GRAPH <inventory> {
      ?product a inv:Product .
      ?product inv:productCode  ?code .
      ?product inv:productName  ?name .
      ?product inv:unitPrice    ?unitPrice .
      ?product inv:hasCategory  ?category .

      ?category inv:categoryName ?categoryName .

      OPTIONAL { ?product inv:productDescription  ?description }
      OPTIONAL { ?product inv:reorderThreshold    ?reorderThreshold }
      OPTIONAL {
        ?product inv:hasPrimarySupplier ?supplier .
        ?supplier inv:supplierName ?supplierName .
      }
      OPTIONAL {
        ?entry inv:stockEntryFor ?product .
        ?entry inv:quantity      ?qty .
      }

      FILTER (categoryFilter === null || categoryFilter === "" ||
              ?category = categoryFilter)
    }
  }
  GROUP BY ?product ?code ?name ?description
           ?categoryName ?supplierName ?unitPrice ?reorderThreshold
  ORDER BY ASC(?name)
}

// ============================================================================
// FUNCTION getProductById
//
// Fetches full details for a single product by its IRI.
// ============================================================================
FUNCTION getProductById(productId) {
  la-if (productId === null || productId === "") {
    return null
  }

  SELECT ?code ?name ?description ?unitPrice ?reorderThreshold
         ?category ?categoryName
         ?primarySupplier ?supplierName WHERE {
    GRAPH <inventory> {
      productId a inv:Product .
      productId inv:productCode ?code .
      productId inv:productName ?name .
      productId inv:unitPrice   ?unitPrice .
      productId inv:hasCategory ?category .

      ?category inv:categoryName ?categoryName .

      OPTIONAL { productId inv:productDescription   ?description }
      OPTIONAL { productId inv:reorderThreshold     ?reorderThreshold }
      OPTIONAL {
        productId inv:hasPrimarySupplier ?primarySupplier .
        ?primarySupplier inv:supplierName ?supplierName .
      }
    }
  }
  LIMIT 1
}

// ============================================================================
// FUNCTION getCategories
//
// Returns all Category individuals for populating filter dropdowns.
// ============================================================================
FUNCTION getCategories() {
  SELECT ?category ?name ?parentName WHERE {
    GRAPH <inventory> {
      ?category a inv:Category .
      ?category inv:categoryName ?name .
      OPTIONAL {
        ?category inv:hasParentCategory ?parent .
        ?parent   inv:categoryName      ?parentName .
      }
    }
  }
  ORDER BY ASC(?name)
}

// ============================================================================
// FUNCTION getLocations
//
// Returns all Location individuals.
// ============================================================================
FUNCTION getLocations() {
  SELECT ?location ?name ?code WHERE {
    GRAPH <inventory> {
      ?location a inv:Location .
      ?location inv:locationName ?name .
      OPTIONAL { ?location inv:locationCode ?code }
    }
  }
  ORDER BY ASC(?name)
}

// ============================================================================
// FUNCTION getSuppliers
//
// Returns all Supplier individuals for populating supplier dropdowns.
// ============================================================================
FUNCTION getSuppliers() {
  SELECT ?supplier ?name ?contact WHERE {
    GRAPH <inventory> {
      ?supplier a inv:Supplier .
      ?supplier inv:supplierName ?name .
      OPTIONAL { ?supplier inv:supplierContact ?contact }
    }
  }
  ORDER BY ASC(?name)
}

// ============================================================================
// FUNCTION getStockEntries
//
// Returns all StockEntry records, optionally for a specific product.
// Joins through Location to provide a complete picture per entry.
// ============================================================================
FUNCTION getStockEntries(productId) {
  SELECT ?entry ?productName ?locationName ?locationCode ?quantity WHERE {
    GRAPH <inventory> {
      ?entry a inv:StockEntry .
      ?entry inv:stockEntryFor ?product .
      ?entry inv:storedAt      ?location .
      ?entry inv:quantity      ?quantity .

      ?product  inv:productName  ?productName .
      ?location inv:locationName ?locationName .
      OPTIONAL { ?location inv:locationCode ?locationCode }

      FILTER (productId === null || productId === "" ||
              ?product = productId)
    }
  }
  ORDER BY ASC(?productName) ASC(?locationName)
}

// ============================================================================
// FUNCTION getLowStockProducts
//
// Returns products whose total quantity across all locations is at or below
// the supplied threshold.  When threshold is null, uses each product's own
// reorderThreshold.  Products without a reorderThreshold are ignored when
// threshold is null.
// ============================================================================
FUNCTION getLowStockProducts(threshold) {
  SELECT ?product ?code ?name ?totalQty ?reorderThreshold
         ?categoryName ?supplierName ?unitPrice WHERE {
    {
      SELECT ?product (SUM(?qty) AS ?totalQty) WHERE {
        GRAPH <inventory> {
          ?entry inv:stockEntryFor ?product .
          ?entry inv:quantity      ?qty .
        }
      }
      GROUP BY ?product
    }

    GRAPH <inventory> {
      ?product a inv:Product .
      ?product inv:productCode ?code .
      ?product inv:productName ?name .
      ?product inv:unitPrice   ?unitPrice .
      ?product inv:hasCategory ?category .
      ?category inv:categoryName ?categoryName .

      OPTIONAL { ?product inv:reorderThreshold ?reorderThreshold }
      OPTIONAL {
        ?product inv:hasPrimarySupplier ?supplier .
        ?supplier inv:supplierName ?supplierName .
      }
    }

    // Apply threshold: explicit value wins; else use per-product threshold
    FILTER (
      (threshold !== null && threshold !== "" && ?totalQty <= threshold) ||
      (threshold === null || threshold === "") &&
      bound(?reorderThreshold) && ?totalQty <= ?reorderThreshold
    )
  }
  ORDER BY ASC(?totalQty) ASC(?name)
}

// ============================================================================
// FUNCTION updateStock
//
// Adds delta (positive or negative integer) to the quantity of a StockEntry
// identified by productId and locationId.  If no StockEntry yet exists for
// the (product, location) pair, one is created with quantity = delta (only
// when delta > 0).
//
// Records an immutable StockMovement for audit purposes.
// Returns the updated StockEntry IRI, or an error string.
// ============================================================================
FUNCTION updateStock(productId, locationId, delta, note) {

  la-if (productId === null || productId === "") {
    return "Error: productId is required"
  }
  la-if (locationId === null || locationId === "") {
    return "Error: locationId is required"
  }
  la-if (delta === null || delta === 0) {
    return "Error: delta must be a non-zero integer"
  }

  // Look up existing stock entry
  let entryRows = SELECT ?entry ?currentQty WHERE {
    GRAPH <inventory> {
      ?entry inv:stockEntryFor productId .
      ?entry inv:storedAt      locationId .
      ?entry inv:quantity      ?currentQty .
    }
  }
  LIMIT 1

  let entryId  = null
  let newQty   = null

  la-if (entryRows.length > 0) {
    entryId = entryRows[0].entry
    newQty  = entryRows[0].currentQty + delta

    la-if (newQty < 0) {
      return "Error: Insufficient stock. Current: " +
             STRING(entryRows[0].currentQty) +
             ", requested delta: " + STRING(delta)
    }

    // Update quantity in place
    DELETE FROM GRAPH <inventory> {
      entryId inv:quantity ?oldQty .
    }
    WHERE {
      GRAPH <inventory> {
        entryId inv:quantity ?oldQty .
      }
    }

    INSERT INTO GRAPH <inventory> {
      entryId inv:quantity newQty .
    }

  } else {
    // No existing entry: create one (only for positive deltas)
    la-if (delta < 0) {
      return "Error: No stock entry exists for this product at the given location"
    }

    entryId = GENERATE_IRI(inv:StockEntry)
    newQty  = delta

    INSERT INTO GRAPH <inventory> {
      entryId a inv:StockEntry .
      entryId inv:stockEntryFor productId .
      entryId inv:storedAt      locationId .
      entryId inv:quantity      newQty .
    }
  }

  // Append audit movement
  let movementId = GENERATE_IRI(inv:StockMovement)
  let timestamp  = NOW()

  INSERT INTO GRAPH <inventory> {
    movementId a inv:StockMovement .
    movementId inv:movementFor       entryId .
    movementId inv:movementDelta     delta .
    movementId inv:movementTimestamp timestamp .
  }

  la-if (note !== null && note !== "") {
    INSERT INTO GRAPH <inventory> {
      movementId inv:movementNote note .
    }
  }

  return entryId
}

// ============================================================================
// FUNCTION addProduct
//
// Inserts a new Product individual into the <inventory> graph.
// Returns the new product IRI or an error string.
// ============================================================================
FUNCTION addProduct(code, name, categoryId, supplierId, unitPrice, description, reorderThreshold) {

  la-if (code === null || code === "") {
    return "Error: Product code is required"
  }
  la-if (name === null || name === "") {
    return "Error: Product name is required"
  }
  la-if (categoryId === null || categoryId === "") {
    return "Error: Category is required"
  }
  la-if (unitPrice === null || unitPrice < 0) {
    return "Error: unitPrice must be a non-negative number"
  }

  // Check that the product code is unique
  let existingRows = SELECT ?p WHERE {
    GRAPH <inventory> {
      ?p a inv:Product .
      ?p inv:productCode code .
    }
  }
  LIMIT 1

  la-if (existingRows.length > 0) {
    return "Error: Product code '" + code + "' already exists"
  }

  let productId = GENERATE_IRI(inv:Product)

  INSERT INTO GRAPH <inventory> {
    productId a inv:Product .
    productId inv:productCode  code .
    productId inv:productName  name .
    productId inv:hasCategory  categoryId .
    productId inv:unitPrice    unitPrice .
  }

  la-if (description !== null && description !== "") {
    INSERT INTO GRAPH <inventory> {
      productId inv:productDescription description .
    }
  }

  la-if (supplierId !== null && supplierId !== "") {
    INSERT INTO GRAPH <inventory> {
      productId inv:hasPrimarySupplier supplierId .
      productId inv:hasSupplier        supplierId .
    }
  }

  la-if (reorderThreshold !== null && reorderThreshold > 0) {
    INSERT INTO GRAPH <inventory> {
      productId inv:reorderThreshold reorderThreshold .
    }
  }

  return productId
}

// ============================================================================
// FUNCTION updateProduct
//
// Updates mutable fields of an existing Product.
// Pass null for any field that should remain unchanged.
// ============================================================================
FUNCTION updateProduct(productId, name, description, categoryId, supplierId, unitPrice, reorderThreshold) {

  la-if (productId === null || productId === "") {
    return "Error: productId is required"
  }

  la-if (name !== null && name !== "") {
    DELETE FROM GRAPH <inventory> { productId inv:productName ?v }
    WHERE { GRAPH <inventory> { productId inv:productName ?v } }
    INSERT INTO GRAPH <inventory> { productId inv:productName name . }
  }

  la-if (description !== null) {
    DELETE FROM GRAPH <inventory> { productId inv:productDescription ?v }
    WHERE { GRAPH <inventory> { OPTIONAL { productId inv:productDescription ?v } } }
    la-if (description !== "") {
      INSERT INTO GRAPH <inventory> { productId inv:productDescription description . }
    }
  }

  la-if (categoryId !== null && categoryId !== "") {
    DELETE FROM GRAPH <inventory> { productId inv:hasCategory ?v }
    WHERE { GRAPH <inventory> { productId inv:hasCategory ?v } }
    INSERT INTO GRAPH <inventory> { productId inv:hasCategory categoryId . }
  }

  la-if (supplierId !== null) {
    DELETE FROM GRAPH <inventory> {
      productId inv:hasPrimarySupplier ?v .
      productId inv:hasSupplier        ?v .
    }
    WHERE { GRAPH <inventory> {
      OPTIONAL { productId inv:hasPrimarySupplier ?v }
    } }
    la-if (supplierId !== "") {
      INSERT INTO GRAPH <inventory> {
        productId inv:hasPrimarySupplier supplierId .
        productId inv:hasSupplier        supplierId .
      }
    }
  }

  la-if (unitPrice !== null && unitPrice >= 0) {
    DELETE FROM GRAPH <inventory> { productId inv:unitPrice ?v }
    WHERE { GRAPH <inventory> { productId inv:unitPrice ?v } }
    INSERT INTO GRAPH <inventory> { productId inv:unitPrice unitPrice . }
  }

  la-if (reorderThreshold !== null) {
    DELETE FROM GRAPH <inventory> { productId inv:reorderThreshold ?v }
    WHERE { GRAPH <inventory> { OPTIONAL { productId inv:reorderThreshold ?v } } }
    la-if (reorderThreshold > 0) {
      INSERT INTO GRAPH <inventory> { productId inv:reorderThreshold reorderThreshold . }
    }
  }

  return productId
}

// ============================================================================
// FUNCTION getStockValue
//
// Computes the total monetary value of all stock across all locations:
//   SUM(unitPrice * quantity) per product, then grand total.
// Returns a result set with per-product breakdown and a summary row.
// ============================================================================
FUNCTION getStockValue() {
  SELECT ?product ?productName ?unitPrice ?totalQty
         (?unitPrice * ?totalQty AS ?lineValue)
         ?categoryName WHERE {
    {
      SELECT ?product (SUM(?qty) AS ?totalQty) WHERE {
        GRAPH <inventory> {
          ?entry inv:stockEntryFor ?product .
          ?entry inv:quantity      ?qty .
        }
      }
      GROUP BY ?product
    }

    GRAPH <inventory> {
      ?product inv:productName ?productName .
      ?product inv:unitPrice   ?unitPrice .
      ?product inv:hasCategory ?category .
      ?category inv:categoryName ?categoryName .
    }
  }
  ORDER BY DESC(?lineValue) ASC(?productName)
}

// ============================================================================
// FUNCTION getTotalStockValue
//
// Returns a single decimal representing the grand total inventory value.
// Useful for the summary label in the main window header.
// ============================================================================
FUNCTION getTotalStockValue() {
  SELECT (SUM(?unitPrice * ?totalQty) AS ?grandTotal) WHERE {
    {
      SELECT ?product (SUM(?qty) AS ?totalQty) WHERE {
        GRAPH <inventory> {
          ?entry inv:stockEntryFor ?product .
          ?entry inv:quantity      ?qty .
        }
      }
      GROUP BY ?product
    }

    GRAPH <inventory> {
      ?product inv:unitPrice ?unitPrice .
    }
  }
}

// ============================================================================
// FUNCTION getMovements
//
// Returns the most recent StockMovement records for audit display.
// Optionally filtered by productId.
// ============================================================================
FUNCTION getMovements(productId, limitCount) {
  let limit = limitCount === null ? 50 : limitCount

  SELECT ?movement ?productName ?locationName
         ?delta ?timestamp ?note WHERE {
    GRAPH <inventory> {
      ?movement a inv:StockMovement .
      ?movement inv:movementFor       ?entry .
      ?movement inv:movementDelta     ?delta .
      ?movement inv:movementTimestamp ?timestamp .

      ?entry inv:stockEntryFor ?product .
      ?entry inv:storedAt      ?location .

      ?product  inv:productName  ?productName .
      ?location inv:locationName ?locationName .

      OPTIONAL { ?movement inv:movementNote ?note }

      FILTER (productId === null || productId === "" ||
              ?product = productId)
    }
  }
  ORDER BY DESC(?timestamp)
  LIMIT limit
}
