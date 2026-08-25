<script setup lang="ts">
import type { BoardClue } from "@larpardy/shared/state";
import { onUnmounted } from "vue";

defineProps<{ clue: BoardClue }>();

function onHotkey(event: KeyboardEvent) {
  if (event.key === " ") {
    buzz();
  }
}
window.addEventListener("keydown", onHotkey);
onUnmounted(() => window.removeEventListener("keydown", onHotkey));

function buzz() {}
</script>

<template>
  <div class="question">
    <p class="questionText">{{ clue.question }}</p>
    <button id="buzzer" class="button">
      BUZZ
      <br />
      <span class="keybind-hint">(space)</span>
    </button>
  </div>
</template>

<style scoped>
.question {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 1em;

  background-color: var(--color-bg);

  /* transition: transform 1s linear; */
  /* transform: rotate(0) translate(-50%, -50%); */
  /* transform: translate(-50%, -50%) scaleX(calc(100vw / 100%)) scaleY(calc(100vh / 100%)); */
  /* translate: -50% -50%; */
}

.questionText {
  text-transform: uppercase;
  font-size: 3vw;
}

#buzzer {
  font-size: 1.5em;
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
