# BPMN_converter.md — Конвертация DSL1 в BPMN 2.0

Описывает соответствие конструкций языка DSL1 элементам BPMN 2.0 и содержит:
- Таблицу соответствий (схему конвертации)
- Алгоритм процесса Calculator в трёх форматах: текст / DSL1 / BPMN 2.0 XML

---

## 1. Схема соответствий DSL1 → BPMN 2.0

| DSL1 конструкция | BPMN 2.0 элемент | Атрибуты |
|---|---|---|
| Точка входа (`DOMContentLoaded`) | `<startEvent>` | `id="Start_App"` |
| `FUNCTION` в модуле ИНИЦИАЛИЗАЦИЯ | `<serviceTask>` | `id="Task_Init"` |
| `funSPARQLvalues(store, query)` | `<serviceTask>` | `id="Task_LoadOperations"` |
| `FIELD Input1` (ввод пользователя) | `<userTask>` | `id="Task_Input1"` |
| `FIELD Input2` (ввод пользователя) | `<userTask>` | `id="Task_Input2"` |
| `DROPDOWN Operation BIND TO` | `<serviceTask>` | `id="Task_LoadOp"` |
| Одновременное ожидание нескольких полей | `<parallelGateway>` (AND-split) | `id="Gateway_ParallelSplit"` |
| `la-if (условие)` | `<exclusiveGateway>` (XOR) | `id="Gateway_Check_*"` |
| `BUTTON calculateBtn ON CLICK` | `<userTask>` → граница на `<intermediateCatchEvent>` | `id="Task_Calculate"` |
| `FUNCTION calculate()` | `<serviceTask>` | `id="Task_DoCalc"` |
| `FUNCTION formatResult()` | `<serviceTask>` | `id="Task_Format"` |
| Вывод в `id=Result` | `<dataOutputAssociation>` на DataObject | `id="DataObj_Result"` |
| Вывод ошибки в `id=status` | `<dataOutputAssociation>` + `<errorBoundaryEvent>` | `id="DataObj_Status"` |
| `BUTTON clearBtn ON CLICK` | `<userTask>` | `id="Task_Clear"` |
| `BUTTON exitBtn ON CLICK` / `CLOSE WINDOW` | `<endEvent>` | `id="End_Exit"` |
| Успешное завершение вычисления | `<endEvent>` (сообщение «Расчёт выполнен») | `id="End_Calc_OK"` |

---

## 2. Алгоритм процесса Calculator

### 2а. Текстовое описание

**Процесс: Calculator**

**Старт:** Открытие страницы в браузере (DOMContentLoaded).

**Шаг 1 — Инициализация (ServiceTask):**
- Загрузка онтологий (`dsl1_ontology.ttl`, `calculator_ontology.ttl`) через fetch в N3.Store.
- Выполнение SPARQL-запроса через `funSPARQLvalues(store, query)` — получение списка операций.
- Заполнение выпадающего списка `id=Operation` результатами запроса.

**Шаг 2 — Параллельные ветви (AND-split):**
После инициализации система переходит в режим ожидания пользовательского ввода.
Все ветви выполняются независимо (пользователь может вводить данные в любом порядке):

- **Ветвь A:** Ввод числа в поле `id=Input1` (UserTask).
  Контроль ввода: фильтр числовых символов (цифры, `-`, `.`). Нечисловые символы удаляются автоматически.

- **Ветвь B:** Ввод числа в поле `id=Input2` (UserTask).
  Контроль ввода: аналогичен Ветви A.

- **Ветвь C:** Выбор операции из выпадающего списка `id=Operation` (UserTask).
  Значения списка определены в онтологии и получены через `funSPARQLvalues`.

- **Ветвь D — Кнопка «Вычислить»** (UserTask → ServiceTask):
  1. *Проверка (XOR-1):* `id=Input1` и `id=Input2` не пустые?
     → Нет → в `id=status`: «Ошибка: введите оба числа» → стоп.
  2. *Проверка (XOR-2):* `id=Operation` не пустое?
     → Нет → в `id=status`: «Ошибка: выберите операцию» → стоп.
  3. *Проверка (XOR-3):* Операция = деление AND `id=Input2` = 0?
     → Да → в `id=status`: «Ошибка: деление на ноль» → стоп.
  4. *Вычисление:* `calculate(Input1, Input2, opType)` → числовой результат.
  5. *Форматирование:* `formatResult(result, 10)` → строка.
  6. Вывод результата в `id=Result`.
  7. Вывод «Расчёт выполнен» в `id=status`.

