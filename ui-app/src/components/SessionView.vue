<script setup lang="ts">
import { computed } from "vue"
import { useWorkoutStore } from "../store"
import ExerciseCard from "./ExerciseCard.vue"

const store = useWorkoutStore()

const session = computed(() => store.currentSession)
const idx = computed(() => store.appState?.currentSessionIndex ?? 0)
const total = computed(() => store.totalSessions)

// Sesiones del mismo día en semanas anteriores (para progresión)
function historyFor(exerciseCode: string) {
    return store.getProgression(exerciseCode).filter(
        (s) => s.weekIndex < (session.value?.weekIndex ?? 0) && s.dayName === session.value?.dayName
    )
}

function onUpdate(
    code: string,
    fields: Partial<{ series: string; reps: string; carga: string; rpe: string }>
) {
    store.updateExercise(idx.value, code, fields)
}
</script>

<template>
    <div class="session-view" v-if="session">
        <!-- Header de navegación -->
        <div class="nav-bar">
            <button class="nav-btn" :disabled="idx === 0" @click="store.navigate(-1)">‹</button>
            <div class="nav-info">
                <div class="week-label">{{ session.weekLabel }}</div>
                <div class="day-label">{{ session.dayName }} <span class="subtitle">{{ session.daySubtitle }}</span></div>
            </div>
            <button class="nav-btn" :disabled="idx === total - 1" @click="store.navigate(1)">›</button>
        </div>

        <!-- Dots de progreso -->
        <div class="dots">
            <span
                v-for="(s, i) in store.appState?.sessions"
                :key="i"
                class="dot"
                :class="{ active: i === idx, 'same-day': s.dayName === session.dayName }"
                @click="store.goToSession(i)"
            />
        </div>

        <!-- Lista de ejercicios -->
        <div class="exercises">
            <ExerciseCard
                v-for="ex in session.exercises"
                :key="ex.code"
                :exercise="ex"
                :history="historyFor(ex.code)"
                @update="(fields) => onUpdate(ex.code, fields)"
            />
        </div>
    </div>
</template>

<style scoped>
.session-view {
    max-width: 480px;
    margin: 0 auto;
    padding: 0 12px 80px;
}
.nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0 8px;
    position: sticky;
    top: 0;
    background: var(--bg);
    z-index: 10;
}
.nav-btn {
    background: var(--chip-bg);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 1.4rem;
    cursor: pointer;
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
}
.nav-btn:disabled { opacity: 0.25; cursor: default; }
.nav-info { text-align: center; }
.week-label {
    font-size: 0.75rem;
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}
.day-label {
    font-size: 1.1rem;
    font-weight: 700;
}
.subtitle { font-size: 0.8rem; color: var(--text-muted); font-weight: 400; }

.dots {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    padding: 8px 0 14px;
}
.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
}
.dot.same-day { background: color-mix(in srgb, var(--accent) 35%, var(--border)); }
.dot.active { background: var(--accent); transform: scale(1.4); }

.exercises { padding-top: 4px; }
</style>
