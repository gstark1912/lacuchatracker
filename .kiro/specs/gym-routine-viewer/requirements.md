# Requirements Document

## Introduction

El Gym Routine Viewer POC es una capa de lectura sobre una Google Sheet de rutinas de gimnasio existente. El objetivo es exponer la estructura de la planilla como JSON mediante un Web App de Google Apps Script, sin modificar ningún script existente. Esto habilita una futura UI externa mobile-first que consuma esos datos de forma más cómoda que la sheet original.

El alcance del POC es exclusivamente lectura. No hay escritura, autenticación avanzada ni backend propio.

## Glossary

- **Web_App**: El endpoint HTTP desplegado desde Google Apps Script mediante `doGet`.
- **ApiPoc**: El archivo `ApiPoc.gs` que contiene toda la lógica nueva del POC.
- **Sheet**: Una hoja individual dentro del Spreadsheet (ej: `1° Plan`).
- **Spreadsheet**: El archivo de Google Sheets completo que contiene todas las hojas.
- **Parser**: El componente dentro de ApiPoc que interpreta la estructura visual de una Sheet y la convierte en datos estructurados.
- **WeekGroup**: Un bloque de columnas que representa una semana de entrenamiento, detectado por la presencia de una etiqueta tipo "Semana N".
- **Day**: Una sección dentro de la Sheet que agrupa ejercicios bajo una etiqueta tipo "DÍA N".
- **Exercise**: Una fila dentro de un Day que contiene un código de ejercicio, nombre y valores por semana.
- **ExerciseCode**: Un identificador alfanumérico corto que identifica un ejercicio (ej: `B1`, `A2`).
- **FieldMap**: El mapeo de columnas para los campos `series`, `reps`, `carga` y `rpe` dentro de un WeekGroup.
- **Consumer**: Cualquier cliente externo (UI, herramienta de testing) que realice requests HTTP al Web_App.

---

## Requirements

### Requirement 1: Endpoint de salud

**User Story:** Como Consumer, quiero un endpoint de health check, para verificar que el Web_App está desplegado y respondiendo correctamente.

#### Acceptance Criteria

1. WHEN a request is received with `action=health`, THE Web_App SHALL return a JSON response with `ok: true` and a status message.
2. WHEN a request is received with `action=health`, THE Web_App SHALL return HTTP 200 with `Content-Type: application/json`.

---

### Requirement 2: Endpoint de plan

**User Story:** Como Consumer, quiero consultar la estructura de una hoja de plan por nombre, para obtener los datos de entrenamiento en formato JSON.

#### Acceptance Criteria

1. WHEN a request is received with `action=plan` and a valid `sheet` parameter, THE Web_App SHALL return a JSON response with `ok: true` and un objeto `data` con la estructura del plan.
2. WHEN a request is received with `action=plan` and the `sheet` parameter is omitted, THE Web_App SHALL use `1° Plan` as the default sheet name.
3. IF the requested sheet does not exist in the Spreadsheet, THEN THE Web_App SHALL return a JSON response with `ok: false` and a descriptive error message.
4. WHEN an unrecognized `action` parameter is received, THE Web_App SHALL return a JSON response with `ok: false` and an error message indicating the action is unknown.
5. IF an unexpected runtime error occurs during request processing, THEN THE Web_App SHALL return a JSON response with `ok: false` and the error message.

---

### Requirement 3: Metadata del Spreadsheet

**User Story:** Como Consumer, quiero recibir metadata del Spreadsheet y la Sheet consultada, para identificar la fuente de los datos.

#### Acceptance Criteria

1. THE Web_App SHALL include `spreadsheetId` in the `data` object of every successful plan response.
2. THE Web_App SHALL include `spreadsheetName` in the `data` object of every successful plan response.
3. THE Web_App SHALL include `sheetName` in the `data` object of every successful plan response, reflecting the name of the Sheet consultada.

---

### Requirement 4: Detección de WeekGroups

**User Story:** Como Consumer, quiero que el Parser detecte los bloques de semana en la Sheet, para saber qué columnas corresponden a cada semana.

#### Acceptance Criteria

