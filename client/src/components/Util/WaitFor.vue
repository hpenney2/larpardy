<script setup lang="ts">
defineProps<{ value: unknown; error?: unknown }>();
</script>

<template>
  <slot name="error" v-if="error"></slot>
  <div class="waitFor" v-else-if="!value"></div>
  <slot v-else></slot>
</template>

<style scoped>
.waitFor {
  margin: 0.5em;
}

.waitFor::after {
  content: "...";

  text-align: center;
  align-content: center;

  /* font-size: 2vw; */
  animation: wait 3s linear infinite;
  user-select: none;
}
</style>
