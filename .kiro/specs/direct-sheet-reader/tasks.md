# Tasks: direct-sheet-reader

## Task List

- [x] 1. Project setup
  - [x] 1.1 Initialize Node.js/TypeScript project with `tsconfig.json`, `package.json` and dependencies (`@googleapis/sheets`, `fast-check`, `vitest`)
  - [x] 1.2 Create `src/types.ts` with all shared types: `CellMatrix`, `WeekGroup`, `WeekFields`, `DayBlock`, `ExerciseRow`, `WeekValues`, `WorkoutPlan`, `SheetReaderError`, `Result`, `ApiKeyAuth`, `OAuthCredentials`, `SheetsApiOptions`, `SheetReaderConfig`

- [x] 2. Sheets_API_Client
  - [x] 2.1 Implement `fetchSheet(options: SheetsApiOptions)` using `@googleapis/sheets` with `spreadsheets.values.get` and `valueRenderOption = "FORMATTED_VALUE"`
  - [x] 2.2 Normalize response: pad short rows with `""` so all rows have equal length
  - [x] 2.3 Map API errors to `SheetReaderError` codes: `AUTH_ERROR` (401/403), `SPREADSHEET_NOT_FOUND` (404), `SHEET_NOT_FOUND` (range not found), `UNKNOWN`
  - [x] 2.4 Support both `ApiKeyAuth` and `OAuthCredentials` auth strategies

- [x] 3. Plan_Parser — Week_Group detection (Pasada 1)
  - [x] 3.1 Implement `detectWeekGroups(matrix)`: scan first 20 rows for cells matching `/^semana\s*\d+/i` or `/^sem\s*\d+/i`
  - [x] 3.2 Implement `detectFieldsForWeek(matrix, weekRow, weekCol)`: scan ±3 rows and 8 columns right for "series", "reps", "carga", "rpe" labels
  - [x] 3.3 Deduplicate by `(normalize(weekLabel) + "|" + startColumn)` and sort by `startColumn ASC`
  - [x] 3.4 Handle shared Series column: if `fields.series` is left of `startColumn`, propagate to all WeekGroups
  - [x] 3.5 Return `NO_WEEK_GROUPS` error if no groups found

- [x] 4. Plan_Parser — Day_Block and Exercise_Row detection (Pasada 2)
  - [x] 4.1 Implement `parseDaysAndExercises(matrix, weekGroups)`: iterate rows, detect day rows via `/^d[ií]a\s*\d+/i`
  - [x] 4.2 Capture optional subtitle from the row immediately following a day header
  - [x] 4.3 Implement `tryParseExerciseRow(row, rowIndex, weekGroups)`: detect exercise code `/^[A-Z]\d{1,2}$/i`, name, optional `videoUrl`
  - [x] 4.4 For each exercise, collect `WeekValues` (series, reps, carga, rpe as strings) and column numbers for all WeekGroups
  - [x] 4.5 Ignore exercise rows with no active DayBlock (Req 4.6)
  - [x] 4.6 Implement normalization helpers: `normalize`, `looksLikeExerciseCode`, `looksLikeExerciseName`

- [x] 5. Plan_Parser — parsePlan entry point
  - [x] 5.1 Implement `parsePlan(matrix, sheetName, spreadsheetId?)` combining both passes into a `Result<WorkoutPlan, SheetReaderError>`
  - [x] 5.2 Return `UNMAPPABLE_STRUCTURE` error when structure cannot be mapped to expected format

- [x] 6. Sheet_Reader entry point
  - [x] 6.1 Implement `readSheet(config)`: delegate to `Sheets_API_Client`, then `Plan_Parser`, return `Result<WorkoutPlan, SheetReaderError>`
  - [x] 6.2 Implement `readSheetToJson(config)`: call `readSheet` and serialize result with `JSON.stringify`

- [x] 7. Unit tests
  - [x] 7.1 `sheets-api-client.test.ts`: mock 401 → `AUTH_ERROR`, mock 404 → `SPREADSHEET_NOT_FOUND`, unknown sheet → `SHEET_NOT_FOUND` with available sheets list
  - [x] 7.2 `plan-parser.test.ts`: matrix without week labels → `NO_WEEK_GROUPS`; exercises before any day → ignored; shared Series column; `videoUrl` capture; fixture comparison vs known `ApiPoc.gs` output
  - [x] 7.3 `sheet-reader.test.ts`: end-to-end with mocked API response using fixture `sample-matrix.json`

- [x] 8. Property tests
  - [x] 8.1 `week-group-detection.property.test.ts`: Property 1 (complete detection) and Property 2 (deduplication) — generate matrices with random week labels in first 20 rows
  - [x] 8.2 `day-exercise-structure.property.test.ts`: Property 3 (Day_Block/Exercise_Row structure), Property 4 (subtitle capture), Property 5 (field completeness), Property 6 (non-structural rows ignored)
  - [x] 8.3 `json-roundtrip.property.test.ts`: Property 7 (JSON round-trip) and Property 8 (output shape invariant) — generate valid matrices, parse, stringify, parse again and compare

- [x] 9. Fixtures
  - [x] 9.1 Create `tests/fixtures/sample-matrix.json` with a representative Cell_Matrix derived from spreadsheet `1yS82jhnPtaauYiTwSUf6xoJA_SOR0zU2HMe0f79z1pk`
