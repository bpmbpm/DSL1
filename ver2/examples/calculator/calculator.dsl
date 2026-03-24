// ============================================================================
// Калькулятор — PL/SPARQL DSL (ver2_1a)
// Файл: calculator.dsl
//
// Онтологии:
//   - ../../ontology/dsl1_ontology.ttl     (базовый язык DSL1)
//   - ../../ontology/calculator_ontology.ttl (задача Калькулятор)
//
// Модули:
//   0. РАБОЧИЙ ПРОЦЕСС (WORKFLOW) — формализованная схема, привязка к BPMN 2.0
//   1. ИНИЦИАЛИЗАЦИЯ   — загрузка онтологии, получение списка операций
//   2. ВЫЧИСЛЕНИЕ      — ввод чисел, выполнение операции, вывод результата
//
// Идентификаторы полей (id в HTML):
//   Input1    — первое число     (связь .uidsl и .dsl через id=Input1)
//   Input2    — второе число     (связь .uidsl и .dsl через id=Input2)
//   Operation — операция         (выпадающий список, id=Operation)
//   Result    — результат        (поле вывода, только чтение)
//   status    — статус/ошибки    (поле статуса, только чтение)
// ============================================================================

PREFIX calc: <https://github.com/bpmbpm/DSL1/ontology/calculator#>
PREFIX dsl:  <https://github.com/bpmbpm/DSL1/ontology#>
PREFIX dsl1: <https://github.com/bpmbpm/DSL1/ontology/dsl1#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

// Граф, в котором хранится онтология калькулятора
USE GRAPH <calculator>

// Онтологии (загружаются через fetch при инициализации)
USE ONTOLOGY "../../ontology/dsl1_ontology.ttl"
USE ONTOLOGY "../../ontology/calculator_ontology.ttl"


// ============================================================================
// МОДУЛЬ 0: РАБОЧИЙ ПРОЦЕСС (WORKFLOW)
//
// Соответствие BPMN 2.0 (подробная схема — в BPMN_converter.md):
//
// [StartEvent: Открытие страницы]
//   → [ServiceTask: ИНИЦИАЛИЗАЦИЯ]
//       → loadOntology()        — загрузка .ttl в N3.Store
//       → funSPARQLvalues()     — получение операций через SPARQL
//       → заполнение #Operation — инициализация выпадающего списка
//   → [ParallelGateway: AND-split]
//       Ветвь 1: [UserTask: ввод Input1]  — пользователь вводит число
//       Ветвь 2: [UserTask: ввод Input2]  — пользователь вводит число
//       Ветвь 3: [UserTask: выбор Operation] — пользователь выбирает операцию
//       Ветвь 4: [UserTask: кнопка Вычислить]
//           → [ServiceTask: calculate()]
//               → [ExclusiveGateway: la-if Input1/Input2 пустые?]
//                   → да: [ServiceTask: вывод ошибки в id=status]
//                   → нет: [ExclusiveGateway: la-if Operation пустая?]
//                       → да: [ServiceTask: вывод ошибки в id=status]
//                       → нет: [ExclusiveGateway: la-if операция = деление AND Input2 = 0?]
//                           → да: [ServiceTask: вывод ошибки в id=status]
//                           → нет: [ServiceTask: вычисление результата]
//                               → [ServiceTask: вывод в id=Result]
//                               → [ServiceTask: вывод "Расчёт выполнен" в id=status]
//       Ветвь 5: [UserTask: кнопка Очистить]
//           → [ServiceTask: handleClear()] — очистка всех полей
//       Ветвь 6: [UserTask: кнопка Выход]
//           → [EndEvent: завершение процесса]
// ============================================================================


// ============================================================================
// МОДУЛЬ 1: ИНИЦИАЛИЗАЦИЯ
//
// Функции этого модуля вызываются ОДИН РАЗ при загрузке страницы.
// Загружают онтологию в N3.Store и заполняют выпадающий список операций
// через funSPARQLvalues.
//
// [BPMN: ServiceTask: Инициализация]
// ============================================================================