- **Ветвь E — Кнопка «Очистить»** (UserTask → ServiceTask):
  Очистка полей `id=Input1`, `id=Input2`, `id=Operation`, `id=Result`, `id=status`.

**Шаг 3 — Завершение процесса:**
- **Кнопка «Выход»** (UserTask → EndEvent):
  Закрытие окна (`window.close()`). Явный EndEvent, завершающий процесс Calculator.

---

### 2б. Алгоритм в DSL1

```dsl
// ============================================================
// BPMN-представление процесса Calculator в DSL1
// (аннотированная версия calculator.dsl)
// ============================================================

PREFIX calc: <https://github.com/bpmbpm/DSL1/ontology/calculator#>
PREFIX dsl:  <https://github.com/bpmbpm/DSL1/ontology#>

// [BPMN: StartEvent id="Start_App"]
// Инициируется при DOMContentLoaded

// [BPMN: ServiceTask id="Task_Init"]
FUNCTION init() {
  // Загрузка онтологии (fetch → N3 parse → quadStore)
  loadOntology()

  // [BPMN: ServiceTask id="Task_LoadOperations"]
  // funSPARQLvalues: параметры (currentStore, SPARQL-запрос)
  // Возвращает массив значений как результат SPARQL SELECT
  let operations = funSPARQLvalues(currentStore, "
    PREFIX calc: <https://github.com/bpmbpm/DSL1/ontology/calculator#>
    SELECT ?label ?symbol ?labelRu WHERE {
      ?op a calc:Operation ;
          calc:operationName   ?label ;
          calc:operationSymbol ?symbol ;
          calc:operationLabel  ?labelRu .
    } ORDER BY ASC(?order)
  ")

  // Заполнение DROPDOWN Operation результатами SPARQL
  initDropdown(operations)
}

// [BPMN: ParallelGateway id="Gateway_ParallelSplit" — AND-split]

// [BPMN: UserTask id="Task_Input1"]
// Ввод первого числа
// Фильтр DSL: FILTER numeric — разрешены цифры, '-', '.'
FIELD Input1 {
  TYPE    number
  FILTER  numeric
  LABEL   "Первое число (Input1)"
}

// [BPMN: UserTask id="Task_Input2"]
// Ввод второго числа (аналогично Input1)
FIELD Input2 {
  TYPE    number
  FILTER  numeric
  LABEL   "Второе число (Input2)"
}

// [BPMN: UserTask id="Task_SelectOp"]
// Выбор операции из списка
DROPDOWN Operation {
  BIND TO funSPARQLvalues(currentStore, "SELECT ?label ?symbol ...")
}

// [BPMN: UserTask id="Task_ClickCalc" → ServiceTask id="Task_Calculate"]
BUTTON calculateBtn {
  ON CLICK {

    // [BPMN: ExclusiveGateway id="Gateway_Check_Inputs"]
    la-if (Input1 === "" || Input2 === "") {
      // [BPMN: → поток "Ошибка" → ServiceTask "Вывод ошибки в status"]
      status.value = "Ошибка: введите оба числа"   // → id=status
      return
    }

    // [BPMN: ExclusiveGateway id="Gateway_Check_Op"]
    la-if (Operation === "") {
      status.value = "Ошибка: выберите операцию"   // → id=status
      return
    }

    // [BPMN: ServiceTask id="Task_DoCalc"]
    let rawResult = calculate(Input1, Input2, Operation)

    // [BPMN: ExclusiveGateway id="Gateway_Check_DivZero"]
    la-if (rawResult.startsWith("Ошибка")) {
      status.value = rawResult     // → id=status
      return
    }

    // [BPMN: ServiceTask id="Task_Format"]
    let displayResult = formatResult(rawResult, 10)

    // [BPMN: DataOutputAssociation → DataObject id="DataObj_Result"]
    Result.value = displayResult

    // [BPMN: DataOutputAssociation → DataObject id="DataObj_Status"]
    status.value = "Расчёт выполнен"
  }
}

// [BPMN: UserTask id="Task_ClickClear" → ServiceTask id="Task_Clear"]
BUTTON clearBtn {
  ON CLICK {
    Input1.value    = ""
    Input2.value    = ""
    Operation.value = ""
    Result.value    = ""
    status.value    = ""
  }
}

// [BPMN: UserTask id="Task_ClickExit" → EndEvent id="End_Exit"]
BUTTON exitBtn {
  ON CLICK {
    CLOSE WINDOW   // Явный EndEvent процесса
  }
}
```

