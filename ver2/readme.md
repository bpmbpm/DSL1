# DSL1 ver2_1a

Упрощённая версия системы программирования DSL1.

## Запуск на GitHub Pages

- [calculator.html](https://bpmbpm.github.io/DSL1/ver2/examples/calculator/calculator.html) — калькулятор
- [calculator_DSL1.html](https://bpmbpm.github.io/DSL1/ver2/examples/calculator/calculator_DSL1.html) — калькулятор + DSL1-консоль

## Отличия от ver1

- **Только браузерный JS** — никакого Node.js, npm, серверов
- Развёртывание на GitHub Pages без дополнительной настройки
- Код DSL разбит на три явных модуля: **WORKFLOW**, **ИНИЦИАЛИЗАЦИЯ** и **ВЫЧИСЛЕНИЕ**

## Структура

```
ver2/
├── ontology/
│   ├── dsl1_ontology.ttl          ← базовая онтология языка DSL1
│   └── calculator_ontology.ttl    ← онтология задачи Калькулятор
└── examples/
    └── calculator/
        ├── calculator.dsl          ← логика на PL/SPARQL DSL
        ├── calculator.uidsl        ← описание интерфейса
        ├── calculator.html         ← калькулятор (основной файл)
        ├── calculator_DSL1.html    ← калькулятор + DSL1-консоль
        ├── SPARQL.js               ← модуль funSPARQLvalues (Comunica)
        ├── BPMN_converter.md       ← конвертация DSL1 → BPMN 2.0
        └── instructions.md         ← пошаговое руководство
```

## Примеры

| Пример | Описание | Запуск |
|--------|----------|--------|
| [calculator](examples/calculator/) | Калькулятор (аналог Hello Calculator из BPMN Runa WFE) | Открыть `calculator.html` в браузере |
| [calculator_DSL1](examples/calculator/) | Калькулятор + DSL1-консоль с SPARQL-логом | Открыть `calculator_DSL1.html` в браузере |

## Использованные библиотеки

```html
<!-- N3.js — парсинг RDF/Turtle и quadStore -->
<script src="https://unpkg.com/n3@1.17.2/browser/n3.min.js"></script>

<!-- Comunica — полный движок SPARQL 1.1 для браузера -->
<script src="https://rdf.js.org/comunica-browser/versions/v4/engines/query-sparql-rdfjs/comunica-browser.js"></script>
```

### Зачем обе библиотеки?

| Библиотека | Роль |
|---|---|
| **N3.js** | Парсинг `.ttl` онтологий и создание хранилища (N3.Store) |
| **Comunica** | Выполнение SPARQL 1.1 запросов через `funSPARQLvalues` |

Comunica принимает N3.Store как источник данных через RDF/JS-интерфейс.
N3.js даёт полноценный парсинг Turtle; Comunica даёт полноценный SPARQL 1.1.
Подробнее — в [instructions.md: раздел 12](examples/calculator/instructions.md#12-отличия-comunica-browserjs-от-n3minjs).

## Онтологии

Две онтологии в папке `ver2/ontology/`:

1. **`dsl1_ontology.ttl`** — базовая онтология самого языка DSL1:
   - Типы полей ввода (`dsl1:NumberField`, `dsl1:DropdownField`, `dsl1:StatusField`, ...)
   - Описание функций, включая `dsl1:funSPARQLvalues`
   - Привязки к BPMN 2.0 (`dsl1:bpmnElement`, `dsl1:BPMNUserTask`, ...)
   - Свойства связи полей с .dsl и .uidsl файлами

2. **`calculator_ontology.ttl`** — онтология задачи Калькулятор:
   - Четыре операции (`calc:Operation`): сложение, вычитание, умножение, деление
   - Поля интерфейса: `calc:Input1`, `calc:Input2`, `calc:OperationField`, `calc:ResultField`, `calc:StatusField`

## Ключевая функция: funSPARQLvalues

```javascript
// Сигнатура (в SPARQL.js):
async function funSPARQLvalues(currentStore, sparqlQuery)
// Возвращает: Promise<Array<Object>> — строки результата SPARQL SELECT
```

Реализована в `SPARQL.js` через Comunica. Используется для заполнения выпадающего
списка операций при инициализации.

## Документация и требования

- [Требования к коду](../requirements/programming_information.md)
- [Пошаговое руководство](examples/calculator/instructions.md)
- [Конвертация DSL1 → BPMN 2.0](examples/calculator/BPMN_converter.md)
- [DSL1 ver1](../ver1/) — полная версия с транслятором, IDE, историей вычислений
