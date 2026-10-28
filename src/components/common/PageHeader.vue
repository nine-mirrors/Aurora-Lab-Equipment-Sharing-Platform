<script setup>
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  eyebrow: { type: String, default: '' }
})
</script>

<template>
  <div class="page-heading">
    <div class="heading-main">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
      <slot name="meta" />
    </div>

    <div v-if="$slots.actions" class="heading-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.heading-main {
  min-width: 0;
}

.heading-main .eyebrow {
  margin-bottom: 10px;
}

.heading-main h1 {
  margin: 0 0 5px;
  font-size: 27px;
  line-height: 1.25;
  letter-spacing: -0.028em;
  font-weight: 700;
  color: var(--text-1);
}

.heading-main p {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-3);
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .heading-main h1 {
    font-size: 22px;
  }
}
</style>
