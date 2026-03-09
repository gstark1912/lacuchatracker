# gymtracker

Parser de planillas de entrenamiento desde Google Sheets, con un prototipo de UI mobile-first para visualizar la rutina semanal.

## ¿Qué hace?

Lee una Google Sheet con estructura de plan de entrenamiento (semanas, días, ejercicios con series/reps/carga/RPE) y la convierte en un objeto `WorkoutPlan` tipado y serializable a JSON.

La UI en `ui/index.html` muestra cómo se vería esa data en una app mobile: selector de semana, tabs por día, y tarjetas de ejercicio agrupadas por bloque.

## Estructura

```
src/
  types.ts              # Tipos: WorkoutPlan, DayBlock, ExerciseRow, WeekGroup, etc.
  sheets-api-client.ts  # Llama a la Google Sheets API v4 y devuelve una CellMatrix
  plan-parser.ts        # Parsea la CellMatrix en un WorkoutPlan (2 pasadas)
  sheet-reader.ts       # Orquesta fetch + parse, expone readSheet / readSheetToJson
  debug.ts              # Script para correr manualmente y volcar el resultado a JSON

ui/
  index.html            # Prototipo de UI mobile-first (vanilla HTML/CSS/JS)
  excel-data.json       # Data de ejemplo para la UI

tests/
  unit/                 # Tests unitarios de cada módulo
  property/             # Tests de propiedad con fast-check
  fixtures/             # Fixtures de datos de prueba
```

## Cómo funciona el parser

El parser trabaja en dos pasadas sobre la `CellMatrix` (matriz de strings):

**Pasada 1 — detección de semanas**
Escanea las primeras 20 filas buscando celdas que coincidan con `Semana N` o `Sem N`. Por cada una detecta las columnas de campos (series, reps, carga, RPE) en las filas siguientes. Deduplica y ordena los `WeekGroup` por columna.

**Pasada 2 — detección de días y ejercicios**
Recorre todas las filas. Cuando encuentra una celda con patrón `Día N`, abre un nuevo `DayBlock`. Dentro de cada bloque, intenta parsear cada fila como `ExerciseRow` buscando un código de ejercicio (`A1`, `B2.`, etc.) seguido de un nombre.

El resultado es un `WorkoutPlan` con todos los días, ejercicios y sus valores por semana.

## Setup

```bash
npm install
```

Crear un `.env` con tu API key de Google Sheets:

```
SHEETS_API_KEY=tu_api_key_aqui
```

## Autenticación

Soporta dos modos:

- **API Key** (lectura de sheets públicas): `{ apiKey: "..." }`
- **OAuth / Service Account** (sheets privadas): `{ keyFile: "ruta/al/credentials.json", scopes: [...] }`

## Uso

```typescript
import { readSheet, readSheetToJson } from "./src/sheet-reader.js"

const result = await readSheetToJson({
  source: {
    type: "sheets-api",
    spreadsheetId: "TU_SPREADSHEET_ID",
    sheetName: "1° Plan",
    auth: { apiKey: process.env.SHEETS_API_KEY },
  },
})

if (result.ok) {
  console.log(result.data) // JSON string del WorkoutPlan
} else {
  console.error(result.error) // { code, message, details }
}
```

## Script de debug

Corre el parser contra la planilla real y guarda el resultado en `debug-output.json`:

```bash
npm run debug
```

## Tests

```bash
npm test
```

## Errores posibles

| Código | Causa |
|---|---|
| `AUTH_ERROR` | API key inválida o sin permisos |
| `SPREADSHEET_NOT_FOUND` | ID de spreadsheet incorrecto o inaccesible |
| `SHEET_NOT_FOUND` | El nombre de la hoja no existe o está vacía |
| `NO_WEEK_GROUPS` | No se encontraron etiquetas de semana en las primeras 20 filas |
| `UNMAPPABLE_STRUCTURE` | Se detectaron semanas pero no bloques de día |
| `UNKNOWN` | Error inesperado de la API o del parser |

## UI (prototipo)

`ui/index.html` es un archivo HTML standalone (sin build, sin dependencias) que muestra la rutina con:

- Selector de semana horizontal con scroll
- Tabs por día de entrenamiento
- Tarjetas de ejercicio agrupadas por bloque (A, B, C...)
- Indicador de RPE por color (🟢 / 🟡 / 🔴)
- Diseño dark mode, mobile-first, max-width 480px

Actualmente usa data hardcodeada. La integración con el parser queda pendiente.
