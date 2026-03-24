// ============================================================================
// SPARQL.js — модуль выполнения SPARQL-запросов через Comunica
//
// Файл: ver2/examples/calculator/SPARQL.js
//
// Назначение:
//   Единственное место в проекте, где используется Comunica.
//   Реализует функцию funSPARQLvalues(currentStore, sparqlQuery),
//   которая является ключевой функцией DSL1 для чтения данных из
//   RDF-хранилища через полный SPARQL 1.1.
//
// Требования:
//   Перед подключением этого файла должны быть загружены:
//   1. N3.js:      <script src="https://unpkg.com/n3@1.17.2/browser/n3.min.js">
//   2. Comunica:   <script src="https://rdf.js.org/comunica-browser/versions/v4/
//                             engines/query-sparql-rdfjs/comunica-browser.js">
//
// Использование в HTML:
//   <script src="SPARQL.js"></script>
//   ...
//   let rows = await funSPARQLvalues(store, "SELECT ?x WHERE { ?x a calc:Op }");
//
// Логирование для DSL1-консоли:
//   Если определена глобальная функция window.__dsl1Log(entry),
//   то каждый запрос и его результат будут переданы в неё.
//   Это позволяет calculator_DSL1.html показывать запросы в консоли DSL1.
// ============================================================================


// ----------------------------------------------------------------------------
// Движок Comunica — создаётся один раз на весь срок жизни страницы.
// Comunica.QueryEngine — это глобальный класс, экспортируемый comunica-browser.js
// ----------------------------------------------------------------------------
var sparqlEngine = null;

// Инициализируем движок при первом вызове funSPARQLvalues
function getSparqlEngine() {
  if (!sparqlEngine) {
    // Comunica экспортирует конструктор QueryEngine в глобальный объект Comunica
    if (typeof Comunica === 'undefined' || !Comunica.QueryEngine) {
      throw new Error('Comunica не загружена. Подключите comunica-browser.js перед SPARQL.js');
    }
    sparqlEngine = new Comunica.QueryEngine();
  }
  return sparqlEngine;
}


// ----------------------------------------------------------------------------
// funSPARQLvalues(currentStore, sparqlQuery)
//
// Выполняет SPARQL SELECT запрос против N3.Store через движок Comunica.
// Возвращает Promise с массивом объектов — строк результата.
//
// Параметры:
//   currentStore  {N3.Store}  — хранилище RDF с загруженными тройками
//   sparqlQuery   {string}    — строка SPARQL SELECT запроса
//
// Возвращает:
//   Promise<Array<Object>>  — массив объектов вида:
//     { varName1: RDF.Term, varName2: RDF.Term, ... }
//   При ошибке возвращает [] и логирует ошибку.
//
// Пример результата для запроса SELECT ?label ?symbol WHERE {...}:
//   [
//     { label: { value: "add",      termType: "Literal" },
//               symbol: { value: "+", termType: "Literal" } },
//     { label: { value: "subtract", termType: "Literal" },
//               symbol: { value: "-", termType: "Literal" } },
//     ...
//   ]
// ----------------------------------------------------------------------------
async function funSPARQLvalues(currentStore, sparqlQuery) {

  // Логируем запрос в DSL1-консоль (если она подключена)
  _dsl1Log({ тип: 'sparql-запрос', запрос: sparqlQuery });

  var результат = [];

  try {
    var engine = getSparqlEngine();

    // Comunica принимает N3.Store напрямую как источник данных RDF/JS
    var bindingsStream = await engine.queryBindings(sparqlQuery, {
      sources: [currentStore]
    });

    // Собираем все строки результата из потока
    var bindings = await bindingsStream.toArray();

    // Преобразуем каждую строку Comunica в простой JS-объект
    результат = bindings.map(function(row) {
      var obj = {};
      // row.entries() возвращает пары [имяПеременной, RDF.Term]
      for (var entry of row.entries()) {
        var varName = entry[0]; // имя переменной без '?'
        var term    = entry[1]; // RDF.Term из Comunica
        obj[varName] = term;
      }
      return obj;
    });

  } catch (ошибка) {
    console.error('funSPARQLvalues: ошибка SPARQL-запроса:', ошибка);
    _dsl1Log({ тип: 'sparql-ошибка', сообщение: String(ошибка) });
    результат = [];
  }

  // Логируем результат в DSL1-консоль
  _dsl1Log({ тип: 'sparql-результат', количество: результат.length, строки: результат });

  return результат;
}


// ----------------------------------------------------------------------------
// _dsl1Log(entry)
//
// Внутренняя вспомогательная функция для логирования в DSL1-консоль.
// Если window.__dsl1Log определена (подключён calculator_DSL1.html),
// вызывает её с переданным объектом.
// В противном случае — тихо игнорирует (не блокирует работу).
// ----------------------------------------------------------------------------
function _dsl1Log(entry) {
  if (typeof window !== 'undefined' && typeof window.__dsl1Log === 'function') {
    try {
      window.__dsl1Log(entry);
    } catch (e) {
      // Ошибка в логгере не должна ломать основную работу
    }
  }
}
