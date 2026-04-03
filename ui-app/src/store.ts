import { defineStore } from "pinia"
import { ref, computed } from "vue"
import type { AppState, Session } from "./types"
import { buildAppState } from "./appState"
import type { WorkoutPlan } from "./types"

function showToast(message: string, duration = 5000) {
    const existing = document.getElementById("gym-toast")
    if (existing) existing.remove()

    const el = document.createElement("div")
    el.id = "gym-toast"
    el.textContent = message
    Object.assign(el.style, {
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#e05",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "10px",
        fontSize: "0.85rem",
        fontWeight: "600",
        zIndex: "9999",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        maxWidth: "90vw",
        textAlign: "center",
    })
    document.body.appendChild(el)
    setTimeout(() => el.remove(), duration)
}

export const useWorkoutStore = defineStore("workout", () => {
    const appState = ref<AppState | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function loadPlan() {
        loading.value = true
        error.value = null
        try {
            const res = await fetch("/api/plan")
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const plan: WorkoutPlan = await res.json()
            appState.value = buildAppState(plan)
        } catch (e) {
            error.value = e instanceof Error ? e.message : String(e)
        } finally {
            loading.value = false
        }
    }

    const currentSession = computed<Session | null>(() => {
        if (!appState.value) return null
        return appState.value.sessions[appState.value.currentSessionIndex] ?? null
    })

    const totalSessions = computed(() => appState.value?.sessions.length ?? 0)

    function navigate(delta: number) {
        if (!appState.value) return
        const next = appState.value.currentSessionIndex + delta
        if (next >= 0 && next < appState.value.sessions.length) {
            appState.value.currentSessionIndex = next
        }
    }

    function goToSession(index: number) {
        if (!appState.value) return
        if (index >= 0 && index < appState.value.sessions.length) {
            appState.value.currentSessionIndex = index
        }
    }

    function getProgression(exerciseCode: string): Session[] {
        return appState.value?.progression[exerciseCode] ?? []
    }

    async function updateExercise(
        sessionIndex: number,
        exerciseCode: string,
        fields: Partial<{ series: string; reps: string; carga: string; rpe: string }>
    ) {
        if (!appState.value) return
        const session = appState.value.sessions[sessionIndex]
        const ex = session?.exercises.find((e) => e.code === exerciseCode)
        if (!ex) return

        // Optimistic update
        Object.assign(ex, fields)

        // Write each changed field to the sheet
        const colMap: Record<string, number | null> = {
            series: ex.columns.series,
            reps: ex.columns.reps,
            carga: ex.columns.carga,
            rpe: ex.columns.rpe,
        }

        const results = await Promise.all(
            Object.entries(fields)
                .filter(([key, val]) => val !== undefined && colMap[key] != null)
                .map(([key, val]) =>
                    fetch("/api/plan/cell", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ row: ex.sheetRow, column: colMap[key], value: val }),
                    })
                )
        )

        const failed = results.find((r) => !r.ok)
        if (failed) {
            showToast(`Error al guardar (${failed.status}). Puede que haya que renovar el token.`)
        }
    }

    return {
        appState,
        loading,
        error,
        currentSession,
        totalSessions,
        loadPlan,
        navigate,
        goToSession,
        getProgression,
        updateExercise,
    }
})
