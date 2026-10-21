<script setup lang="ts">
import BaseModal from "./BaseModal.vue";

defineEmits<{ yes: []; no: [] }>();
</script>

<template>
  <BaseModal>
    <div class="confirmPrompt">
      <p style="flex-basis: 100%">
        <slot></slot>
      </p>
      <button class="button confirm positive" @click="$emit('yes')">Yes</button>
      <button class="button confirm negative" @click="$emit('no')">No</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.confirmPrompt {
  background-color: var(--color-bg);
  padding: 2em;
  padding-top: 2.5em;

  /* border: 0.5em solid var(--color-accent2); */
  border-radius: 25px;
  display: inline-block;
  /* width: 100em; */
  max-width: 100vw;
  width: fit-content;
  /* box-sizing: content-box; */

  margin: auto !important;
  position: relative;

  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1em;
}

.confirm {
  border-radius: 15px;
  color: black;
  flex: 1;
}

.positive {
  background-color: var(--color-positive);
}

.negative {
  background-color: var(--color-negative);
}
</style>
