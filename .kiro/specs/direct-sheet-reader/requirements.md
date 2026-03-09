# Requirements Document

## Introduction

Esta feature explora la lectura directa de datos de la Google Sheet de rutinas de gimnasio sin depender de Apps Script como intermediario. El objetivo es poder parsear la estructura visual de la planilla (desde un archivo `.xlsx` local o desde la Google Sheets API v4) y transformarla en datos estructurados que alimenten una UI mobile-first.

El enfoque es complementario al Apps Script existente: no lo reemplaza, sino que abre una vía alternativa de lectura que puede vivir en un cliente externo (web app, app mobile, etc.) sin necesidad de desplegar un Web App de Google.

## Glossary

- **Sheet_Reader**: componente responsable de leer y parsear los datos de la planilla, ya sea desde un `.xlsx` local o desde la Google Sheets API v4.
- **Xlsx_Parser**: módulo que lee el archivo `.xlsx` local usando una librería como `xlsx` (SheetJS) u `openpyxl`.
- **Sheets_API_Client**: módulo que consume la Google Sheets API v4 para leer rangos de celdas.
- **Plan_Parser**: módulo que transforma la matriz de celdas crudas en una estructura de datos con días, ejercicios y semanas.
- **Cell_Matrix**: representación en memoria de las celdas de una hoja como array bidimensional de strings.
- **Day_Block**: agrupación de ejercicios bajo un mismo día de entrenamiento (ej: "DÍA 1").
- **Week_Group**: agrupación de columnas que corresponden a una semana (ej: "Semana 1"), con sus campos de series, reps, carga y RPE.
- **Exercise_Row**: fila que contiene un código de ejercicio (ej: "B1"), nombre y valores por semana.
- **Round_Trip**: propiedad que garantiza que parsear → serializar → parsear produce un resultado equivalente al original.
- **Composite_Value**: valor de celda que combina número, unidad y/o modificador en un string (ej: `"8 x L"`, `"30°"`, `"12.5KxL"`, `"10° x L 6kg x L"`). No se parsea a número; se preserva como string.
- **Separator_Row**: fila con fondo oscuro u otro marcador visual que actúa como separador entre Day_Blocks. No contiene datos de ejercicios.
- **Video_Icon_Cell**: celda que contiene un ícono o hipervínculo a un video de ejercicio, ubicada entre el código y el nombre del ejercicio.

## Requirements

### Requirement 1: Lectura desde archivo .xlsx local

**User Story:** Como desarrollador, quiero leer la planilla desde el archivo `.xlsx` local, para poder explorar la estructura de datos sin depender de conectividad ni de credenciales de Google.

#### Acceptance Criteria

1. WHEN el Xlsx_Parser recibe una ruta válida a un archivo `.xlsx`, THE Xlsx_Parser SHALL cargar la hoja especificada y devolver una Cell_Matrix con todos los valores como strings.
2. WHEN el Xlsx_Parser recibe una ruta a un archivo inexistente, THE Xlsx_Parser SHALL retornar un error descriptivo indicando que el archivo no fue encontrado.
3. WHEN el Xlsx_Parser recibe un nombre de hoja que no existe en el archivo, THE Xlsx_Parser SHALL retornar un error descriptivo indicando las hojas disponibles.
4. THE Xlsx_Parser SHALL preservar el valor de celda tal como aparece en la planilla, sin conversiones de tipo automáticas.

---

### Requirement 2: Lectura desde Google Sheets API v4

**User Story:** Como desarrollador, quiero leer la planilla directamente desde Google Sheets usando la API v4, para poder obtener datos actualizados sin necesidad de descargar el archivo manualmente.

#### Acceptance Criteria

1. WHEN el Sheets_API_Client recibe un spreadsheet ID y un nombre de hoja válidos, THE Sheets_API_Client SHALL retornar una Cell_Matrix con los valores de la hoja usando el endpoint `spreadsheets.values.get`.
2. WHEN el Sheets_API_Client recibe credenciales inválidas o expiradas, THE Sheets_API_Client SHALL retornar un error descriptivo indicando el fallo de autenticación.
3. WHEN el Sheets_API_Client recibe un spreadsheet ID inexistente, THE Sheets_API_Client SHALL retornar un error descriptivo indicando que la planilla no fue encontrada.
4. THE Sheets_API_Client SHALL usar acceso de solo lectura (scope `spreadsheets.readonly`) para no modificar la planilla bajo ninguna circunstancia.
5. WHERE se configure una API key pública, THE Sheets_API_Client SHALL autenticarse usando esa key sin requerir OAuth, siempre que la planilla sea pública o esté compartida con acceso de lectura.

---

### Requirement 3: Detección de Week Groups

**User Story:** Como desarrollador, quiero que el Plan_Parser detecte automáticamente los bloques de semana en la planilla, para poder mapear cada ejercicio a sus valores por semana.

#### Acceptance Criteria

1. WHEN el Plan_Parser recibe una Cell_Matrix, THE Plan_Parser SHALL detectar todas las celdas cuyo contenido coincida con el patrón `Semana N` o `Sem N` (donde N es un número) en las primeras 20 filas.
2. WHEN se detecta un Week_Group, THE Plan_Parser SHALL identificar las columnas de campos asociadas (series, reps, carga, RPE) buscando esas etiquetas en las filas inmediatamente siguientes a la etiqueta de semana, dentro de un rango de 8 columnas a la derecha.
3. IF no se detecta ningún Week_Group en la Cell_Matrix, THEN THE Plan_Parser SHALL retornar un error indicando que no se encontró estructura de semanas reconocible.
4. THE Plan_Parser SHALL deduplicar Week_Groups que tengan la misma etiqueta y columna de inicio.
5. WHEN el Plan_Parser detecta que la columna "Series" está ubicada a la izquierda del primer Week_Group y no se repite en cada semana, THE Plan_Parser SHALL mapear esa columna como campo compartido de Series para todos los Week_Groups del bloque, en lugar de requerir una columna de Series por semana.