---

### 2в. BPMN 2.0 XML (конвертированный из DSL1)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:activiti="http://activiti.org/bpmn"
             targetNamespace="https://github.com/bpmbpm/DSL1/calculator"
             id="Calculator_BPMN">

  <process id="Process_Calculator" name="Calculator" isExecutable="true">

    <!-- ─── СТАРТ ─────────────────────────────────────────────── -->
    <startEvent id="Start_App" name="Открытие страницы">
      <outgoing>Flow_Start_to_Init</outgoing>
    </startEvent>

    <!-- ─── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────── -->
    <serviceTask id="Task_Init" name="Инициализация&#10;(loadOntology)">
      <incoming>Flow_Start_to_Init</incoming>
      <outgoing>Flow_Init_to_LoadOp</outgoing>
    </serviceTask>

    <serviceTask id="Task_LoadOperations"
                 name="Загрузка операций&#10;(funSPARQLvalues)">
      <incoming>Flow_Init_to_LoadOp</incoming>
      <outgoing>Flow_LoadOp_to_ParSplit</outgoing>
    </serviceTask>

    <!-- ─── ПАРАЛЛЕЛЬНЫЙ ШЛЮЗ (AND-split) ────────────────────── -->
    <parallelGateway id="Gateway_ParallelSplit" name="Ожидание ввода">
      <incoming>Flow_LoadOp_to_ParSplit</incoming>
      <outgoing>Flow_Par_to_Input1</outgoing>
      <outgoing>Flow_Par_to_Input2</outgoing>
      <outgoing>Flow_Par_to_Operation</outgoing>
      <outgoing>Flow_Par_to_Calc</outgoing>
      <outgoing>Flow_Par_to_Clear</outgoing>
      <outgoing>Flow_Par_to_Exit</outgoing>
    </parallelGateway>

    <!-- ─── ВЕТВЬ A: Ввод Input1 ─────────────────────────────── -->
    <userTask id="Task_Input1" name="Ввод числа&#10;(Input1)">
      <incoming>Flow_Par_to_Input1</incoming>
      <outgoing>Flow_Input1_to_Par2</outgoing>
    </userTask>

    <!-- ─── ВЕТВЬ B: Ввод Input2 ─────────────────────────────── -->
    <userTask id="Task_Input2" name="Ввод числа&#10;(Input2)">
      <incoming>Flow_Par_to_Input2</incoming>
      <outgoing>Flow_Input2_to_Par2</outgoing>
    </userTask>

    <!-- ─── ВЕТВЬ C: Выбор операции ──────────────────────────── -->
    <userTask id="Task_SelectOp" name="Выбор операции&#10;(Operation)">
      <incoming>Flow_Par_to_Operation</incoming>
      <outgoing>Flow_Op_to_Par2</outgoing>
    </userTask>

    <!-- ─── ВЕТВЬ D: Кнопка Вычислить ───────────────────────── -->
    <userTask id="Task_ClickCalc" name="Кнопка&#10;«Вычислить»">
      <incoming>Flow_Par_to_Calc</incoming>
      <outgoing>Flow_Calc_to_CheckInputs</outgoing>
    </userTask>

    <!-- XOR-1: Проверка заполненности полей -->
    <exclusiveGateway id="Gateway_Check_Inputs"
                      name="Input1 и Input2&#10;не пустые?">
      <incoming>Flow_Calc_to_CheckInputs</incoming>
      <outgoing>Flow_Inputs_OK</outgoing>
      <outgoing>Flow_Inputs_Error</outgoing>
    </exclusiveGateway>

    <serviceTask id="Task_Error_Inputs" name="Ошибка в status:&#10;введите оба числа">
      <incoming>Flow_Inputs_Error</incoming>
      <outgoing>Flow_ErrInputs_to_End</outgoing>
    </serviceTask>

    <!-- XOR-2: Проверка выбранной операции -->
    <exclusiveGateway id="Gateway_Check_Op" name="Operation&#10;выбрана?">
      <incoming>Flow_Inputs_OK</incoming>
      <outgoing>Flow_Op_OK</outgoing>
      <outgoing>Flow_Op_Error</outgoing>
    </exclusiveGateway>

    <serviceTask id="Task_Error_Op" name="Ошибка в status:&#10;выберите операцию">
      <incoming>Flow_Op_Error</incoming>
      <outgoing>Flow_ErrOp_to_End</outgoing>
    </serviceTask>

    <!-- XOR-3: Проверка деления на ноль -->
    <exclusiveGateway id="Gateway_Check_DivZero"
                      name="Деление AND&#10;Input2 = 0?">
      <incoming>Flow_Op_OK</incoming>
      <outgoing>Flow_DivZero</outgoing>
      <outgoing>Flow_CalcOK</outgoing>
    </exclusiveGateway>

    <serviceTask id="Task_Error_DivZero" name="Ошибка в status:&#10;деление на ноль">
      <incoming>Flow_DivZero</incoming>
      <outgoing>Flow_ErrDiv_to_End</outgoing>
    </serviceTask>

    <!-- Вычисление и вывод результата -->
    <serviceTask id="Task_DoCalc" name="calculate()">
      <incoming>Flow_CalcOK</incoming>
      <outgoing>Flow_DoCalc_to_Format</outgoing>
    </serviceTask>

    <serviceTask id="Task_Format" name="formatResult()">
      <incoming>Flow_DoCalc_to_Format</incoming>
      <outgoing>Flow_Format_to_Result</outgoing>
    </serviceTask>

    <serviceTask id="Task_ShowResult"
                 name="Вывод в Result&#10;Статус: Расчёт выполнен">
      <incoming>Flow_Format_to_Result</incoming>
      <outgoing>Flow_Result_to_End</outgoing>
    </serviceTask>

    <!-- ─── ВЕТВЬ E: Кнопка Очистить ────────────────────────── -->
    <userTask id="Task_ClickClear" name="Кнопка&#10;«Очистить»">
      <incoming>Flow_Par_to_Clear</incoming>
      <outgoing>Flow_Clear_to_DoClr</outgoing>
    </userTask>

    <serviceTask id="Task_DoClear" name="handleClear()&#10;(сброс полей)">
      <incoming>Flow_Clear_to_DoClr</incoming>
      <outgoing>Flow_DoClr_to_End</outgoing>
    </serviceTask>

    <!-- ─── ВЕТВЬ F: Кнопка Выход ────────────────────────────── -->
    <userTask id="Task_ClickExit" name="Кнопка&#10;«Выход»">
      <incoming>Flow_Par_to_Exit</incoming>
      <outgoing>Flow_Exit_to_End</outgoing>
    </userTask>

    <!-- ─── ЗАВЕРШЕНИЕ ПРОЦЕССА ──────────────────────────────── -->
    <endEvent id="End_Exit" name="Завершение процесса&#10;(window.close)">
      <incoming>Flow_Exit_to_End</incoming>
    </endEvent>

    <endEvent id="End_Calc_OK" name="Расчёт завершён">
      <incoming>Flow_Result_to_End</incoming>
    </endEvent>

    <endEvent id="End_Error_Inputs">
      <incoming>Flow_ErrInputs_to_End</incoming>
    </endEvent>
    <endEvent id="End_Error_Op">
      <incoming>Flow_ErrOp_to_End</incoming>
    </endEvent>
    <endEvent id="End_Error_Div">
      <incoming>Flow_ErrDiv_to_End</incoming>
    </endEvent>
    <endEvent id="End_Clear">
      <incoming>Flow_DoClr_to_End</incoming>
    </endEvent>

    <!-- ─── ПОТОКИ УПРАВЛЕНИЯ (sequence flows) ───────────────── -->
    <sequenceFlow id="Flow_Start_to_Init"    sourceRef="Start_App"             targetRef="Task_Init"/>
    <sequenceFlow id="Flow_Init_to_LoadOp"   sourceRef="Task_Init"             targetRef="Task_LoadOperations"/>
    <sequenceFlow id="Flow_LoadOp_to_ParSplit" sourceRef="Task_LoadOperations"  targetRef="Gateway_ParallelSplit"/>

    <sequenceFlow id="Flow_Par_to_Input1"    sourceRef="Gateway_ParallelSplit" targetRef="Task_Input1"/>
    <sequenceFlow id="Flow_Par_to_Input2"    sourceRef="Gateway_ParallelSplit" targetRef="Task_Input2"/>
    <sequenceFlow id="Flow_Par_to_Operation" sourceRef="Gateway_ParallelSplit" targetRef="Task_SelectOp"/>
    <sequenceFlow id="Flow_Par_to_Calc"      sourceRef="Gateway_ParallelSplit" targetRef="Task_ClickCalc"/>
    <sequenceFlow id="Flow_Par_to_Clear"     sourceRef="Gateway_ParallelSplit" targetRef="Task_ClickClear"/>
    <sequenceFlow id="Flow_Par_to_Exit"      sourceRef="Gateway_ParallelSplit" targetRef="Task_ClickExit"/>

    <sequenceFlow id="Flow_Calc_to_CheckInputs" sourceRef="Task_ClickCalc"      targetRef="Gateway_Check_Inputs"/>

    <sequenceFlow id="Flow_Inputs_OK"        sourceRef="Gateway_Check_Inputs"  targetRef="Gateway_Check_Op">
      <conditionExpression>Input1 != "" AND Input2 != ""</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="Flow_Inputs_Error"     sourceRef="Gateway_Check_Inputs"  targetRef="Task_Error_Inputs">
      <conditionExpression>Input1 == "" OR Input2 == ""</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="Flow_Op_OK"            sourceRef="Gateway_Check_Op"      targetRef="Gateway_Check_DivZero">
      <conditionExpression>Operation != ""</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="Flow_Op_Error"         sourceRef="Gateway_Check_Op"      targetRef="Task_Error_Op">
      <conditionExpression>Operation == ""</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="Flow_DivZero"          sourceRef="Gateway_Check_DivZero" targetRef="Task_Error_DivZero">
      <conditionExpression>Operation == "divide" AND Input2 == 0</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="Flow_CalcOK"           sourceRef="Gateway_Check_DivZero" targetRef="Task_DoCalc">
      <conditionExpression>otherwise</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="Flow_DoCalc_to_Format" sourceRef="Task_DoCalc"           targetRef="Task_Format"/>
    <sequenceFlow id="Flow_Format_to_Result" sourceRef="Task_Format"           targetRef="Task_ShowResult"/>
    <sequenceFlow id="Flow_Result_to_End"    sourceRef="Task_ShowResult"        targetRef="End_Calc_OK"/>

    <sequenceFlow id="Flow_ErrInputs_to_End" sourceRef="Task_Error_Inputs"     targetRef="End_Error_Inputs"/>
    <sequenceFlow id="Flow_ErrOp_to_End"     sourceRef="Task_Error_Op"         targetRef="End_Error_Op"/>
    <sequenceFlow id="Flow_ErrDiv_to_End"    sourceRef="Task_Error_DivZero"    targetRef="End_Error_Div"/>

    <sequenceFlow id="Flow_Clear_to_DoClr"   sourceRef="Task_ClickClear"       targetRef="Task_DoClear"/>
    <sequenceFlow id="Flow_DoClr_to_End"     sourceRef="Task_DoClear"          targetRef="End_Clear"/>

    <sequenceFlow id="Flow_Exit_to_End"      sourceRef="Task_ClickExit"        targetRef="End_Exit"/>

  </process>
