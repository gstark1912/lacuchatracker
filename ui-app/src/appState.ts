import type { WorkoutPlan, Session, SessionExercise, ProgressionIndex, AppState } from "./types"

/**
 * Transforma un WorkoutPlan (estructura del parser) en AppState (optimizado para UI).
 * Genera la lista plana de sesiones y el índice de progresión por ejercicio.
 */
export function buildAppState(plan: WorkoutPlan): AppState {
    const sessions: Session[] = []

    // Construir sesiones: por cada semana × día
    for (let weekIndex = 0; weekIndex < plan.weekGroups.length; weekIndex++) {
        const weekGroup = plan.weekGroups[weekIndex]
        if (!weekGroup) continue
        const { weekLabel } = weekGroup

        for (const day of plan.days) {
            const exercises: SessionExercise[] = day.exercises.map((ex) => {
                const weekData = ex.weeks.find((w) => w.weekLabel === weekLabel)
                return {
                    code: ex.code,
                    name: ex.name,
                    series: weekData?.values.series ?? "",
                    reps: weekData?.values.reps ?? "",
                    carga: weekData?.values.carga ?? "",
                    rpe: weekData?.values.rpe ?? "",
                    sheetRow: ex.row,
                    columns: weekData?.columns ?? { series: null, reps: null, carga: null, rpe: null },
                }
            })

            sessions.push({
                weekLabel,
                weekIndex,
                dayName: day.name,
                daySubtitle: day.subtitle,
                exercises,
            })
        }
    }

    // Índice de progresión: code → sesiones en orden cronológico
    const progression: ProgressionIndex = {}
    for (const session of sessions) {
        for (const ex of session.exercises) {
            if (!progression[ex.code]) progression[ex.code] = []
            progression[ex.code]!.push(session)
        }
    }

    // Sesión inicial: primera sesión donde ningún ejercicio tiene RPE cargado
    // (= próximo día a trabajar). Si todas están completas, arranca en la primera.
    const nextIndex = sessions.findIndex(
        (s) => s.exercises.every((ex) => ex.rpe.trim() === "")
    )
    const currentSessionIndex = nextIndex !== -1 ? nextIndex : 0

    return { plan, sessions, progression, currentSessionIndex }
}
