<script setup lang="ts">
import { gameState } from "@/socket";
import { BUZZ_DELAY } from "@larpardy/shared/state";
import { useTimestamp } from "@vueuse/core";
import { computed, onUnmounted } from "vue";

const now = useTimestamp();
const canBuzzIn = computed(
  () => (gameState.state?.canBuzzInAt ?? 0) - gameState.timeOffset - now.value,
);

function onHotkey(event: KeyboardEvent) {
  if (event.key === " ") {
    event.preventDefault();
    buzz();
  }
}

window.addEventListener("keydown", onHotkey);
onUnmounted(() => window.removeEventListener("keydown", onHotkey));

function buzz() {
  console.log("buzz :3");
}
</script>

<template>
  <div
    class="buzzerWrapper"
    :style="{
      '--progress': (1 - canBuzzIn / BUZZ_DELAY) * 100 + '%',
    }"
  >
    <button id="buzzer" class="button" @mousedown="buzz" :disabled="canBuzzIn > 0">
      BUZZ
      <br />
      <span class="keybind-hint">(space)</span>
    </button>
  </div>
</template>

<style scoped>
#buzzer {
  font-size: 1.5em;
  border: none;
  border-radius: 10px;
  /* box-shadow: black 0 5px; */
  /* background-color: black; */
  min-width: 10em;

  border: 2px solid white;
}

#buzzer:disabled {
  border: 1px dashed #ddd;
}

.buzzerWrapper {
  position: relative;
  isolation: isolate;
}

/* https://stackoverflow.com/a/74099159 */
.buzzerWrapper::after {
  content: "";
  display: block;
  position: absolute;
  inset: calc(5px * -1);
  background-color: transparent;
  background-image: conic-gradient(
    var(--color-accent3),
    var(--color-accent3) var(--progress),
    transparent var(--progress)
  );
  z-index: -100;
  border-radius: 10px;
}

.keybind-hint {
  font-size: 0.8em;
  opacity: 0.75;
  font-family: monospace;
  display: none;
}

/* assume if the user has a mouse, they probably have a keyboad too */
@media (hover: hover) and (pointer: fine) {
  .keybind-hint {
    display: unset;
  }
}
</style>
