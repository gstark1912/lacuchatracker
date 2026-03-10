<script setup lang="ts">
import { ref } from "vue"
import type { SessionExercise, Session } from "../types"

const props = defineProps<{
    exercise: SessionExercise
    history: Session[]  // sesiones anteriores para progresión
}>()

const emit = defineEmits<{
    update: [fields: Partial<Pick<SessionExercise, "series" | "reps" | "carga" | "rpe">>]
}>()

const showHistory = ref(false)
const editing = ref(false)
const draft = ref({ ...props.exercise })

function saveEdit() {
    emit("update", {
        series: draft.value.series,
        reps: draft.value.reps,
        carga: draft.value.carga,
        rpe: draft.value.rpe,
    })
    editing.value = false
}

function cancelEdit() {
    draft.value = { ...props.exercise }
    editing.value = false
}

// Extraer emoji del RPE para mostrar compacto
function rpeEmoji(rpe: string): string {
    const match = rpe.match(/[\u{1F7E2}\u{1F7E1}\u{1F534}]/u)
    return match ? match[0] : ""
}
</script>

<template>
    <div class="exercise-card">
        <div class="card-header">
            <span class="code">{{ exercise.code }}</span>
            <span class="name">{{ exercise.name }}</span>
            <div class="actions">
                <button class="btn-icon" @click="showHistory = !showHistory" title="Ver progresión">📈</button>
                <button class="btn-icon" @click="editing = !editing" title="Editar">✏️</button>
            </div>
        </div>

        <!-- Vista normal -->
        <div v-if="!editing" class="card-values">
            <div class="value-item" v-if="exercise.series">
                <span class="label">Series</span>
                <span class="val">{{ exercise.series }}</span>
            </div>
            <div class="value-item">
                <span class="label">Reps</span>
                <span class="val">{{ exercise.reps || "—" }}</span>
            </div>
            <div class="value-item" v-if="exercise.carga">
                <span class="label">Carga</span>
                <span class="val">{{ exercise.carga }}</span>
            </div>
            <div class="value-item rpe" v-if="exercise.rpe">
                <span class="rpe-emoji">{{ rpeEmoji(exercise.rpe) }}</span>
                <span class="rpe-text">{{ exercise.rpe.replace(/^\s*[\u{1F7E2}\u{1F7E1}\u{1F534}]\s*-\s*/u, "") }}</span>
            </div>
        </div>

        <!-- Modo edición -->
        <div v-else class="card-edit">
            <label>Series <input v-model="draft.series" /></label>
            <label>Reps <input v-model="draft.reps" /></label>
            <label>Carga <input v-model="draft.carga" /></label>
            <label>RPE <input v-model="draft.rpe" /></label>
            <div class="edit-actions">
                <button class="btn-save" @click="saveEdit">Guardar</button>
                <button class="btn-cancel" @click="cancelEdit">Cancelar</button>
            </div>
        </div>

        <!-- Historial de progresión -->
        <div v-if="showHistory" class="history">
            <div class="history-title">Progresión</div>
            <div
                v-for="session in history"
                :key="session.weekLabel"
                class="history-row"
            >
                <span class="history-week">{{ session.weekLabel }}</span>
                <template v-for="ex in session.exercises.filter(e => e.code === exercise.code)" :key="ex.code">
                    <span>{{ ex.series ? ex.series + "×" : "" }}{{ ex.reps }}</span>
                    <span v-if="ex.carga" class="history-carga">{{ ex.carga }}</span>
                    <span v-if="ex.rpe" class="history-rpe">{{ rpeEmoji(ex.rpe) }}</span>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.exercise-card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 10px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}
.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.code {
    font-weight: 700;
    font-size: 0.75rem;
    background: var(--accent);
    color: #fff;
    border-radius: 6px;
    padding: 2px 7px;
    flex-shrink: 0;
}
.name {
    font-size: 0.9rem;
    font-weight: 600;
    flex: 1;
}
.actions {
    display: flex;
    gap: 4px;
}
.btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px;
}
.card-values {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.value-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--chip-bg);
    border-radius: 8px;
    padding: 4px 10px;
    min-width: 52px;
}
.label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.val {
    font-size: 0.95rem;
    font-weight: 600;
}
.rpe {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 120px;
    justify-content: flex-start;
}
.rpe-emoji { font-size: 1.1rem; }
.rpe-text { font-size: 0.75rem; color: var(--text-muted); }

.card-edit {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.card-edit label {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    color: var(--text-muted);
    gap: 3px;
}
.card-edit input {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 0.9rem;
    background: var(--input-bg);
    color: var(--text);
}
.edit-actions {
    grid-column: span 2;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}
.btn-save {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 16px;
    cursor: pointer;
    font-weight: 600;
}
.btn-cancel {
    background: var(--chip-bg);
    border: none;
    border-radius: 8px;
    padding: 6px 16px;
    cursor: pointer;
}

.history {
    margin-top: 10px;
    border-top: 1px solid var(--border);
    padding-top: 8px;
}
.history-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
    letter-spacing: 0.05em;
}
.history-row {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 0.82rem;
    padding: 3px 0;
}
.history-week {
    font-weight: 600;
    min-width: 80px;
    color: var(--accent);
    font-size: 0.75rem;
}
.history-carga { color: var(--text-muted); }
</style>
