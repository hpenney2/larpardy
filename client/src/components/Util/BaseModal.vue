<script setup lang="ts"></script>

<template>
  <div class="modal"><slot></slot></div>
</template>

<style scoped>
.modal {
  position: fixed;
  width: 100dvw;
  height: 100dvh;
  inset: 0;
  backdrop-filter: brightness(20%);
  z-index: 1000;

  text-align: center;
  align-content: center;
}
</style>
