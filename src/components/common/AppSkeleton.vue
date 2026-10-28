<script setup>
defineProps({
  type: { type: String, default: 'card' }, // card | stat | list | table | chart | text
  rows: { type: Number, default: 4 },
  height: { type: String, default: '100%' }
})
</script>

<template>
  <div class="app-skeleton" :class="`type-${type}`" :style="{ height }">
    <template v-if="type === 'stat'">
      <div class="sk-row">
        <span class="sk sk-icon"></span>
        <div class="sk-lines">
          <span class="sk sk-line w-40"></span>
          <span class="sk sk-line w-70 tall"></span>
          <span class="sk sk-line w-55"></span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'list'">
      <div v-for="i in rows" :key="i" class="sk-row padded">
        <span class="sk sk-avatar"></span>
        <div class="sk-lines">
          <span class="sk sk-line w-60"></span>
          <span class="sk sk-line w-40 thin"></span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'table'">
      <div class="sk-table">
        <span class="sk sk-line head"></span>
        <div v-for="i in rows" :key="i" class="sk-table-row">
          <span class="sk sk-line w-30"></span>
          <span class="sk sk-line w-20"></span>
          <span class="sk sk-line w-25"></span>
          <span class="sk sk-line w-15"></span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'chart'">
      <div class="sk-chart">
        <span v-for="i in 7" :key="i" class="sk sk-bar" :style="{ height: `${28 + ((i * 17) % 58)}%` }"></span>
      </div>
    </template>

    <template v-else-if="type === 'text'">
      <div class="sk-lines">
        <span v-for="i in rows" :key="i" class="sk sk-line" :style="{ width: `${92 - i * 9}%` }"></span>
      </div>
    </template>

    <template v-else>
      <div class="sk-card">
        <span class="sk sk-thumb"></span>
        <span class="sk sk-line w-70"></span>
        <span class="sk sk-line w-90 thin"></span>
        <span class="sk sk-line w-50 thin"></span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.app-skeleton {
  width: 100%;
}

.sk {
  display: block;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-1) 7%, var(--bg-subtle));
}

.sk::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--bg-elevated) 70%, transparent) 46%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: skeleton-sweep 1.5s var(--ease-in-out) infinite;
}

@keyframes skeleton-sweep {
  to {
    transform: translateX(100%);
  }
}

.sk-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sk-row.padded {
  padding: 10px 0;
}

.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.sk-line {
  height: 11px;
  border-radius: 999px;
}

.sk-line.tall {
  height: 20px;
}

.sk-line.thin {
  height: 8px;
}

.sk-line.head {
  height: 30px;
  border-radius: 10px;
  margin-bottom: 12px;
}

.sk-icon {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  flex: none;
}

.sk-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  flex: none;
}

.sk-thumb {
  height: 46px;
  width: 46px;
  border-radius: 12px;
  margin-bottom: 12px;
}

.w-15 { width: 15%; }
.w-20 { width: 20%; }
.w-25 { width: 25%; }
.w-30 { width: 30%; }
.w-40 { width: 40%; }
.w-50 { width: 50%; }
.w-55 { width: 55%; }
.w-60 { width: 60%; }
.w-70 { width: 70%; }
.w-90 { width: 90%; }

.sk-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-solid);
}

.sk-table-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
}

.sk-chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 100%;
  min-height: 160px;
  padding: 10px 0;
}

.sk-bar {
  flex: 1;
  border-radius: 8px 8px 4px 4px;
}

.type-chart {
  height: 100%;
}
</style>
