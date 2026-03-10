// ── Tipos espejo del backend (WorkoutPlan) ──────────────────────────────────

export interface WeekFields {
    series?: number
    reps?: number
    carga?: number
    rpe?: number
}

export interface WeekGroup {
    weekLabel: string
    headerRow: number
    startColumn: number
    fields: WeekFields
}

export interface WeekValues {
    weekLabel: string
    values: { series: string; reps: string; carga: string; rpe: string }
    columns: { series: number | null; reps: number | null; carga: number | null; rpe: number | null }
}

export interface ExerciseRow {
    row: number
    code: string
    name: string
    videoUrl?: string
    weeks: WeekValues[]
}

export interface DayBlock {
    name: string
    subtitle?: string
    row: number
    exercises: ExerciseRow[]
}

export interface WorkoutPlan {
    spreadsheetId: string
    sheetName: string
    weekGroups: WeekGroup[]
    days: DayBlock[]
}

// ── AppState (optimizado para UI) ───────────────────────────────────────────

export interface SessionExercise {
    code: string
    name: string
    series: string
    reps: string
    carga: string
    rpe: string
    // metadata para escritura al sheet
    sheetRow: number
    columns: { series: number | null; reps: number | null; carga: number | null; rpe: number | null }
}

export interface Session {
    weekLabel: string
    weekIndex: number   // 0-based, para ordenar/navegar
    dayName: string
    daySubtitle?: string
    exercises: SessionExercise[]
}

// exerciseCode → sesiones ordenadas cronológicamente (para progresión)
export type ProgressionIndex = Record<string, Session[]>

export interface AppState {
    plan: WorkoutPlan
    sessions: Session[]                 // todas, ordenadas weekIndex ASC → dayName ASC
    progression: ProgressionIndex
    currentSessionIndex: number         // índice en sessions[]
}
