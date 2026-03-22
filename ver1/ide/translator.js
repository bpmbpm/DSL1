/**
 * DSL1 Translator
 * Converts PL/SPARQL DSL + UI DSL + Turtle ontology into a standalone browser HTML/JS application.
 *
 * Dual-use module:
 *   Browser:  window.DSL1Translator is set automatically.
 *   Node.js:  const { translate } = require('./translator')
 *
 * Pipeline:
 *   lexDSL      -> token array
 *   parseDSL    -> AST
 *   parseUIDSL  -> AST
 *   generateJS  -> JS string (dsl logic + ui logic combined)
 *   generateHTML-> full standalone HTML document
 *   translate   -> { html, errors }
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.DSL1Translator = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ============================================================
  // LEXER  (PL/SPARQL)
  // ============================================================

  const DSL_KEYWORDS = new Set([
    'PREFIX','USE','GRAPH','FUNCTION','SELECT','WHERE','INSERT','DELETE',
    'FROM','INTO','OPTIONAL','FILTER','ORDER','BY','ASC','DESC','LIMIT',
    'OFFSET','GROUP','HAVING','COUNT','SUM','AVG','MIN','MAX','DISTINCT',
    'AS','UNION','BIND','VALUES','CONSTRUCT','ASK','DESCRIBE','CLEAR',
    'DATA','GRAPH','NOW','ROUND','STRING','NUMBER','GENERATE_IRI',
    'la-if','la-else','la-forEach','la-switch','la-try','la-throw',
    'let','const','return','map','filter','reduce','typeof','true','false','null',
  ]);

  function lexDSL(code) {
    const tokens = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
      // Skip whitespace
      if (/\s/.test(code[i])) { i++; continue; }

      // Line comments  // ...  or  # ...
      if (code[i] === '/' && code[i+1] === '/') {
        while (i < len && code[i] !== '\n') i++;
        continue;
      }
      if (code[i] === '#') {
        while (i < len && code[i] !== '\n') i++;
        continue;
      }

      // IRI  <...>
      if (code[i] === '<') {
        let j = i + 1;
        while (j < len && code[j] !== '>') j++;
        tokens.push({ type: 'IRIREF', value: code.slice(i, j + 1) });
        i = j + 1;
        continue;
      }

      // String literal  "..."
      if (code[i] === '"') {
        let j = i + 1;
        while (j < len && !(code[j] === '"' && code[j-1] !== '\\')) j++;
        tokens.push({ type: 'STRING', value: code.slice(i, j + 1) });
        i = j + 1;
        continue;
      }

      // Numbers
      if (/[0-9]/.test(code[i]) || (code[i] === '-' && /[0-9]/.test(code[i+1]))) {
        let j = i;
        if (code[j] === '-') j++;
        while (j < len && /[0-9]/.test(code[j])) j++;
        let type = 'INTEGER';
        if (j < len && code[j] === '.') { j++; while (j < len && /[0-9]/.test(code[j])) j++; type = 'DECIMAL'; }
        tokens.push({ type, value: code.slice(i, j) });
        i = j;
        continue;
      }

      // SPARQL variable  ?x  $x
      if (code[i] === '?' || code[i] === '$') {
        let j = i + 1;
        while (j < len && /[\w]/.test(code[j])) j++;
        tokens.push({ type: 'VAR', value: code.slice(i, j) });
        i = j;
        continue;
      }

      // Two-char operators
      const two = code.slice(i, i + 2);
      if (['!=', '<=', '>=', '&&', '||', '^^'].includes(two)) {
        tokens.push({ type: 'OP', value: two });
        i += 2;
        continue;
      }

      // Single-char operators / punctuation
      if ('+-*/%=<>!'.includes(code[i])) {
        tokens.push({ type: 'OP', value: code[i] });
        i++;
        continue;
      }
      if ('{}()[].;,|'.includes(code[i])) {
        tokens.push({ type: 'PUNCT', value: code[i] });
        i++;
        continue;
      }

      // Identifiers and keywords (including la-if etc.)
      if (/[a-zA-Z_]/.test(code[i])) {
        let j = i;
        while (j < len && /[\w\-]/.test(code[j])) {
          // stop hyphen-run if next char after hyphen is not alpha (e.g. subtraction)
          if (code[j] === '-' && (j + 1 >= len || !/[a-zA-Z]/.test(code[j+1]))) break;
          j++;
        }
        const word = code.slice(i, j);
        // Check for prefixed name:  ns:localName
        if (j < len && code[j] === ':' && j + 1 < len && /[\w<]/.test(code[j+1])) {
          // could be PREFIX declaration  PREFIX ns: <uri>  — let parser handle the colon
          tokens.push({ type: DSL_KEYWORDS.has(word) ? 'KEYWORD' : 'IDENTIFIER', value: word });
          i = j;
          continue;
        }
        if (code[j] === ':') {
          // prefixed name  ns:localName
          let k = j + 1;
          while (k < len && /[\w\-#/.]/.test(code[k])) k++;
          tokens.push({ type: 'PREFIXED', value: code.slice(i, k) });
          i = k;
          continue;
        }
        tokens.push({ type: DSL_KEYWORDS.has(word) ? 'KEYWORD' : 'IDENTIFIER', value: word });
        i = j;
        continue;
      }

      // Colon (standalone, e.g. in PREFIX decl)
      if (code[i] === ':') {
        tokens.push({ type: 'PUNCT', value: ':' });
        i++;
        continue;
      }

      // Unknown — skip with error token
      tokens.push({ type: 'ERROR', value: code[i] });
      i++;
    }

    return tokens;
  }

  // ============================================================
  // PARSER  (PL/SPARQL)
  // ============================================================

  function parseDSL(tokens) {
    let pos = 0;
    const errors = [];

    function peek(offset) { return tokens[pos + (offset || 0)]; }
    function consume() { return tokens[pos++]; }
    function expect(typeOrValue) {
      const t = tokens[pos];
      if (!t) { errors.push('Unexpected end of input, expected ' + typeOrValue); return null; }
      if (t.type === typeOrValue || t.value === typeOrValue) { return consume(); }
      errors.push(`Expected ${typeOrValue} but got ${t.value} (${t.type}) at token ${pos}`);
      return consume(); // recover
    }
    function at(value) { return tokens[pos] && tokens[pos].value === value; }
    function atType(type) { return tokens[pos] && tokens[pos].type === type; }

    const ast = { type: 'Program', prefixes: {}, functions: [], statements: [] };

    while (pos < tokens.length) {
      const t = peek();
      if (!t) break;

      if (t.type === 'KEYWORD' && t.value === 'PREFIX') {
        pos++;
        const ns = consume(); // e.g. "calc"
        if (at(':')) pos++; // consume colon
        const iri = consume(); // e.g. <...>
        ast.prefixes[ns.value] = iri.value.replace(/[<>]/g, '');
        continue;
      }

      if (t.type === 'KEYWORD' && t.value === 'USE') {
        // USE GRAPH <name> or USE DSL "file" or USE ONTOLOGY "..."
        pos++;
        while (pos < tokens.length && tokens[pos].value !== ';' && tokens[pos].type !== 'KEYWORD') pos++;
        continue;
      }

      if (t.type === 'KEYWORD' && t.value === 'FUNCTION') {
        ast.functions.push(parseFunctionDecl());
        continue;
      }

      // top-level let / const
      if ((t.type === 'KEYWORD' && (t.value === 'let' || t.value === 'const'))) {
        ast.statements.push(parseStatement());
        continue;
      }

      // Skip unknown tokens at top level
      pos++;
    }

    return { ast, errors };

    function parseFunctionDecl() {
      expect('FUNCTION');
      const name = consume().value;
      expect('(');
      const params = [];
      while (!at(')') && pos < tokens.length) {
        if (atType('IDENTIFIER')) params.push(consume().value);
        if (at(',')) pos++;
      }
      expect(')');
      const body = parseBlock();
      return { type: 'FunctionDecl', name, params, body };
    }

    function parseBlock() {
      expect('{');
      const stmts = [];
      while (!at('}') && pos < tokens.length) {
        stmts.push(parseStatement());
      }
      expect('}');
      return stmts;
    }

    function parseStatement() {
      const t = peek();
      if (!t) return { type: 'Empty' };

      if (t.type === 'KEYWORD' && t.value === 'let') return parseVarDecl('let');
      if (t.type === 'KEYWORD' && t.value === 'const') return parseVarDecl('const');
      if (t.type === 'KEYWORD' && t.value === 'return') return parseReturn();
      if (t.type === 'KEYWORD' && t.value === 'la-if') return parseLaIf();
      if (t.type === 'KEYWORD' && t.value === 'la-forEach') return parseLaForEach();
      if (t.type === 'KEYWORD' && t.value === 'INSERT') return parseInsert();
      if (t.type === 'KEYWORD' && t.value === 'DELETE') return parseDelete();
      if (t.type === 'KEYWORD' && t.value === 'SELECT') return { type: 'ExprStmt', expr: parseSelectQuery() };

      // Expression statement (assignment, function call, etc.)
      const expr = parseExpr();
      if (at(';')) pos++;
      return { type: 'ExprStmt', expr };
    }

    function parseVarDecl(kind) {
      pos++; // consume let/const
      const name = consume().value;
      expect('=');
      const init = parseExpr();
      if (at(';')) pos++;
      return { type: 'VarDecl', kind, name, init };
    }

    function parseReturn() {
      pos++; // consume 'return'
      if (at(';') || at('}')) { if (at(';')) pos++; return { type: 'Return', value: null }; }
      const val = parseExpr();
      if (at(';')) pos++;
      return { type: 'Return', value: val };
    }

    function parseLaIf() {
      pos++; // consume la-if
      expect('(');
      const cond = parseExprUntilClose();
      expect(')');
      const then = parseBlock();
      let elseClause = null;
      if (peek() && peek().value === 'la-else') {
        pos++;
        if (peek() && peek().value === 'la-if') {
          elseClause = [parseLaIf()];
        } else {
          elseClause = parseBlock();
        }
      }
      return { type: 'LaIf', cond, then, else: elseClause };
    }

    function parseLaForEach() {
      pos++; // consume la-forEach
      expect('(');
      // collect source expression (rows variable or inline SELECT)
      const src = parseExprUntilClose();
      expect(')');
      // Optional pipe-delimited row var  |row|  or  AS ?row
      let rowVar = 'row';
      if (at('|')) { pos++; rowVar = consume().value; expect('|'); }
      if (peek() && peek().value === 'AS') { pos++; rowVar = consume().value.replace('?',''); }
      const body = parseBlock();
      return { type: 'LaForEach', src, rowVar, body };
    }

    function parseInsert() {
      pos++; // INSERT
      const intoKw = peek();
      if (intoKw && intoKw.value === 'INTO') pos++;
      if (peek() && peek().value === 'DATA') pos++;
      // GRAPH <name> { triples }
      let graph = null;
      if (peek() && peek().value === 'GRAPH') { pos++; graph = consume().value; }
      const raw = collectBraceContent();
      return { type: 'Insert', graph, raw };
    }

    function parseDelete() {
      pos++; // DELETE
      if (peek() && peek().value === 'FROM') pos++;
      if (peek() && peek().value === 'DATA') pos++;
      let graph = null;
      if (peek() && peek().value === 'GRAPH') { pos++; graph = consume().value; }
      const raw = collectBraceContent();
      // WHERE clause
      let where = null;
      if (peek() && peek().value === 'WHERE') {
        pos++;
        if (peek() && peek().value === 'GRAPH') { pos++; pos++; } // skip GRAPH <g>
        where = collectBraceContent();
      }
      if (at(';')) pos++;
      return { type: 'Delete', graph, raw, where };
    }

    function parseSelectQuery() {
      pos++; // SELECT
      const vars = [];
      let aggregate = null;
      // Handle (COUNT(?x) AS ?total)
      if (at('(')) {
        pos++;
        const fn = consume().value;
        expect('(');
        const v = consume().value;
        expect(')');
        expect('AS');
        const alias = consume().value;
        expect(')');
        aggregate = { fn, var: v, alias };
      } else {
        while (pos < tokens.length && tokens[pos].type === 'VAR') {
          vars.push(consume().value);
        }
      }
      if (peek() && peek().value === 'WHERE') pos++;
      // Collect WHERE block raw text
      const raw = collectBraceContent();
      // Modifiers
      let orderBy = null, limit = null, groupBy = null;
      while (pos < tokens.length) {
        const tk = peek();
        if (!tk) break;
        if (tk.value === 'ORDER') {
          pos++; expect('BY');
          const dir = (peek() && (peek().value==='ASC'||peek().value==='DESC')) ? consume().value : 'ASC';
          if (at('(')) { pos++; orderBy = { dir, expr: consume().value }; expect(')'); }
          else { orderBy = { dir, expr: consume().value }; }
        } else if (tk.value === 'LIMIT') {
          pos++; limit = parseInt(consume().value, 10);
        } else if (tk.value === 'GROUP') {
          pos++; expect('BY');
          groupBy = [];
          while (tokens[pos] && tokens[pos].type === 'VAR') groupBy.push(consume().value);
        } else break;
      }
      return { type: 'SelectQuery', vars, aggregate, raw, orderBy, limit, groupBy };
    }

    function parseExpr() {
      // Check for SELECT inline
      if (peek() && peek().value === 'SELECT') return parseSelectQuery();
      return parseExprUntilStop();
    }

    function parseExprUntilStop() {
      // Collect tokens into a raw expression string until ; or } or )
      const parts = [];
      let depth = 0;
      while (pos < tokens.length) {
        const t = tokens[pos];
        if (t.value === '{' || t.value === '(' || t.value === '[') depth++;
        if (t.value === '}' || t.value === ')' || t.value === ']') {
          if (depth === 0) break;
          depth--;
        }
        if (t.value === ';' && depth === 0) break;
        parts.push(t.value);
        pos++;
      }
      return { type: 'RawExpr', raw: parts.join(' ') };
    }

    function parseExprUntilClose() {
      const parts = [];
      let depth = 0;
      while (pos < tokens.length) {
        const t = tokens[pos];
        if (t.value === '(') depth++;
        if (t.value === ')') { if (depth === 0) break; depth--; }
        parts.push(t.value);
        pos++;
      }
      return { type: 'RawExpr', raw: parts.join(' ') };
    }

    function collectBraceContent() {
      expect('{');
      const parts = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const t = tokens[pos];
        if (t.value === '{') depth++;
        if (t.value === '}') { depth--; if (depth === 0) { pos++; break; } }
        parts.push(t.value);
        pos++;
      }
      return parts.join(' ');
    }
  }

  // ============================================================
  // UI DSL PARSER
  // ============================================================

  function parseUIDSL(code) {
    // Tokenise UI DSL  (simpler than PL/SPARQL)
    const UI_KEYWORDS = new Set([
      'WINDOW','FIELD','BUTTON','DROPDOWN','MULTISELECT','LISTVIEW','LABEL',
      'CANVAS','TITLE','WIDTH','HEIGHT','RESIZABLE','STYLE','PLACEHOLDER',
      'TYPE','READONLY','REQUIRED','BIND','TO','DISPLAY','VALUE','SELECTION',
      'ON','CLICK','CHANGE','LOAD','YES','NO','NAVIGATE','ENABLED','WHEN',
      'LABEL','HEADER','COLUMNS','EMPTY_MESSAGE','AUTO_REFRESH','ORDER',
      'SHOW','ALERT','CONFIRM','REFRESH','FORMAT','ALIGN','USE','DSL',
      'ONTOLOGY','INITIAL',
    ]);

    const tokens = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
      if (/\s/.test(code[i])) { i++; continue; }
      if (code[i] === '/' && code[i+1] === '/') { while(i<len && code[i]!=='\n') i++; continue; }
      if (code[i] === '#') { while(i<len && code[i]!=='\n') i++; continue; }
      if (code[i] === '"') {
        let j = i+1; while(j<len && !(code[j]==='"' && code[j-1]!=='\\')) j++;
        tokens.push({ type:'STRING', value: code.slice(i+1,j) }); i=j+1; continue;
      }
      if (code[i] === '<') {
        let j=i+1; while(j<len && code[j]!=='>') j++;
        tokens.push({ type:'IRIREF', value: code.slice(i+1,j) }); i=j+1; continue;
      }
      if (/[0-9]/.test(code[i])) {
        let j=i; while(j<len && /[0-9]/.test(code[j])) j++;
        tokens.push({ type:'NUMBER', value: parseInt(code.slice(i,j),10) }); i=j; continue;
      }
      if ('{}()[],;'.includes(code[i])) {
        tokens.push({ type:'PUNCT', value:code[i] }); i++; continue;
      }
      if (code[i] === '?') {
        let j=i+1; while(j<len && /\w/.test(code[j])) j++;
        tokens.push({ type:'VAR', value: code.slice(i+1,j) }); i=j; continue;
      }
      if (/[a-zA-Z_\-]/.test(code[i])) {
        let j=i;
        while(j<len && /[\w\-]/.test(code[j])) {
          if(code[j]==='-' && (j+1>=len || !/[a-zA-Z]/.test(code[j+1]))) break;
          j++;
        }
        const word = code.slice(i,j);
        tokens.push({ type: UI_KEYWORDS.has(word)?'KEYWORD':'IDENT', value: word });
        i=j; continue;
      }
      if (code[i] === '+') { tokens.push({type:'OP',value:'+'}); i++; continue; }
      i++;
    }

    // Parse
    let pos = 0;
    function peek(o) { return tokens[pos+(o||0)]; }
    function consume() { return tokens[pos++]; }
    function at(v) { return tokens[pos] && tokens[pos].value === v; }
    function atType(t) { return tokens[pos] && tokens[pos].type === t; }
    function skip(v) { if(at(v)) pos++; }

    const ui = { windows: [], prefixes: {} };

    while (pos < tokens.length) {
      const t = peek();
      if (!t) break;
      if (t.value === 'PREFIX') { pos++; const ns=consume(); skip(':'); const iri=consume(); ui.prefixes[ns.value]=iri.value; continue; }
      if (t.value === 'USE') { pos++; while(pos<tokens.length && tokens[pos].type!=='KEYWORD') pos++; continue; }
      if (t.value === 'WINDOW') { ui.windows.push(parseWindow()); continue; }
      pos++;
    }

    return ui;

    function parseWindow() {
      pos++; // WINDOW
      const name = consume().value;
      const win = { name, title: name, widgets: [] };
      // Optional inline attrs before {
      while (!at('{') && pos < tokens.length) {
        const t = peek();
        if (t.value === 'TITLE') { pos++; win.title = consume().value; }
        else if (t.value === 'WIDTH') { pos++; win.width = consume().value; }
        else if (t.value === 'HEIGHT') { pos++; win.height = consume().value; }
        else if (t.value === 'STYLE') { pos++; win.style = consume().value; }
        else if (t.value === 'RESIZABLE') { pos++; consume(); }
        else pos++;
      }
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value === 'FIELD') { win.widgets.push(parseField()); continue; }
        if (t.value === 'BUTTON') { win.widgets.push(parseButton()); continue; }
        if (t.value === 'DROPDOWN') { win.widgets.push(parseDropdown()); continue; }
        if (t.value === 'MULTISELECT') { win.widgets.push(parseMultiselect()); continue; }
        if (t.value === 'LISTVIEW') { win.widgets.push(parseListview()); continue; }
        if (t.value === 'LABEL') { win.widgets.push(parseLabel()); continue; }
        if (t.value === 'CANVAS') { win.widgets.push(parseCanvas()); continue; }
        // inline window attributes
        if (t.value === 'TITLE') { pos++; win.title = consume().value; continue; }
        if (t.value === 'STYLE' || t.value === 'WIDTH' || t.value === 'HEIGHT' || t.value === 'RESIZABLE') { pos++; consume(); continue; }
        pos++; // skip unknown
      }
      skip('}');
      return win;
    }

    function parseField() {
      pos++; // FIELD
      const name = consume().value;
      const w = { type:'FIELD', name, label: name, readonly: false, fieldType:'text', bind:null, display:null, placeholder:'' };
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value==='LABEL') { pos++; w.label=consume().value; }
        else if (t.value==='TYPE') { pos++; w.fieldType=consume().value.toLowerCase(); }
        else if (t.value==='READONLY') { pos++; consume(); w.readonly=true; }
        else if (t.value==='PLACEHOLDER') { pos++; w.placeholder=consume().value; }
        else if (t.value==='BIND') { pos++; skip('TO'); w.bind=consume().value; if(peek()&&peek().type==='PUNCT'&&peek().value==='('){pos++;let d=1;const p=[];while(pos<tokens.length&&d>0){const x=tokens[pos];if(x.value==='(')d++;if(x.value===')'){d--;if(d===0){pos++;break;}}p.push(x.value);pos++;}w.bind=p.join(' ');}}
        else if (t.value==='DISPLAY') { pos++; w.display=consume().value; }
        else if (t.value==='STYLE') { pos++; consume(); }
        else if (t.value==='REQUIRED') { pos++; consume(); }
        else pos++;
      }
      skip('}');
      return w;
    }

    function parseButton() {
      pos++; // BUTTON
      const name = consume().value;
      const w = { type:'BUTTON', name, label: name, onClick: null, style: '' };
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value==='LABEL') { pos++; w.label=consume().value; }
        else if (t.value==='STYLE') { pos++; w.style=consume().value; }
        else if (t.value==='ORDER') { pos++; consume(); }
        else if (t.value==='ON') {
          pos++;
          const evt = consume().value; // CLICK
          if (evt === 'CLICK') { w.onClick = collectOnClickBlock(); }
          else pos++;
        }
        else pos++;
      }
      skip('}');
      return w;
    }

    function collectOnClickBlock() {
      skip('{');
      const parts = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const t = tokens[pos];
        if (t.value === '{') depth++;
        if (t.value === '}') { depth--; if (depth===0){pos++;break;} }
        parts.push(t.value);
        pos++;
      }
      return parts.join(' ');
    }

    function parseDropdown() {
      pos++; // DROPDOWN
      const name = consume().value;
      const w = { type:'DROPDOWN', name, label:name, bind:null, display:null, value:null, selection:'single' };
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value==='LABEL') { pos++; w.label=consume().value; }
        else if (t.value==='BIND') { pos++; skip('TO'); w.bind=consume().value; }
        else if (t.value==='DISPLAY') { pos++; w.display=consume().value; }
        else if (t.value==='VALUE') { pos++; w.value=consume().value; }
        else if (t.value==='SELECTION') { pos++; w.selection=consume().value.toLowerCase(); }
        else if (t.value==='STYLE'||t.value==='REQUIRED'||t.value==='ORDER') { pos++; consume(); }
        else pos++;
      }
      skip('}');
      return w;
    }

    function parseMultiselect() {
      pos++;
      const name = consume().value;
      const w = { type:'MULTISELECT', name, label:name, bind:null, display:null, value:null };
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value==='LABEL') { pos++; w.label=consume().value; }
        else if (t.value==='BIND') { pos++; skip('TO'); w.bind=consume().value; }
        else if (t.value==='DISPLAY') { pos++; w.display=consume().value; }
        else if (t.value==='VALUE') { pos++; w.value=consume().value; }
        else pos++;
      }
      skip('}');
      return w;
    }

    function parseListview() {
      pos++; // LISTVIEW
      const name = consume().value;
      const w = { type:'LISTVIEW', name, label:'', bind:null, columns:[], emptyMessage:'No items.' };
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value==='LABEL') { pos++; w.label=consume().value; }
        else if (t.value==='BIND') { pos++; skip('TO'); w.bind=consume().value; }
        else if (t.value==='EMPTY_MESSAGE') { pos++; w.emptyMessage=consume().value; }
        else if (t.value==='COLUMNS') {
          pos++; skip('[');
          while (!at(']') && pos < tokens.length) {
            if (at('{')) {
              pos++;
              const col = { header:'', value:'', width:null, align:'left', format:null };
              while (!at('}') && pos < tokens.length) {
                const ct = peek();
                if (!ct) break;
                if (ct.value==='HEADER') { pos++; col.header=consume().value; }
                else if (ct.value==='VALUE') { pos++; col.value=consume().value; }
                else if (ct.value==='WIDTH') { pos++; col.width=consume().value; }
                else if (ct.value==='ALIGN') { pos++; col.align=consume().value.toLowerCase(); }
                else if (ct.value==='FORMAT') { pos++; col.format=consume().value; }
                else pos++;
              }
              skip('}');
              w.columns.push(col);
            }
            if (at(',')) pos++;
            else if (!at('{')) pos++;
          }
          skip(']');
        }
        else if (t.value==='SELECTION'||t.value==='STYLE') { pos++; consume(); }
        else pos++;
      }
      skip('}');
      return w;
    }

    function parseLabel() {
      pos++; // LABEL
      const name = consume().value;
      const w = { type:'LABEL', name, bind:null, display:null, style:'' };
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value==='BIND') { pos++; skip('TO'); w.bind=consume().value; }
        else if (t.value==='DISPLAY') {
          pos++;
          const parts=[];
          while(pos<tokens.length && tokens[pos].value!=='STYLE' && tokens[pos].value!=='AUTO_REFRESH' && tokens[pos].value!=='}') {
            parts.push(tokens[pos].value); pos++;
          }
          w.display=parts.join(' ');
        }
        else if (t.value==='STYLE') { pos++; w.style=consume().value; }
        else if (t.value==='AUTO_REFRESH') { pos++; consume(); }
        else pos++;
      }
      skip('}');
      return w;
    }

    function parseCanvas() {
      pos++;
      const name = consume().value;
      const w = { type:'CANVAS', name, renderFn: null };
      skip('{');
      while (!at('}') && pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.value==='RENDER') { pos++; consume(); w.renderFn=consume().value; }
        else pos++;
      }
      skip('}');
      return w;
    }
  }

  // ============================================================
  // CODE GENERATOR
  // ============================================================

  function generateJS(dslAST, uiAST, ontologyTurtle) {
    const lines = [];
    const prefixes = Object.assign({}, dslAST.prefixes, uiAST ? uiAST.prefixes : {});

    // Helper: resolve prefixed name to full IRI string
    function resolveIRI(term) {
      if (!term) return 'null';
      term = String(term).trim();
      if (term.startsWith('<') && term.endsWith('>')) return term.slice(1,-1);
      if (term.startsWith('"')) return term;
      const colon = term.indexOf(':');
      if (colon > 0) {
        const ns = term.slice(0, colon);
        const local = term.slice(colon+1);
        if (prefixes[ns]) return prefixes[ns] + local;
      }
      return term;
    }

    // Helper: convert a raw WHERE block string to JS N3 store queries
    function whereToJS(raw, graphIRI) {
      // Very simplified: we emit __sparqlSelect with the raw SPARQL
      return raw; // passed verbatim into template string
    }

    // Helper: translate DSL expression raw text to JS
    function exprToJS(raw) {
      if (!raw) return 'undefined';
      raw = raw.replace(/\bNOW\s*\(\s*\)/g, 'new Date().toISOString()');
      raw = raw.replace(/\bROUND\s*\(([^,)]+),\s*([^)]+)\)/g, (_, v, p) => `parseFloat(Number(${v}).toFixed(${p}))`);
      raw = raw.replace(/\bSTRING\s*\(([^)]+)\)/g, (_, v) => `String(${v})`);
      raw = raw.replace(/\bNUMBER\s*\(([^)]+)\)/g, (_, v) => `Number(${v})`);
      raw = raw.replace(/\bGENERATE_IRI\s*\(([^)]+)\)/g, (_, ns) => {
        const base = resolveIRI(ns.trim());
        return `(${JSON.stringify(base)} + '_' + Math.random().toString(36).slice(2))`;
      });
      raw = raw.replace(/\btypeof\s+/g, 'typeof ');
      return raw;
    }

    // Translate a single DSL statement node to JS lines
    function stmtToJS(node, indent) {
      if (!node) return '';
      const pad = '  '.repeat(indent);
      switch (node.type) {
        case 'VarDecl': {
          const val = node.init && node.init.type === 'SelectQuery'
            ? selectToJS(node.init)
            : exprToJS(node.init ? node.init.raw : 'undefined');
          return `${pad}${node.kind} ${node.name} = ${val};`;
        }
        case 'Return': {
          if (!node.value) return `${pad}return;`;
          const v = node.value.type === 'SelectQuery'
            ? selectToJS(node.value)
            : exprToJS(node.value.raw);
          return `${pad}return ${v};`;
        }
        case 'LaIf': {
          const cond = exprToJS(node.cond.raw);
          const thenStmts = node.then.map(s => stmtToJS(s, indent+1)).join('\n');
          let s = `${pad}if (${cond}) {\n${thenStmts}\n${pad}}`;
          if (node.else) {
            const elsePart = Array.isArray(node.else)
              ? node.else.map(s => stmtToJS(s, indent+1)).join('\n')
              : node.else.map(s => stmtToJS(s, indent+1)).join('\n');
            // check if else is a single LaIf (else-if chain)
            if (Array.isArray(node.else) && node.else.length === 1 && node.else[0].type === 'LaIf') {
              s += ` else ` + stmtToJS(node.else[0], indent).trimStart();
            } else {
              s += ` else {\n${elsePart}\n${pad}}`;
            }
          }
          return s;
        }
        case 'LaForEach': {
          const src = node.src.type === 'SelectQuery'
            ? selectToJS(node.src)
            : exprToJS(node.src.raw);
          const bodyStmts = node.body.map(s => stmtToJS(s, indent+1)).join('\n');
          return `${pad}(${src} || []).forEach(function(${node.rowVar}) {\n${bodyStmts}\n${pad}});`;
        }
        case 'Insert': {
          const graph = node.graph ? resolveIRI(node.graph) : 'urn:default';
          // translate triples raw to addQuad calls
          const triplesCalls = rawTriplesToAddQuad(node.raw, graph);
          return triplesCalls.map(l => pad + l).join('\n');
        }
        case 'Delete': {
          const graph = node.graph ? resolveIRI(node.graph) : 'urn:default';
          const whereBlock = node.where || node.raw;
          return `${pad}__deleteWhere(${JSON.stringify(graph)}, ${JSON.stringify(whereBlock)});`;
        }
        case 'ExprStmt': {
          if (node.expr && node.expr.type === 'SelectQuery') {
            return `${pad}${selectToJS(node.expr)};`;
          }
          let raw = node.expr ? (node.expr.raw || '') : '';
          // REFRESH calls
          raw = raw.replace(/(\w+)\s*\.\s*REFRESH\s*\(\s*\)/g, '__refreshWidget("$1")');
          // SHOW ALERT
          raw = raw.replace(/SHOW\s+ALERT\s+/g, 'alert('); if (raw.includes('alert(')) raw += ')';
          // SHOW CONFIRM
          raw = raw.replace(/SHOW\s+CONFIRM\s+"([^"]+)"\s*\{[\s\S]*?ON\s+YES\s*\{([\s\S]*?)\}[\s\S]*?ON\s+NO[\s\S]*?\}/, (_, msg, yes) => {
            return `if(confirm(${JSON.stringify(_)})){${yes}}`;
          });
          return `${pad}${exprToJS(raw)};`;
        }
        default:
          return `${pad}/* unknown node ${node.type} */`;
      }
    }

    function selectToJS(node) {
      // Build a __sparqlSelect call that returns array of binding objects
      const graphHint = node.raw.includes('GRAPH') ? '' : '';
      const sparql = buildSPARQLString(node);
      return `__sparqlSelect(${JSON.stringify(sparql)})`;
    }

    function buildSPARQLString(node) {
      let s = 'SELECT ';
      if (node.aggregate) {
        s += `(${node.aggregate.fn}(${node.aggregate.var}) AS ${node.aggregate.alias})`;
      } else {
        s += node.vars.join(' ') || '*';
      }
      s += ` WHERE { ${node.raw} }`;
      if (node.groupBy) s += ` GROUP BY ${node.groupBy.join(' ')}`;
      if (node.orderBy) s += ` ORDER BY ${node.orderBy.dir}(${node.orderBy.expr})`;
      if (node.limit) s += ` LIMIT ${node.limit}`;
      return s;
    }

    function rawTriplesToAddQuad(raw, graph) {
      // Very simplified triple parser: split on ' . ' and generate addQuad
      const calls = [];
      const triples = raw.split(/\s+\.\s+/).filter(t => t.trim());
      for (const triple of triples) {
        const parts = triple.trim().split(/\s+/);
        if (parts.length >= 3) {
          const s = termToJS(parts[0]);
          const p = termToJS(parts[1]);
          const o = termToJS(parts.slice(2).join(' '));
          calls.push(`__store.addQuad(__N3.DataFactory.quad(${s}, ${p}, ${o}, __N3.DataFactory.namedNode(${JSON.stringify(graph)})));`);
          calls.push(`__notifyListeners();`);
        }
      }
      return calls;
    }

    function termToJS(term) {
      term = term.trim();
      if (!term) return 'undefined';
      if (term.startsWith('"')) {
        // typed literal?
        if (term.includes('^^')) {
          const [val, dtype] = term.split('^^');
          return `__N3.DataFactory.literal(${val}, __N3.DataFactory.namedNode(${JSON.stringify(resolveIRI(dtype))}))`;
        }
        return `__N3.DataFactory.literal(${term})`;
      }
      if (term.startsWith('<') || term.startsWith('http')) {
        return `__N3.DataFactory.namedNode(${JSON.stringify(resolveIRI(term))})`;
      }
      if (/^\d/.test(term) || /^-\d/.test(term)) {
        return `__N3.DataFactory.literal(${JSON.stringify(term)}, __N3.DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#decimal'))`;
      }
      if (term === 'a') {
        return `__N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')`;
      }
      if (term.indexOf(':') > 0) {
        return `__N3.DataFactory.namedNode(${JSON.stringify(resolveIRI(term))})`;
      }
      // variable or JS expression
      return `(typeof ${term} === 'string' ? __N3.DataFactory.namedNode(${term}) : __N3.DataFactory.literal(String(${term})))`;
    }

    // Emit preamble
    lines.push('// Generated by DSL1 Translator');
    lines.push('// Do not edit manually');
    lines.push('');
    lines.push('const __storeListeners = [];');
    lines.push('function __notifyListeners() { __storeListeners.forEach(fn => { try { fn(); } catch(e){} }); }');
    lines.push('function __refreshWidget(name) { __notifyListeners(); }');
    lines.push('');

    // SPARQL evaluator over N3.js
    lines.push(`
// ── Minimal SPARQL evaluator ──────────────────────────────────────────────
function __sparqlSelect(sparql) {
  try {
    // Parse query fragments manually for the patterns we generate
    const results = __evalSPARQL(sparql);
    return results;
  } catch(e) {
    console.warn('__sparqlSelect error:', e, sparql);
    return [];
  }
}

function __evalSPARQL(sparql) {
  // Lightweight pattern evaluator for the subset of SPARQL we generate.
  sparql = sparql.trim();

  // Extract SELECT clause vars
  const selectMatch = sparql.match(/^SELECT\\s+(.*?)\\s+WHERE/is);
  if (!selectMatch) return [];
  const selectClause = selectMatch[1].trim();

  // Extract WHERE body
  const whereMatch = sparql.match(/WHERE\\s*\\{([\\s\\S]*)\\}/i);
  if (!whereMatch) return [];
  let body = whereMatch[1].trim();

  // Extract modifiers
  const orderMatch = sparql.match(/ORDER\\s+BY\\s+(ASC|DESC)\\s*\\(([^)]+)\\)/i);
  const limitMatch = sparql.match(/LIMIT\\s+(\\d+)/i);
  const groupMatch = sparql.match(/GROUP\\s+BY\\s+([\\?\\w\\s]+?)(?:\\s+ORDER|\\s+LIMIT|$)/i);

  // Remove modifiers from body
  body = body.replace(/ORDER\\s+BY.*/is,'').replace(/LIMIT.*/i,'').replace(/GROUP\\s+BY.*/is,'').trim();

  // Evaluate the WHERE body to get solution rows
  let rows = __evalWhereBody(body);

  // Handle aggregate (COUNT, SUM, AVG)
  const aggMatch = selectClause.match(/\\(\\s*(COUNT|SUM|AVG|MIN|MAX)\\s*\\(([^)]+)\\)\\s+AS\\s+(\\?\\w+)\\s*\\)/i);
  if (aggMatch) {
    const fn = aggMatch[1].toUpperCase();
    const v = aggMatch[2].replace('?','');
    const alias = aggMatch[3].replace('?','');
    if (groupMatch) {
      const groupVars = groupMatch[1].trim().split(/\\s+/).map(x=>x.replace('?',''));
      const groups = {};
      rows.forEach(row => {
        const key = groupVars.map(g => row[g] ? (row[g].value||row[g]) : '').join('|');
        if (!groups[key]) groups[key] = { _rows: [], _key: key, _groupVars: {} };
        groupVars.forEach(g => { groups[key]._groupVars[g] = row[g]; });
        groups[key]._rows.push(row);
      });
      return Object.values(groups).map(g => {
        const r = Object.assign({}, g._groupVars);
        const vals = g._rows.map(row => parseFloat(row[v] ? (row[v].value||row[v]) : 0)).filter(x=>!isNaN(x));
        if (fn==='COUNT') r[alias] = { value: String(g._rows.length), termType:'Literal' };
        else if (fn==='SUM') r[alias] = { value: String(vals.reduce((a,b)=>a+b,0)), termType:'Literal' };
        else if (fn==='AVG') r[alias] = { value: String(vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0), termType:'Literal' };
        return r;
      });
    }
    const vals = rows.map(row => parseFloat(row[v] ? (row[v].value||row[v]) : 0)).filter(x=>!isNaN(x));
    let agg;
    if (fn==='COUNT') agg = rows.length;
    else if (fn==='SUM') agg = vals.reduce((a,b)=>a+b,0);
    else if (fn==='AVG') agg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    else if (fn==='MIN') agg = Math.min(...vals);
    else if (fn==='MAX') agg = Math.max(...vals);
    return [{ [alias]: { value: String(agg), termType:'Literal' } }];
  }

  // Apply ORDER BY
  if (orderMatch) {
    const dir = orderMatch[1].toUpperCase();
    const v = orderMatch[2].replace('?','');
    rows.sort((a,b) => {
      const av = a[v] ? (a[v].value||a[v]) : '';
      const bv = b[v] ? (b[v].value||b[v]) : '';
      const an = parseFloat(av), bn = parseFloat(bv);
      const cmp = (!isNaN(an)&&!isNaN(bn)) ? (an-bn) : (av<bv?-1:av>bv?1:0);
      return dir==='DESC' ? -cmp : cmp;
    });
  }
  // Apply LIMIT
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1],10));

  // Project SELECT vars
  const projVars = selectClause.split(/\\s+/).map(v=>v.replace('?','')).filter(v=>v&&v!=='*');
  if (projVars.length === 0 || selectClause.trim() === '*') return rows;
  return rows.map(row => {
    const r = {};
    projVars.forEach(v => { if (row[v] !== undefined) r[v] = row[v]; });
    return r;
  });
}

function __evalWhereBody(body) {
  // Handle GRAPH <g> { ... }
  const graphMatch = body.match(/^GRAPH\\s+<([^>]+)>\\s*\\{([\\s\\S]*)\\}\\s*$/i);
  if (graphMatch) {
    return __evalPatterns(graphMatch[2].trim(), graphMatch[1]);
  }
  return __evalPatterns(body, null);
}

function __evalPatterns(body, graph) {
  let rows = [{}]; // start with one empty solution

  // Strip OPTIONAL and FILTER for line-splitting, handle them separately
  // Split into lines and process each triple pattern
  const lines = body.split(/(?<=\\.)\\s*(?=\\?|<|[a-zA-Z_])/)
    .map(l=>l.trim()).filter(l=>l && !l.startsWith('//'));

  const patterns = [];
  const optionals = [];
  const filters = [];

  let i = 0;
  const bodyLines = body.split('\\n');

  // Simple extraction: find OPTIONAL blocks and FILTER expressions
  const optRegex = /OPTIONAL\\s*\\{([^}]*)\\}/gi;
  const filterRegex = /FILTER\\s*\\(([^)]+)\\)/gi;

  let cleaned = body;
  let m;
  while ((m = optRegex.exec(body)) !== null) optionals.push(m[1].trim());
  while ((m = filterRegex.exec(body)) !== null) filters.push(m[1].trim());
  cleaned = cleaned.replace(optRegex,'').replace(filterRegex,'');

  // Extract triple patterns from cleaned body
  const tripleRegex = /([?<"\\w:\\-]+)\\s+([?<"\\w:\\-#/]+)\\s+([?<"\\w:\\-#/."^@]+)\\s*\\.?/g;
  const triples = [];
  while ((m = tripleRegex.exec(cleaned)) !== null) {
    triples.push({ s: m[1], p: m[2], o: m[3] });
  }

  // Evaluate each triple pattern against the store
  for (const tp of triples) {
    rows = __joinTriple(rows, tp, graph);
  }

  // Apply FILTER
  for (const f of filters) {
    rows = rows.filter(row => __evalFilter(f, row));
  }

  // Apply OPTIONAL
  for (const opt of optionals) {
    const optTripleRegex = /([?<"\\w:\\-]+)\\s+([?<"\\w:\\-#/]+)\\s+([?<"\\w:\\-#/."^@]+)\\s*\\.?/g;
    const optTriples = [];
    let om;
    while ((om = optTripleRegex.exec(opt)) !== null) optTriples.push({ s: om[1], p: om[2], o: om[3] });
    const extended = [];
    for (const row of rows) {
      let optRows = [row];
      for (const tp of optTriples) optRows = __joinTriple(optRows, tp, graph);
      if (optRows.length > 0) extended.push(...optRows);
      else extended.push(row);
    }
    rows = extended;
  }

  return rows;
}

function __resolvePrefix(term) {
  // Resolve prefixed names to full IRIs using __prefixes map
  if (!term) return term;
  term = String(term).trim();
  if (term.startsWith('<') && term.endsWith('>')) return term.slice(1,-1);
  if (term === 'a') return 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const ci = term.indexOf(':');
  if (ci > 0) {
    const ns = term.slice(0,ci);
    const local = term.slice(ci+1);
    if (__prefixes[ns]) return __prefixes[ns] + local;
  }
  return term;
}

function __joinTriple(rows, tp, graph) {
  const result = [];
  for (const row of rows) {
    const sVal = tp.s.startsWith('?') ? (row[tp.s.slice(1)] ? (row[tp.s.slice(1)].value || row[tp.s.slice(1)]) : null) : __resolvePrefix(tp.s);
    const pVal = tp.p.startsWith('?') ? (row[tp.p.slice(1)] ? (row[tp.p.slice(1)].value || row[tp.p.slice(1)]) : null) : __resolvePrefix(tp.p);
    const oVal = tp.o.startsWith('?') ? (row[tp.o.slice(1)] ? (row[tp.o.slice(1)].value || row[tp.o.slice(1)]) : null) : __resolvePrefix(tp.o);

    const sNode = sVal ? __N3.DataFactory.namedNode(sVal) : null;
    const pNode = pVal ? __N3.DataFactory.namedNode(pVal) : null;
    let oNode = null;
    if (oVal !== null) {
      const oStr = String(tp.o).trim();
      if (oStr.startsWith('"')) {
        const litVal = oStr.replace(/^"|".*$/g, s => s === '"' ? '' : '');
        oNode = __N3.DataFactory.literal(oVal);
      } else {
        oNode = __N3.DataFactory.namedNode(oVal);
      }
    }
    const graphNode = graph ? __N3.DataFactory.namedNode(graph) : null;

    const quads = __store.getQuads(sNode, pNode, oNode, graphNode);
    for (const quad of quads) {
      const newRow = Object.assign({}, row);
      if (tp.s.startsWith('?')) newRow[tp.s.slice(1)] = quad.subject;
      if (tp.p.startsWith('?')) newRow[tp.p.slice(1)] = quad.predicate;
      if (tp.o.startsWith('?')) newRow[tp.o.slice(1)] = quad.object;
      result.push(newRow);
    }
  }
  return result;
}

function __evalFilter(expr, row) {
  try {
    // Replace ?var with row values
    let js = expr.replace(/\\?(\\w+)/g, (_, v) => {
      const val = row[v];
      if (!val) return 'undefined';
      const strVal = val.value !== undefined ? val.value : val;
      const num = parseFloat(strVal);
      return isNaN(num) ? JSON.stringify(strVal) : String(num);
    });
    js = js.replace(/datatype\\s*\\(/g, '__datatype(');
    return !!eval(js);
  } catch(e) { return true; }
}
function __datatype(term) { return term && term.datatype ? term.datatype.value : ''; }

function __deleteWhere(graph, whereRaw) {
  const rows = __evalWhereBody(whereRaw.replace(/GRAPH\\s*<[^>]+>\\s*\\{/,'').replace(/\\}\\s*$/,'').trim());
  // Get all quads in graph and remove those matching
  const graphNode = __N3.DataFactory.namedNode(graph);
  const quads = __store.getQuads(null, null, null, graphNode);
  for (const q of quads) {
    __store.removeQuad(q);
  }
  __notifyListeners();
}
`);

    // Store initialisation (turtle loaded at runtime)
    lines.push(`
// ── Store Initialisation ─────────────────────────────────────────────────
const __store = new __N3.Store();
const __prefixes = {};
const __ontologyTurtle = ${JSON.stringify(ontologyTurtle || '')};

function __loadOntology() {
  return new Promise((resolve, reject) => {
    if (!__ontologyTurtle) { resolve(); return; }
    const parser = new __N3.Parser();
    parser.parse(__ontologyTurtle, (err, quad, pfx) => {
      if (err) { console.warn('Turtle parse error:', err); resolve(); return; }
      if (quad) { __store.addQuad(quad); }
      else {
        if (pfx) Object.assign(__prefixes, pfx);
        resolve();
      }
    });
  });
}
`);

    // Translate DSL functions
    lines.push('\n// ── Application Logic ────────────────────────────────────────────────────');
    for (const fn of dslAST.functions) {
      lines.push(`\nfunction ${fn.name}(${fn.params.join(', ')}) {`);
      for (const stmt of fn.body) {
        lines.push(stmtToJS(stmt, 1));
      }
      lines.push('}');
    }

    // Translate UI DSL
    if (uiAST && uiAST.windows.length > 0) {
      lines.push('\n// ── UI Rendering ─────────────────────────────────────────────────────────');

      for (const win of uiAST.windows) {
        lines.push(`\nfunction __renderWindow_${win.name}() {`);
        lines.push(`  const __win = document.createElement('div');`);
        lines.push(`  __win.id = 'window-${win.name}';`);
        lines.push(`  __win.className = 'dsl-window';`);
        lines.push(`  const __title = document.createElement('h2');`);
        lines.push(`  __title.textContent = ${JSON.stringify(win.title)};`);
        lines.push(`  __win.appendChild(__title);`);

        for (const widget of win.widgets) {
          lines.push(widgetToJS(widget, win.name));
        }

        lines.push(`  return __win;`);
        lines.push(`}`);
      }

      // Bootstrap
      lines.push('\n// ── Bootstrap ────────────────────────────────────────────────────────────');
      lines.push(`document.addEventListener('DOMContentLoaded', async function() {`);
      lines.push(`  await __loadOntology();`);
      const firstWin = uiAST.windows[0].name;
      lines.push(`  const __app = document.getElementById('dsl-app') || document.body;`);
      lines.push(`  __app.appendChild(__renderWindow_${firstWin}());`);
      lines.push(`  __notifyListeners();`);
      lines.push(`});`);
    }

    return lines.join('\n');

    // ── Widget code generation ──────────────────────────────────────────────
    function widgetToJS(widget, winName) {
      const out = [];
      const id = widget.name;
      switch (widget.type) {
        case 'FIELD': {
          out.push(`  {`);
          out.push(`    const __fg = document.createElement('div'); __fg.className='field-group';`);
          out.push(`    const __lbl = document.createElement('label'); __lbl.textContent=${JSON.stringify(widget.label)}; __fg.appendChild(__lbl);`);
          const inputType = widget.fieldType === 'number' ? 'number' : 'text';
          out.push(`    const ${id} = document.createElement('input'); ${id}.type=${JSON.stringify(inputType)}; ${id}.id=${JSON.stringify(id)};`);
          if (widget.placeholder) out.push(`    ${id}.placeholder=${JSON.stringify(widget.placeholder)};`);
          if (widget.readonly) out.push(`    ${id}.readOnly=true;`);
          out.push(`    __fg.appendChild(${id}); __win.appendChild(__fg);`);
          out.push(`  }`);
          break;
        }
        case 'BUTTON': {
          const btnClass = widget.style ? `btn ${widget.style}` : 'btn';
          out.push(`  {`);
          out.push(`    const ${id} = document.createElement('button');`);
          out.push(`    ${id}.id = ${JSON.stringify(id)};`);
          out.push(`    ${id}.className = ${JSON.stringify(btnClass)};`);
          out.push(`    ${id}.textContent = ${JSON.stringify(widget.label)};`);
          if (widget.onClick) {
            const handlerName = `__onClick_${winName}_${id}`;
            out.push(`    function ${handlerName}() {`);
            // Translate the raw onClick block
            const clickLines = translateClickBlock(widget.onClick, winName);
            clickLines.forEach(l => out.push(`      ${l}`));
            out.push(`    }`);
            out.push(`    ${id}.addEventListener('click', ${handlerName});`);
          }
          out.push(`    __win.appendChild(${id});`);
          out.push(`  }`);
          break;
        }
        case 'DROPDOWN': {
          out.push(`  {`);
          out.push(`    const __fg = document.createElement('div'); __fg.className='field-group';`);
          out.push(`    const __lbl = document.createElement('label'); __lbl.textContent=${JSON.stringify(widget.label)}; __fg.appendChild(__lbl);`);
          out.push(`    const ${id} = document.createElement('select'); ${id}.id=${JSON.stringify(id)};`);
          if (widget.bind) {
            const refreshFn = `__refresh_${id}`;
            out.push(`    function ${refreshFn}() {`);
            out.push(`      const __opts = ${widget.bind}();`);
            out.push(`      const __prev = ${id}.value;`);
            out.push(`      ${id}.innerHTML = '<option value="">-- select --</option>';`);
            out.push(`      (__opts||[]).forEach(function(row) {`);
            const dispVar = widget.display || 'label';
            const valVar = widget.value || 'value';
            out.push(`        const __opt = document.createElement('option');`);
            out.push(`        const __dispTerm = row[${JSON.stringify(dispVar)}];`);
            out.push(`        const __valTerm = row[${JSON.stringify(valVar)}];`);
            out.push(`        __opt.textContent = __dispTerm ? (__dispTerm.value||__dispTerm) : '';`);
            out.push(`        __opt.value = __valTerm ? (__valTerm.value||__valTerm) : '';`);
            out.push(`        ${id}.appendChild(__opt);`);
            out.push(`      });`);
            out.push(`      if(__prev) ${id}.value=__prev;`);
            out.push(`    }`);
            out.push(`    __storeListeners.push(${refreshFn});`);
          }
          out.push(`    __fg.appendChild(${id}); __win.appendChild(__fg);`);
          out.push(`  }`);
          break;
        }
        case 'LISTVIEW': {
          out.push(`  {`);
          out.push(`    const __section = document.createElement('div'); __section.className='listview-section';`);
          if (widget.label) {
            out.push(`    const __lh = document.createElement('h3'); __lh.textContent=${JSON.stringify(widget.label)}; __section.appendChild(__lh);`);
          }
          out.push(`    const __tbl = document.createElement('table'); __tbl.id=${JSON.stringify(id)}; __tbl.className='listview';`);
          out.push(`    const __thead = __tbl.createTHead(); const __hrow = __thead.insertRow();`);
          for (const col of widget.columns) {
            out.push(`    { const __th=document.createElement('th'); __th.textContent=${JSON.stringify(col.header)}; if(${JSON.stringify(col.align)}!=='left')__th.style.textAlign=${JSON.stringify(col.align)}; __hrow.appendChild(__th); }`);
          }
          out.push(`    const __tbody = __tbl.createTBody();`);
          if (widget.bind) {
            const refreshFn = `__refresh_${id}`;
            out.push(`    function ${refreshFn}() {`);
            out.push(`      __tbody.innerHTML = '';`);
            out.push(`      const __rows = ${widget.bind}();`);
            out.push(`      if(!__rows||__rows.length===0){`);
            out.push(`        const __etr=__tbody.insertRow(); const __etd=__etr.insertCell();`);
            out.push(`        __etd.colSpan=${widget.columns.length}; __etd.textContent=${JSON.stringify(widget.emptyMessage)}; __etd.className='empty-msg';`);
            out.push(`      } else {`);
            out.push(`        __rows.forEach(function(row) {`);
            out.push(`          const __tr = __tbody.insertRow();`);
            for (const col of widget.columns) {
              const v = col.value.replace('?','');
              if (v === '=') {
                out.push(`          { const __td=__tr.insertCell(); __td.textContent='='; __td.style.textAlign='center'; }`);
              } else if (col.format === 'datetime-local') {
                out.push(`          { const __td=__tr.insertCell(); const __rv=row[${JSON.stringify(v)}]; const __sv=__rv?(__rv.value||__rv):''; try{__td.textContent=__sv?new Date(__sv).toLocaleString():''}catch(e){__td.textContent=__sv}; if(${JSON.stringify(col.align)}!=='left')__td.style.textAlign=${JSON.stringify(col.align)}; }`);
              } else {
                out.push(`          { const __td=__tr.insertCell(); const __rv=row[${JSON.stringify(v)}]; __td.textContent=__rv?(__rv.value||__rv):''; if(${JSON.stringify(col.align)}!=='left')__td.style.textAlign=${JSON.stringify(col.align)}; }`);
              }
            }
            out.push(`        });`);
            out.push(`      }`);
            out.push(`    }`);
            out.push(`    __storeListeners.push(${refreshFn});`);
          }
          out.push(`    __section.appendChild(__tbl); __win.appendChild(__section);`);
          out.push(`  }`);
          break;
        }
        case 'LABEL': {
          out.push(`  {`);
          out.push(`    const ${id} = document.createElement('div'); ${id}.id=${JSON.stringify(id)}; ${id}.className='dsl-label';`);
          if (widget.bind) {
            const refreshFn = `__refresh_${id}`;
            out.push(`    function ${refreshFn}() {`);
            out.push(`      const __rows = ${widget.bind}();`);
            out.push(`      const row = (__rows && __rows[0]) || {};`);
            const disp = widget.display || '';
            // Build display string from template
            const dispJS = disp.replace(/\?(\w+)/g, (_, v) => `"+(row[${JSON.stringify(v)}]?(row[${JSON.stringify(v)}].value||row[${JSON.stringify(v)}]):'')+"`)
                               .replace(/^"/, '').replace(/"$/, '');
            out.push(`      ${id}.textContent = "${dispJS}";`);
            out.push(`    }`);
            out.push(`    __storeListeners.push(${refreshFn});`);
          }
          out.push(`    __win.appendChild(${id});`);
          out.push(`  }`);
          break;
        }
        case 'CANVAS': {
          out.push(`  {`);
          out.push(`    const ${id} = document.createElement('canvas'); ${id}.id=${JSON.stringify(id)};`);
          out.push(`    __win.appendChild(${id});`);
          if (widget.renderFn) {
            out.push(`    __storeListeners.push(function(){ ${widget.renderFn}(${id}); });`);
          }
          out.push(`  }`);
          break;
        }
      }
      return out.join('\n');
    }

    function translateClickBlock(raw, winName) {
      // Translate the raw token-joined click handler string to JS lines
      const lines = [];
      // la-if -> if
      let js = raw;
      js = js.replace(/\bla-if\b/g, 'if');
      // SHOW ALERT "..." -> alert("...")
      js = js.replace(/SHOW\s+ALERT\s+"([^"]+)"/g, 'alert("$1")');
      // SHOW CONFIRM "..." { ON YES { ... } ON NO { ... } }
      js = js.replace(/SHOW\s+CONFIRM\s+"([^"]+)"\s*\{([\s\S]*?)\}/g, (_, msg, body) => {
        const yesMatch = body.match(/ON\s+YES\s*\{([\s\S]*?)\}/);
        const yesCode = yesMatch ? yesMatch[1].trim() : '';
        return `if(confirm(${JSON.stringify(msg)})) { ${yesCode} }`;
      });
      // .REFRESH() -> __notifyListeners()
      js = js.replace(/\w+\s*\.\s*REFRESH\s*\(\s*\)/g, '__notifyListeners()');
      // NUMBER(...) -> parseFloat(...)
      js = js.replace(/\bNUMBER\s*\(/g, 'parseFloat(');
      // Handle field .value access
      js = js.replace(/\b(display)\s*\.\s*value/g, `document.getElementById('display').value`);
      js = js.replace(/\b(operand1)\s*\.\s*value/g, `document.getElementById('operand1').value`);
      js = js.replace(/\b(operand2)\s*\.\s*value/g, `document.getElementById('operand2').value`);
      js = js.replace(/\b(operationType)\s*\.\s*value/g, `document.getElementById('operationType').value`);
      // Split into statements on ; or newlines
      lines.push(js);
      return lines;
    }
  }

  // ============================================================
  // HTML GENERATOR
  // ============================================================

  function generateHTML(js, ontologyTurtle) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DSL1 Application</title>
