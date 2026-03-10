import { defineStore } from "pinia"
import { ref, computed } from "vue"
import type { AppState, Session } from "./types"
import { buildAppState } from "./appState"
import type { WorkoutPlan } from "./types"

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

    function updateExercise(
        sessionIndex: number,
        exerciseCode: string,
        fields: Partial<{ series: string; reps: string; carga: string; rpe: string }>
    ) {
        if (!appState.value) return
        const session = appState.value.sessions[sessionIndex]
        const ex = session?.exercises.find((e) => e.code === exerciseCode)
        if (!ex) return
        Object.assign(ex, fields)
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