</definitions>
```

---

## 3. Детальный алгоритм конвертации DSL1 → BPMN 2.0

### Шаг 1. Определить границы процесса

Каждое DSL1-приложение (`.uidsl`-файл с блоком `WINDOW`) → один `<process>` BPMN.

| Источник | Действие |
|---|---|
| `document.addEventListener('DOMContentLoaded', ...)` | Добавить `<startEvent id="Start_App">` |
| `BUTTON exitBtn ON CLICK { CLOSE WINDOW }` | Добавить `<endEvent id="End_Exit">` |
| Каждый путь завершения в `handleCalculate` | Добавить соответствующий `<endEvent>` |

### Шаг 2. Преобразовать модуль ИНИЦИАЛИЗАЦИЯ

Каждая `FUNCTION` в модуле ИНИЦИАЛИЗАЦИЯ → `<serviceTask>`.

| DSL1 | BPMN |
|---|---|
| `loadOntology()` | `<serviceTask id="Task_Init">` |
| `funSPARQLvalues(store, q)` | `<serviceTask id="Task_LoadOperations">` |
| `initDropdown()` | Включается в Task_LoadOperations как под-шаг |

Последовательность: `Start_App → Task_Init → Task_LoadOperations → Gateway_ParallelSplit`.

### Шаг 3. Преобразовать поля ввода

| DSL1 | BPMN |
|---|---|
| `FIELD Input1 { TYPE number }` | `<userTask id="Task_Input1">` |
| `FIELD Input2 { TYPE number }` | `<userTask id="Task_Input2">` |
| `DROPDOWN Operation { BIND TO ... }` | `<userTask id="Task_SelectOp">` |

Все поля ввода запускаются **параллельно** от `Gateway_ParallelSplit` (AND-split).

### Шаг 4. Преобразовать кнопки

| DSL1 | BPMN |
|---|---|
| `BUTTON calculateBtn ON CLICK { ... }` | `<userTask id="Task_ClickCalc">` → цепочка ServiceTask |
| `BUTTON clearBtn ON CLICK { ... }` | `<userTask id="Task_ClickClear">` → `<serviceTask id="Task_DoClear">` |
| `BUTTON exitBtn ON CLICK { CLOSE WINDOW }` | `<userTask id="Task_ClickExit">` → `<endEvent id="End_Exit">` |

### Шаг 5. Преобразовать la-if в ExclusiveGateway

Каждый `la-if (условие) { return ERROR ... }` → `<exclusiveGateway>` с двумя исходящими потоками:
- Поток «ошибка» (условие истинно) → `<serviceTask>` вывода ошибки → `<endEvent>`.
- Поток «продолжение» (условие ложно) → следующий шаг.

Три проверки в `handleCalculate` → три последовательных `<exclusiveGateway>`.

### Шаг 6. Преобразовать функции вычисления

| DSL1 функция | BPMN ServiceTask |
|---|---|
| `calculate(Input1, Input2, opType)` | `<serviceTask id="Task_DoCalc">` |
| `formatResult(result, 10)` | `<serviceTask id="Task_Format">` |
| Запись в `id=Result` | `<dataOutputAssociation>` к `<dataObjectReference id="DataObj_Result">` |
| Запись в `id=status` | `<dataOutputAssociation>` к `<dataObjectReference id="DataObj_Status">` |

### Шаг 7. Расставить потоки управления

Каждый `return` в DSL1 → завершение пути через `<endEvent>` или возврат в `Gateway_ParallelSplit` (в зависимости от семантики цикла).

---

## 4. Описание фильтра числового ввода в DSL1

Поля `id=Input1` и `id=Input2` используют фильтр `FILTER numeric`.

### Правила фильтра:

| Символ | Разрешён | Причина |
|---|---|---|
| `0`–`9` | ✓ | Цифры |
| `-` | ✓ только первым | Отрицательные числа |
| `.` | ✓ только одна | Десятичная точка |
| Остальные символы | ✗ | Удаляются при вводе |

### Трансляция в JS:

```javascript
// Фильтр реализован через обработчик события 'input'
inputEl.addEventListener('input', function() {
  var val = inputEl.value;
  // Удаляем недопустимые символы
  var filtered = val.replace(/[^0-9.\-]/g, '');
  // Минус разрешён только в начале строки
  if (filtered.indexOf('-') > 0) {
    filtered = '-' + filtered.replace(/-/g, '');
  }
  // Оставляем только первую точку
  var parts = filtered.split('.');
  if (parts.length > 2) {
    filtered = parts[0] + '.' + parts.slice(1).join('');
  }
  inputEl.value = filtered;
});
```

### Почему `type=text`, а не `type=number`:

Поля ввода используют `type="text"` с фильтром, а **не** `type="number"`, потому что:
- `type="number"` добавляет кнопки-стрелки (spin buttons) справа от поля.
- Требование из issue #5: «Никаких кнопок в правой части поля ввода».
- `type="text"` + `inputmode="decimal"` даёт числовую клавиатуру на мобильных без стрелок.
