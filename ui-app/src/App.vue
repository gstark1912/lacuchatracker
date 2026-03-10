<script setup lang="ts">
import { onMounted } from "vue"
import { useWorkoutStore } from "./store"
import SessionView from "./components/SessionView.vue"

const store = useWorkoutStore()
onMounted(() => store.loadPlan())
</script>

<template>
    <div class="app">
        <header class="app-header">
            <span class="logo">💪 GymTracker</span>
        </header>

        <main>
            <div v-if="store.loading" class="state-msg">Cargando plan...</div>
            <div v-else-if="store.error" class="state-msg error">
                Error: {{ store.error }}
                <button @click="store.loadPlan()">Reintentar</button>
            </div>
            <SessionView v-else-if="store.appState" />
        </main>
    </div>
</template>

<style>
:root {
    --bg: #f5f5f7;
    --card-bg: #ffffff;
    --chip-bg: #f0f0f3;
    --input-bg: #f8f8fa;
    --accent: #5b5ef4;
    --text: #1a1a2e;
    --text-muted: #888;
    --border: #e0e0e8;
}

@media (prefers-color-scheme: dark) {
    :root {
        --bg: #0f0f14;
        --card-bg: #1c1c26;
        --chip-bg: #26263a;
        --input-bg: #1a1a28;
        --accent: #7b7ef8;
        --text: #f0f0f5;
        --text-muted: #888;
        --border: #2e2e42;
    }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100dvh;
}

.app-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--card-bg);
    position: sticky;
    top: 0;
    z-index: 20;
}
.logo { font-weight: 700; font-size: 1rem; }

.state-msg {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
}
.state-msg.error { color: #e05; }
.state-msg button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 20px;
    cursor: pointer;
}
</style>
