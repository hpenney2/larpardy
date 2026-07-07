<script setup lang="ts"></script>

<template>
  <div class="waitModal"></div>
</template>

<style scoped>
.waitModal::after {
  content: "...";
  position: fixed;
  width: 100dvw;
  height: 100dvh;
  inset: 0;
  backdrop-filter: brightness(20%);
  z-index: 1000;

  text-align: center;
  align-content: center;

  font-size: 2vw;
  animation: wait 3s linear infinite;
  user-select: none;
}
</style>
