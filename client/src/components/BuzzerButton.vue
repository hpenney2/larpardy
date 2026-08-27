<script setup lang="ts">
import { auth } from "@/discord";
import { gameState, socket } from "@/socket";
import { BUZZ_DELAY, StateType } from "@larpardy/shared/state";
import { useTimestamp } from "@vueuse/core";
import { computed, onUnmounted, ref } from "vue";

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

const buzzed = ref(false);
function buzz() {
  if (canBuzzIn.value <= 0 && gameState.state?.state !== StateType.BuzzedIn) {
    socket.emit("buzz");
    buzzed.value = true;
  }
  console.log("buzzed!");
}
</script>

<template>
  <div
    class="buzzerWrapper"
    :style="{
      '--progress': (1 - canBuzzIn / BUZZ_DELAY) * 100 + '%',
    }"
    :class="{
      buzzed:
        gameState.state?.buzzedPlayer === auth.user.id &&
        gameState.state?.state === StateType.BuzzedIn,
    }"
  >
    <button
      id="buzzer"
      class="button"
      @mousedown="buzz"
      :disabled="
        canBuzzIn > 0 ||
        gameState.state?.state === StateType.BuzzedIn ||
        gameState.state?.alreadyBuzzed?.includes(auth.user.id)
      "
    >
      <template
        v-if="
          gameState.state?.state === StateType.BuzzedIn &&
          gameState.state?.buzzedPlayer === auth.user.id
        "
      >
        BUZZED IN!
        <br />
        <span class="hint">Say your answer!</span>
      </template>
      <template v-else-if="gameState.state?.alreadyBuzzed?.includes(auth.user.id)">
        Already buzzed
        <br />
        <span class="hint">You were incorrect.</span>
      </template>
      <template v-else>
        BUZZ
        <br />
        <span class="keybind-hint hint">(space)</span>
      </template>
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

.buzzed > #buzzer {
  opacity: 1;
  background-color: var(--color-accent3);
  border: none;
  outline: 5px solid var(--color-accent2);
  animation: outline-pulse 2s linear alternate infinite;
}

@keyframes outline-pulse {
  0% {
    outline-width: 0px;
  }
  100% {
    outline-width: 8px;
  }
}

.buzzerWrapper {
  position: relative;
  isolation: isolate;
}

/* https://stackoverflow.com/a/74099159 */
.buzzerWrapper:not(.buzzed)::after {
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

.hint {
  font-size: 0.8em;
  opacity: 0.75;
  font-family: monospace;
}

.keybind-hint {
  display: none;
}

/* assume if the user has a mouse, they probably have a keyboad too */
@media (hover: hover) and (pointer: fine) {
  .keybind-hint {
    display: unset;
  }
}
</style>
