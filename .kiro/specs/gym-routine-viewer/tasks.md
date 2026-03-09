# Implementation Plan: Gym Routine Viewer

## Overview

Implementación de `ApiPoc.gs` como Web App de Google Apps Script de solo lectura, con un módulo de testing en Node.js usando fast-check y unit tests. Las tareas siguen el orden: estructura base → parser puro → handlers → integración → tests.

## Tasks

- [ ] 1. Configurar estructura del proyecto y entorno de testing
  - Crear `package.json` con dependencias: `fast-check`, `jest` (o `node:test`)
  - Crear archivo de configuración de tests (`jest.config.js` o equivalente)
  - Crear carpeta `tests/` con archivos vacíos: `parser.test.js` y `handlers.test.js`
  - _Requirements: 7.1_

- [ ] 2. Implementar el Response Builder y el Entry Point base
  - [ ] 2.1 Implementar `buildResponse(ok, payload)` en `ApiPoc.gs`
    - Serializar con `JSON.stringify(payload, null, 2)` y `ContentService.MimeType.JSON`
    - Cubrir los dos casos: `{ ok: true, data }` y `{ ok: false, error }`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ] 2.2 Implementar `doGet(e)` con try/catch global
    - Extraer `e.parameter.action` y `e.parameter.sheet`
    - Delegar a `routeRequest` y capturar errores de runtime
    - _Requirements: 2.5, 8.1_

- [ ] 3. Implementar `detectWeekGroups(values)`
  - [ ] 3.1 Implementar la función en `ApiPoc.gs`
    - Escanear primeras 20 filas buscando `/sem(ana)?\s*\d+/i`
    - Registrar `weekLabel`, `headerRow` (1-based), `startColumn` (1-based)
    - Construir `FieldMap` escaneando hasta 4 filas abajo y 8 columnas a la derecha
    - Deduplicar por `(weekLabel, startColumn)` y ordenar por `startColumn`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ]* 3.2 Escribir property test: Property 6 — WeekGroup detection completeness
    - **Property 6: WeekGroup detection completeness**
    - **Validates: Requirements 4.1, 4.2**
    - `// Feature: gym-routine-viewer, Property 6: WeekGroup detection completeness`
  - [ ]* 3.3 Escribir property test: Property 7 — WeekGroup FieldMap construction
    - **Property 7: WeekGroup FieldMap construction**
    - **Validates: Requirements 4.3**
    - `// Feature: gym-routine-viewer, Property 7: WeekGroup FieldMap construction`
  - [ ]* 3.4 Escribir property test: Property 8 — WeekGroup deduplication
    - **Property 8: WeekGroup deduplication**
    - **Validates: Requirements 4.4**
    - `// Feature: gym-routine-viewer, Property 8: WeekGroup deduplication`
  - [ ]* 3.5 Escribir property test: Property 9 — WeekGroups sorted by startColumn
    - **Property 9: WeekGroups sorted by startColumn**
    - **Validates: Requirements 4.5**
    - `// Feature: gym-routine-viewer, Property 9: WeekGroups sorted by startColumn`
  - [ ]* 3.6 Escribir unit tests para casos borde de `detectWeekGroups`
    - Sheet sin etiquetas de semana → `weekGroups: []`
    - Etiquetas fuera de las primeras 20 filas → no detectadas
    - Campo no encontrado en FieldMap → `null`
    - _Requirements: 4.6, 6.8_

