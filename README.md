# gymtracker

Parser de planillas de entrenamiento desde Google Sheets, con una UI mobile-first para visualizar y registrar la rutina semanal.

## ¿Qué hace?

Lee una Google Sheet con estructura de plan de entrenamiento (semanas, días, ejercicios con series/reps/carga/RPE) y la convierte en un objeto `WorkoutPlan` tipado. La UI Vue permite navegar por sesiones, registrar esfuerzos (RPE) y escribir los cambios de vuelta a la planilla en tiempo real.

## Estructura

```
src/
  types.ts              # Tipos: WorkoutPlan, DayBlock, ExerciseRow, WeekGroup, etc.
  sheets-api-client.ts  # Llama a la Google Sheets API v4 y devuelve una CellMatrix
  plan-parser.ts        # Parsea la CellMatrix en un WorkoutPlan (2 pasadas)
  sheet-reader.ts       # Orquesta fetch + parse, expone readSheet / readSheetToJson
  server.ts             # API Express: GET /api/plan, PATCH /api/plan/cell
  auth-setup.ts         # Script one-time para obtener el OAuth2 refresh token
  debug.ts              # Script para correr manualmente y volcar el resultado a JSON

ui-app/                 # Frontend Vue 3 + Vite + Pinia
  src/
    App.vue             # Componente raíz
    store.ts            # Estado global (Pinia)
    appState.ts         # Transforma WorkoutPlan → AppState para la UI
    types.ts            # Tipos de UI: Session, SessionExercise, AppState
    components/
      SessionView.vue   # Navegación entre sesiones, lista de ejercicios
      ExerciseCard.vue  # Tarjeta de ejercicio con edición y progresión

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

### 1. Instalar dependencias

```bash
npm install
cd ui-app && npm install && cd ..
```

### 2. Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
# Lectura de la planilla (Google Sheets API Key — para sheets públicas o compartidas)
SHEETS_API_KEY=tu_api_key_aqui

# ID de la planilla y nombre de la hoja
SPREADSHEET_ID=id_de_tu_spreadsheet
SHEET_NAME=1° Plan

# Escritura a la planilla (OAuth2 — necesario para editar celdas)
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REFRESH_TOKEN=tu_refresh_token
```

### 3. Correr en desarrollo

```bash
npm run dev
```

Levanta ambos procesos en paralelo:
- Express en `http://localhost:3001` (API)
- Vite en `http://localhost:5173` (UI, con proxy `/api` → `:3001`)

Abrí `http://localhost:5173` en el navegador.

> En producción (Railway) Express sirve también el frontend estático desde `ui-app/dist`. Localmente Vite se encarga de eso, no hace falta buildear.

## Variables de entorno — cómo conseguirlas

### `SPREADSHEET_ID`

El ID de tu Google Sheet. Lo encontrás en la URL de la planilla:

```
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

### `SHEET_NAME`

El nombre exacto de la pestaña dentro de la planilla (ej: `1° Plan`). Tiene que coincidir carácter a carácter con el nombre que aparece en la tab de Google Sheets, incluyendo tildes y caracteres especiales.

---

### `SHEETS_API_KEY`

Necesaria para leer la planilla.

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto (o usar uno existente)
3. Habilitar la **Google Sheets API**
4. Ir a **APIs & Services → Credentials → Create Credentials → API Key**
5. Copiar la key generada

> Si la planilla es privada, la API Key no alcanza — necesitás OAuth2 (ver abajo).

---

### `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

Necesarios para escribir de vuelta a la planilla via OAuth2.

1. En Google Cloud Console, ir a **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
2. Tipo de aplicación: **Web application**
3. En "Authorized redirect URIs" agregar: `http://localhost:3001/oauth/callback`
4. Descargar el JSON de credenciales y guardarlo como `credentials.json` en la raíz del proyecto
5. El `client_id` y `client_secret` están dentro de ese archivo (también quedan en la consola)

> En Google Cloud Console, la app empieza en modo "Testing". Hay que agregar tu cuenta de Gmail como usuario de prueba en **OAuth consent screen → Test users**.

---

### `GOOGLE_REFRESH_TOKEN`

Token de larga duración que permite escribir a la planilla sin intervención manual. Se obtiene una sola vez con el script de auth:

```bash
npm run auth-setup
```

El script levanta un servidor local, abre una URL de autorización en la consola, y cuando completás el flujo OAuth en el navegador imprime las tres variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) listas para copiar al `.env` o a las variables de entorno de Railway.

> El `refresh_token` solo aparece la primera vez que autorizás la app. Si necesitás regenerarlo, revocá el acceso desde [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y corré `npm run auth-setup` de nuevo.

---

## Deploy en Railway

1. Crear un nuevo proyecto en [Railway](https://railway.app/)
2. Conectar el repositorio de GitHub
3. Agregar las variables de entorno en el panel de Railway:
   - `SHEETS_API_KEY`
   - `SPREADSHEET_ID`
   - `SHEET_NAME`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`

Railway detecta automáticamente el `package.json` raíz y corre `npm run build` (que instala deps y buildea `ui-app`) seguido de `npm start`. Todo en un solo servicio.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Levanta servidor + UI en modo desarrollo |
| `npm run server` | Solo el servidor Express (`:3001`) |
| `npm run ui` | Solo el frontend Vite (`:5173`) |
| `npm run auth-setup` | Flujo OAuth one-time para obtener el refresh token |
| `npm test` | Corre los tests una vez |
| `npm run test:watch` | Tests en modo watch |
| `npm run debug` | Corre el parser contra la planilla real y guarda `debug-output.json` |

## Errores posibles

| Código | Causa |
|---|---|
| `AUTH_ERROR` | API key inválida o sin permisos |
| `SPREADSHEET_NOT_FOUND` | ID de spreadsheet incorrecto o inaccesible |
| `SHEET_NOT_FOUND` | El nombre de la hoja no existe o está vacía |
| `NO_WEEK_GROUPS` | No se encontraron etiquetas de semana en las primeras 20 filas |
| `UNMAPPABLE_STRUCTURE` | Se detectaron semanas pero no bloques de día |
| `UNKNOWN` | Error inesperado de la API o del parser |
