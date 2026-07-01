<script setup lang="ts">
import { computed } from "vue";

const { err } = defineProps<{ err: unknown }>();
const isServerProblem = computed(() => err instanceof Error && err.cause instanceof Response);
</script>

<template>
  <div id="__auth-failure-error">
    <h1>Auth failed.</h1>
    <p>If you declined an authorization prompt, please accept it.</p>
    <p class="errorText">{{ err }}</p>
    <p v-if="isServerProblem">This is likely a temporary issue. Please try again later!</p>
  </div>
</template>

<style scoped>
:global(body:has(#__auth-failure-error)) {
  background-color: black;
}

div {
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: x-large;
}

.errorText {
  font-size: smaller;
}
</style>
