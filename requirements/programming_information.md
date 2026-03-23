# requirements
## current project (folder)
https://github.com/bpmbpm/DSL1/tree/main/ver2
## code
Браузерный JS. Развертывание на github pages предполагает использование браузерного JS.  
Код должен быть хорошо читаемым человеку с низким уровнем знания js. 

### Pull request
В Pull request указывай измененные файлы. При отсутсвии изменений явно указывай, что изменений нет.  

### doc
Коммениируй код на русском. Файлы описания, докуменация, онтологии (.ttl), интерфейс программы на русском языке.

### js-lib
#### Linked Data
Для формирования tripleStopr \ quadStore (TriG), а также исполнения SPARQL - запросоов используй 
```
 <!-- Подключение библиотеки N3.js для парсинга RDF -->
    <script src="https://unpkg.com/n3@1.17.2/browser/n3.min.js"></script>
  <!-- Подключение библиотеки Comunica для SPARQL запросов -->
    <script src="https://rdf.js.org/comunica-browser/versions/v4/engines/query-sparql-rdfjs/comunica-browser.js"></script>
```
см. https://github.com/bpmbpm/rdf-grapher/tree/main/ver9d
