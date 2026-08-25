<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <div class="tooltip" :title="title" @click.prevent>
    <v-icon name="bi-question-circle-fill"></v-icon>
  </div>
</template>

<style scoped>
.tooltip {
  cursor: help;
  margin: 0 0.5em !important;
  color: white;
  display: inline;
}

/* https://stackoverflow.com/a/60660207 */
@media (pointer: coarse) {
  .tooltip {
    position: relative;
    display: inline-flex;
    justify-content: center;
  }
  .tooltip:hover::after {
    content: attr(title);
    position: absolute;
    top: 90%;
    color: #000;
    background-color: #fff;
    border: 1px solid;
    width: fit-content;
    padding: 3px;
    font-size: 0.75em;
  }
}
</style>