1. WHEN the Parser processes a Sheet, THE Parser SHALL detect all WeekGroups by identifying cells that match the pattern `Semana N` or `Sem N` (case-insensitive) within the first 20 rows.
2. WHEN a WeekGroup is detected, THE Parser SHALL record the `weekLabel`, `headerRow` (1-based), and `startColumn` (1-based) for each WeekGroup.
3. WHEN a WeekGroup is detected, THE Parser SHALL scan up to 4 rows below the week label and up to 8 columns to the right to build the FieldMap for `series`, `reps`, `carga`, and `rpe`.
4. THE Parser SHALL deduplicate WeekGroups with the same label and startColumn before returning results.
5. THE Parser SHALL return WeekGroups sorted by `startColumn` in ascending order.
6. IF no WeekGroups are detected in the Sheet, THEN THE Parser SHALL return an empty `weekGroups` array.

---

### Requirement 5: Detección de Days

**User Story:** Como Consumer, quiero que el Parser detecte los días de entrenamiento en la Sheet, para agrupar los ejercicios correctamente.

#### Acceptance Criteria

1. WHEN the Parser processes a Sheet, THE Parser SHALL detect Day boundaries by identifying rows that contain a cell matching the pattern `DÍA N` or `DIA N` (case-insensitive).
2. WHEN a Day is detected, THE Parser SHALL record the `name` and `row` (1-based) of the Day.
3. THE Parser SHALL group all subsequent Exercise rows under the most recently detected Day until a new Day boundary is found.
4. IF no Days are detected in the Sheet, THEN THE Parser SHALL return an empty `days` array.

---

### Requirement 6: Detección de Exercises

**User Story:** Como Consumer, quiero que el Parser detecte los ejercicios dentro de cada Day, para obtener el detalle de cada ejercicio con sus valores por semana.

#### Acceptance Criteria

1. WHEN the Parser processes a row within a Day, THE Parser SHALL identify it as an Exercise row if the row contains a cell matching the ExerciseCode pattern (`[A-Z]\d{1,2}`, case-insensitive).
2. WHEN an Exercise row is detected, THE Parser SHALL record the `row` (1-based), `code`, and `name` of the exercise.
3. WHEN an Exercise row is detected, THE Parser SHALL look for the exercise name in the 3 columns immediately following the ExerciseCode column.
4. IF a row contains an ExerciseCode but no valid name is found in the adjacent columns, THEN THE Parser SHALL skip that row and not include it as an Exercise.
5. WHEN an Exercise is parsed, THE Parser SHALL include a `weeks` array containing one entry per detected WeekGroup.
6. WHEN building the `weeks` array for an Exercise, THE Parser SHALL read the values for `series`, `reps`, `carga`, and `rpe` from the columns defined in each WeekGroup's FieldMap.
7. WHEN building the `weeks` array for an Exercise, THE Parser SHALL include the `columns` mapping (1-based column numbers) for `series`, `reps`, `carga`, and `rpe` to support future write operations.
8. IF a field column is not defined in a WeekGroup's FieldMap, THEN THE Parser SHALL return an empty string for that field's value and `null` for that field's column.

---

### Requirement 7: Aislamiento de código existente

**User Story:** Como entrenador, quiero que el nuevo código no interfiera con los scripts existentes de la planilla, para que mi flujo de trabajo actual no se vea afectado.

#### Acceptance Criteria

1. THE ApiPoc SHALL be implemented as a standalone `.gs` file that does not modify, override, or call any function defined in `onEdit.gs`, `onOpen.gs`, or any other pre-existing script file.
2. THE ApiPoc SHALL only use read-only methods of the Google Apps Script Spreadsheet API (e.g., `getDisplayValues`, `getId`, `getName`, `getSheetByName`).
3. THE ApiPoc SHALL NOT trigger any side effects in the Spreadsheet (no writes, no UI changes, no notifications).

---

### Requirement 8: Formato de respuesta JSON

**User Story:** Como Consumer, quiero que todas las respuestas del Web_App sean JSON válido con una estructura consistente, para poder parsearlas de forma predecible.

#### Acceptance Criteria

1. THE Web_App SHALL return all responses as valid JSON with `Content-Type: application/json`.
2. THE Web_App SHALL include an `ok` boolean field at the root of every response.
3. WHEN `ok` is `true`, THE Web_App SHALL include a `data` object containing the response payload.
4. WHEN `ok` is `false`, THE Web_App SHALL include an `error` string field with a human-readable description of the problem.
5. THE Web_App SHALL format JSON responses with 2-space indentation for readability.
