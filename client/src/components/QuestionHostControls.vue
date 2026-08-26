<script setup lang="ts">
import { auth } from "@/discord";
import { gameState, socket } from "@/socket";
import { StateType, type BoardClue } from "@larpardy/shared/state";

defineProps<{ clue: BoardClue }>();

function correctAnswer() {
  socket.emit("correctAnswer");
}

function incorrectAnswer() {
  socket.emit("incorrectAnswer");
}

function revealAnswerHostless() {
  socket.emit("revealAnswerHostless");
}

function giveUp() {
  socket.emit("giveUp");
}
</script>

<template>
  <div
    class="hostControls"
    v-if="
      gameState.state?.state === StateType.BuzzedIn &&
      gameState.state.buzzedPlayer &&
      gameState.state?.host === auth.user.id &&
      (!clue.answered || gameState.state.settings.isHostless) &&
      (clue.answered || !gameState.state.settings.isHostless)
    "
  >
    <button class="button hostButton correct" @click="correctAnswer">
      <v-icon name="bi-check-lg" />
      <br />
      CORRECT
    </button>
    <button class="button hostButton incorrect" @click="incorrectAnswer">
      <v-icon name="bi-x-lg" />
      <br />
      INCORRECT
      <br />
      (or took too long)
    </button>
  </div>
  <div
    class="hostControls"
    v-else-if="
      gameState.state?.state === StateType.BuzzedIn &&
      gameState.state.buzzedPlayer &&
      gameState.state?.host === auth.user.id &&
      gameState.state?.settings.isHostless
    "
  >
    <button class="button hostButton giveUp" @click="revealAnswerHostless">REVEAL ANSWER</button>
  </div>
  <div
    class="hostControls"
    v-else-if="
      gameState.state?.host === auth.user.id && gameState.state?.state !== StateType.BuzzedIn
    "
  >
    <button class="button hostButton giveUp" @click="giveUp">
      <v-icon name="bi-x-lg" /> NOBODY GOT IT
    </button>
  </div>
</template>

<style scoped>
.hostControls {
  display: flex;
  flex-wrap: nowrap;
  flex-direction: row;
  gap: 1em;
}

.hostButton {
  background-color: rgb(from var(--color-accent3) r g b / 0.5);
  border-radius: 5%;

  min-width: 12.5em;
  margin-top: 2em;
  padding: 1em;
  font-family: monospace;

  color: black;
}

.correct {
  background-color: #4bf048;
}

.incorrect {
  background-color: #ff4b4b;
}

.giveUp {
  background-color: #333;
  color: white;
}
</style>