// ----------------------------------------------------------------------------
// FUNCTION getOperations
//
// Запрашивает из хранилища все экземпляры calc:Operation через Comunica SPARQL.
// Возвращает массив строк результата, упорядоченный по dsl:order.
// Используется для заполнения выпадающего списка id=Operation.
//
// Вызов: funSPARQLvalues(currentStore, SPARQL)
// Входные параметры funSPARQLvalues:
//   currentStore — текущий N3.Store с загруженной онтологией
//   SPARQL       — строка запроса SELECT
//
// Возвращает: Promise<Array<{label, symbol, labelRu, orderVal}>>
//
// [BPMN: ServiceTask: Загрузка операций]
// ----------------------------------------------------------------------------
FUNCTION getOperations() {
  // Используем funSPARQLvalues — реализована в SPARQL.js через Comunica
  let sparql = "
    PREFIX calc: <https://github.com/bpmbpm/DSL1/ontology/calculator#>
    PREFIX dsl:  <https://github.com/bpmbpm/DSL1/ontology#>
    SELECT ?op ?label ?symbol ?labelRu ?orderVal WHERE {
      ?op a calc:Operation .
      ?op calc:operationName   ?label .
      ?op calc:operationSymbol ?symbol .
      ?op calc:operationLabel  ?labelRu .
      ?op dsl:order            ?orderVal .
    }
    ORDER BY ASC(?orderVal)
  "
  return funSPARQLvalues(currentStore, sparql)
}


// ============================================================================
// МОДУЛЬ 2: ВЫЧИСЛЕНИЕ
//
// Функции этого модуля вызываются при каждом нажатии кнопки «Вычислить».
// Получают данные из полей Input1, Input2, Operation,
// выполняют арифметику и выводят результат в id=Result или ошибку в id=status.
//
// [BPMN: связка UserTask→ServiceTask по нажатию кнопки]
// ============================================================================

// ----------------------------------------------------------------------------
// FUNCTION calculate
//
// Выполняет арифметическую операцию над двумя числами.
//
// Принимает:
//   Input1        — первое число  (id=Input1, связь через .uidsl)
//   Input2        — второе число  (id=Input2, связь через .uidsl)
//   operationType — выбранная операция (id=Operation, значение из онтологии)
//
// Возвращает: числовой результат или строку с сообщением об ошибке.
// Ошибки выводятся в id=status, результат — в id=Result.
//
// la-if используется вместо JS if, так как вычислитель DSL выполняет
// приведение типов RDF перед ветвлением.
//
// [BPMN: ServiceTask: Вычисление → ExclusiveGateway × 3]
// ----------------------------------------------------------------------------
FUNCTION calculate(Input1, Input2, operationType) {

  // [BPMN: ExclusiveGateway] Проверка: оба операнда должны быть введены
  la-if (Input1 === null || Input2 === null || Input1 === "" || Input2 === "") {
    return ERROR "Ошибка: введите оба числа"    // → id=status
  }

  // [BPMN: ExclusiveGateway] Проверка: операция должна быть выбрана
  la-if (operationType === null || operationType === "") {
    return ERROR "Ошибка: выберите операцию"    // → id=status
  }

  // [BPMN: ExclusiveGateway] Диспетчеризация по типу операции
  la-if (operationType === "add") {
    return Input1 + Input2
  }

  la-if (operationType === "subtract") {
    return Input1 - Input2
  }

  la-if (operationType === "multiply") {
    return Input1 * Input2
  }

  la-if (operationType === "divide") {
    // [BPMN: ExclusiveGateway] Проверка деления на ноль
    la-if (Input2 === 0) {
      return ERROR "Ошибка: деление на ноль"   // → id=status
    }
    return Input1 / Input2
  }

  // Неизвестная операция
  return ERROR "Ошибка: неизвестная операция: " + operationType   // → id=status
}


// ----------------------------------------------------------------------------
// FUNCTION formatResult
//
// Вспомогательная функция: форматирует числовой результат для отображения.
// Строки с ошибками НЕ передаются сюда — они идут напрямую в id=status.
// Числа округляются до 10 знаков после запятой, лишние нули убираются.
// ----------------------------------------------------------------------------
FUNCTION formatResult(value, decimalPlaces) {
  la-if (typeof value === "string") {
    // Строки с ошибками — передаём как есть (не должны сюда попасть в ver2_1a)
    return value
  }

  let places = decimalPlaces === null ? 10 : decimalPlaces
  let rounded = ROUND(value, places)

  // Преобразуем в строку (убираем лишние нули)
  let str = STRING(rounded)
  return str
}