---

### Requirement 4: Detección de Day Blocks y Exercise Rows

**User Story:** Como desarrollador, quiero que el Plan_Parser detecte los días de entrenamiento y sus ejercicios, para poder estructurar los datos en la forma que necesita la UI.

#### Acceptance Criteria

1. WHEN el Plan_Parser encuentra una fila cuya celda coincide con el patrón `Día N` o `DÍA N` (case-insensitive), THE Plan_Parser SHALL iniciar un nuevo Day_Block con ese nombre y número de fila.
2. WHEN la fila inmediatamente siguiente al nombre del Day_Block contiene texto que no es un código de ejercicio ni una etiqueta de columna, THE Plan_Parser SHALL capturar ese texto como subtítulo opcional del Day_Block (ej: `"• FULLBODY"`).
3. WHEN el Plan_Parser encuentra una fila que no contiene código de ejercicio válido ni nombre de día, THE Plan_Parser SHALL ignorar esa fila sin generar un error, tratándola como Separator_Row u otra fila no estructural.
4. WHEN el Plan_Parser encuentra una Exercise_Row, THE Plan_Parser SHALL detectar si existe una Video_Icon_Cell entre el código y el nombre del ejercicio y, de existir, SHALL capturar la URL del hipervínculo como campo opcional `videoUrl` en la Exercise_Row, ignorando el ícono visual.
5. WHEN el Plan_Parser encuentra una Exercise_Row, THE Plan_Parser SHALL agregar esa fila como Exercise_Row al Day_Block activo.
6. IF una Exercise_Row no tiene Day_Block activo, THEN THE Plan_Parser SHALL ignorar esa fila sin generar un error.
7. THE Plan_Parser SHALL incluir en cada Exercise_Row los valores de series, reps, carga y RPE para cada Week_Group detectado, usando la columna correspondiente de cada campo.
8. THE Plan_Parser SHALL preservar los valores de reps, carga y RPE como strings sin intentar convertirlos a número, para soportar Composite_Values como `"8 x L"`, `"30°"` o `"12.5KxL"`.
9. THE Plan_Parser SHALL incluir el número de fila (1-based) y las columnas de cada campo en la Exercise_Row para habilitar escritura futura.

---

### Requirement 5: Serialización y Round-Trip

**User Story:** Como desarrollador, quiero que los datos parseados puedan serializarse a JSON y volver a parsearse de forma equivalente, para garantizar la integridad de los datos en el pipeline.

#### Acceptance Criteria

1. THE Sheet_Reader SHALL serializar el resultado del Plan_Parser a JSON válido.
2. FOR ALL Cell_Matrix válidas, parsear la Cell_Matrix con el Plan_Parser, serializar el resultado a JSON, y deserializar ese JSON SHALL producir una estructura de datos equivalente a la original (round-trip property).
3. THE Sheet_Reader SHALL exponer una función que reciba una Cell_Matrix y retorne el JSON estructurado con el formato: `{ spreadsheetId, sheetName, weekGroups, days }`.

---

### Requirement 6: Compatibilidad con la estructura existente de Apps Script

**User Story:** Como desarrollador, quiero que el Sheet_Reader produzca un JSON compatible con el formato ya definido en ApiPoc.gs, para que la UI pueda consumir ambas fuentes sin cambios.

#### Acceptance Criteria

1. THE Sheet_Reader SHALL producir un JSON cuya estructura de `weekGroups` y `days` sea equivalente a la producida por `getPlanStructure()` en `ApiPoc.gs`.
2. THE Sheet_Reader SHALL incluir los campos `row`, `code`, `name` y `weeks` en cada Exercise_Row, con la misma semántica que en `ApiPoc.gs`.
3. THE Sheet_Reader SHALL incluir los campos `weekLabel`, `headerRow`, `startColumn` y `fields` en cada Week_Group, con la misma semántica que en `ApiPoc.gs`.
4. IF el Sheet_Reader detecta una estructura que no puede mapear al formato esperado, THEN THE Sheet_Reader SHALL retornar un error descriptivo en lugar de un JSON parcialmente incorrecto.

---

### Requirement 7: Limitaciones conocidas de la API

**User Story:** Como desarrollador, quiero que las limitaciones de la fuente de datos estén documentadas explícitamente, para no intentar implementar funcionalidades que la API no puede proveer.

#### Acceptance Criteria

1. THE Sheet_Reader SHALL documentar que los colores de fondo de las celdas de RPE (verde/amarillo/rojo) no son accesibles mediante el endpoint `spreadsheets.values.get` de la Google Sheets API v4, y por lo tanto quedan fuera del alcance de este componente.
2. WHERE se requiera acceso a colores de celda, THE Sheet_Reader SHALL indicar que es necesario usar el endpoint `spreadsheets.get` con el campo `sheets.data.rowData.values.effectiveFormat.backgroundColor`, lo cual está fuera del scope de esta implementación.
3. THE Sheet_Reader SHALL ignorar cualquier información de formato visual (colores, bordes, íconos renderizados) que no sea accesible como valor de celda, sin generar errores por su ausencia.