<script src="https://unpkg.com/n3@1.17.2/browser/n3.min.js"><\/script>
<style>
  :root {
    --primary: #4a6cf7;
    --primary-dark: #3a5ce5;
    --secondary: #6c757d;
    --success: #28a745;
    --danger: #dc3545;
    --bg: #f8f9fa;
    --surface: #ffffff;
    --border: #dee2e6;
    --text: #212529;
    --text-muted: #6c757d;
    --radius: 6px;
    --shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; background: var(--bg); color: var(--text); min-height: 100vh; }
  #dsl-app { max-width: 900px; margin: 0 auto; padding: 24px; }
  .dsl-window { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; }
  .dsl-window h2 { font-size: 22px; font-weight: 600; margin-bottom: 20px; color: var(--text); border-bottom: 2px solid var(--border); padding-bottom: 12px; }
  .field-group { margin-bottom: 16px; }
  .field-group label { display: block; font-weight: 500; margin-bottom: 6px; color: var(--text); }
  .field-group input, .field-group select { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px; background: var(--surface); color: var(--text); transition: border-color 0.2s; }
  .field-group input:focus, .field-group select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(74,108,247,0.15); }
  .btn { display: inline-flex; align-items: center; padding: 8px 18px; border: none; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.1s; margin-right: 8px; margin-bottom: 8px; }
  .btn:active { transform: translateY(1px); }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-primary:hover { background: var(--primary-dark); }
  .btn-secondary { background: var(--secondary); color: #fff; }
  .btn-secondary:hover { background: #5a6268; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover { background: #c82333; }
  .listview-section { margin-top: 24px; }
  .listview-section h3 { font-size: 16px; font-weight: 600; margin-bottom: 10px; color: var(--text); }
  table.listview { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.listview th { background: #f1f3f5; text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border); font-weight: 600; color: var(--text-muted); }
  table.listview td { padding: 7px 12px; border-bottom: 1px solid var(--border); }
  table.listview tr:hover td { background: #f8f9fa; }
  .empty-msg { color: var(--text-muted); font-style: italic; padding: 16px; text-align: center; }
  .dsl-label { font-size: 13px; color: var(--text-muted); margin: 8px 0; }
  .button-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
</style>
</head>
<body>
<div id="dsl-app"></div>
<script>
// N3.js is loaded from CDN as window.N3
const __N3 = window.N3;

${js}
<\/script>
</body>
</html>`;
  }

  // ============================================================
  // MAIN ENTRY POINT
  // ============================================================

  function translate(dslCode, uiDslCode, turtleOntology) {
    const errors = [];
    let dslAST = { prefixes: {}, functions: [], statements: [] };
    let uiAST = { windows: [], prefixes: {} };

    try {
      const tokens = lexDSL(dslCode || '');
      const result = parseDSL(tokens);
      dslAST = result.ast;
      if (result.errors.length) errors.push(...result.errors.map(e => ({ type:'warning', message: e })));
    } catch(e) {
      errors.push({ type:'error', stage:'parser', message: 'DSL parse error: ' + e.message });
    }

    try {
      uiAST = parseUIDSL(uiDslCode || '');
    } catch(e) {
      errors.push({ type:'error', stage:'parser', message: 'UI DSL parse error: ' + e.message });
    }

    let html = '';
    try {
      const js = generateJS(dslAST, uiAST, turtleOntology || '');
      html = generateHTML(js, turtleOntology || '');
    } catch(e) {
      errors.push({ type:'error', stage:'codegen', message: 'Code generation error: ' + e.message });
    }

    return { html, errors };
  }

  return {
    translate,
    lexDSL,
    parseDSL,
    parseUIDSL,
    generateJS,
    generateHTML,
  };
}));