- [ ] 4. Implementar `detectDaysAndExercises(values, weekGroups)`
  - [ ] 4.1 Implementar la función en `ApiPoc.gs`
    - Detectar filas con `/d[ií]a\s*\d+/i` para abrir nuevos Days
    - Detectar filas con `/^[A-Z]\d{1,2}$/i` para identificar Exercises
    - Buscar nombre del ejercicio en las 3 columnas siguientes al código
    - Omitir silenciosamente ejercicios sin nombre adyacente
    - Construir array `weeks` con valores y columnas de cada WeekGroup
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  - [ ]* 4.2 Escribir property test: Property 10 — Day detection completeness
    - **Property 10: Day detection completeness**
    - **Validates: Requirements 5.1, 5.2**
    - `// Feature: gym-routine-viewer, Property 10: Day detection completeness`
  - [ ]* 4.3 Escribir property test: Property 11 — Exercise grouping under correct Day
    - **Property 11: Exercise grouping under correct Day**
    - **Validates: Requirements 5.3**
    - `// Feature: gym-routine-viewer, Property 11: Exercise grouping under correct Day`
  - [ ]* 4.4 Escribir property test: Property 12 — Exercise detection and shape
    - **Property 12: Exercise detection and shape**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - `// Feature: gym-routine-viewer, Property 12: Exercise detection and shape`
  - [ ]* 4.5 Escribir property test: Property 13 — Exercise weeks array completeness
    - **Property 13: Exercise weeks array completeness**
    - **Validates: Requirements 6.5, 6.6, 6.7**
    - `// Feature: gym-routine-viewer, Property 13: Exercise weeks array completeness`
  - [ ]* 4.6 Escribir unit tests para casos borde de `detectDaysAndExercises`
    - Sheet sin Days → `days: []`
    - Ejercicio sin nombre adyacente → omitido
    - Campo faltante en FieldMap → `values.<field>: ""`, `columns.<field>: null`
    - _Requirements: 5.4, 6.4, 6.8_

- [ ] 5. Checkpoint — Asegurar que todos los tests del parser pasan
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implementar `parseSheet(sheet)` y los handlers
  - [ ] 6.1 Implementar `parseSheet(sheet)` en `ApiPoc.gs`
    - Llamar a `sheet.getDisplayValues()` para obtener el array 2D
    - Orquestar `detectWeekGroups` y `detectDaysAndExercises`
    - Retornar objeto `ParsedPlan` con `spreadsheetId`, `spreadsheetName`, `sheetName`, `weekGroups`, `days`
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 6.2 Implementar `handleHealth()` en `ApiPoc.gs`
    - Retornar `{ ok: true, status: "ok" }`
    - _Requirements: 1.1, 1.2_
  - [ ] 6.3 Implementar `handlePlan(params)` en `ApiPoc.gs`
    - Usar `"1° Plan"` como default si `params.sheet` está ausente
    - Retornar error si la sheet no existe
    - Invocar `parseSheet` y retornar resultado
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 6.4 Implementar `routeRequest(action, params)` en `ApiPoc.gs`
    - Despachar a `handleHealth` o `handlePlan` según `action`
    - Retornar error para acciones desconocidas
    - _Requirements: 2.4_

- [ ] 7. Escribir tests para los handlers con mocks de SpreadsheetApp
  - [ ]* 7.1 Escribir property test: Property 1 — Health response shape
    - **Property 1: Health response shape**
    - **Validates: Requirements 1.1**
    - `// Feature: gym-routine-viewer, Property 1: Health response shape`
  - [ ]* 7.2 Escribir property test: Property 2 — Response envelope invariant
    - **Property 2: Response envelope invariant**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - `// Feature: gym-routine-viewer, Property 2: Response envelope invariant`
  - [ ]* 7.3 Escribir property test: Property 4 — Unknown action returns error
    - **Property 4: Unknown action returns error**
    - **Validates: Requirements 2.4**
    - `// Feature: gym-routine-viewer, Property 4: Unknown action returns error`
  - [ ]* 7.4 Escribir property test: Property 5 — Missing sheet returns error
    - **Property 5: Missing sheet returns error**
    - **Validates: Requirements 2.3**
    - `// Feature: gym-routine-viewer, Property 5: Missing sheet returns error`
  - [ ]* 7.5 Escribir property test: Property 3 — Plan metadata completeness
    - **Property 3: Plan metadata completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - `// Feature: gym-routine-viewer, Property 3: Plan metadata completeness`
  - [ ]* 7.6 Escribir unit tests para handlers
    - Default de sheet a `"1° Plan"` cuando el parámetro se omite
    - Formato de indentación de 2 espacios en el JSON serializado
    - Error de runtime capturado en `doGet`
    - _Requirements: 2.2, 2.5, 8.5_

- [ ] 8. Final checkpoint — Asegurar que todos los tests pasan
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- `detectWeekGroups` y `detectDaysAndExercises` son funciones puras testeables en Node.js sin mocks
- Los handlers requieren mocks simples de `SpreadsheetApp` para los tests
- Cada property test debe correr mínimo 100 iteraciones con fast-check
- `ApiPoc.gs` no debe importar ni llamar funciones de `onEdit.gs` u `onOpen.gs`
