<script setup lang="ts">
import { gameState, socket } from "@/socket";
import { StateType } from "@larpardy/shared/state";
import { ref, useTemplateRef, watchEffect } from "vue";
import IntroAnimation from "./IntroAnimation.vue";

const board = useTemplateRef("board");
watchEffect(() => {
  board.value?.style.setProperty("--columns", gameState.state!.board.length.toString());
});

watchEffect(() => {
  if (gameState.state == null) return;

  for (const category of gameState.state?.board) {
    category.clues.sort((a, b) => a.value - b.value);
  }
});

const categoryRefs = useTemplateRef("categories");
const revealed = ref(0);
watchEffect((onCleanup) => {
  if (
    gameState.state != null &&
    gameState.state.state === StateType.GameStartShowCategories &&
    categoryRefs.value &&
    revealed.value <= categoryRefs.value.length
  ) {
    const timeout = setInterval(() => {
      const next = categoryRefs.value?.[revealed.value];
      if (next) {
        revealed.value++;
      } else {
        socket.emit("readyForNext", StateType.GameStartShowCategories);
        clearInterval(timeout);
      }
    }, 2000);
    onCleanup(() => clearInterval(timeout));
  } else if (gameState.state != null && gameState.state.state > StateType.GameStartShowCategories) {
    revealed.value = gameState.state.board.length;
  }
});
</script>

<template>
  <div id="board" ref="board">
    <div
      v-for="(category, idx) in gameState.state?.board"
      ref="categories"
      class="category"
      :class="{
        selected: gameState.state?.currentlyAnswering?.[0] == idx,
        revealed: revealed > idx,
      }"
      :key="idx + category.name"
    >
      <h2>{{ category.name }}</h2>
    </div>
    <template v-for="clue in gameState.state?.board[0]?.clues.length">
      <button
        v-for="category in gameState.state?.board"
        type="button"
        class="clue"
        :key="clue + category.name"
        :class="{
          selected: gameState.state?.currentlyAnswering?.[1] == category.clues[clue - 1]?.value,
        }"
      >
        <p>${{ category.clues[clue - 1]?.value }}</p>
      </button>
    </template>
  </div>
  <Transition name="intro">
    <IntroAnimation
      v-if="gameState.state?.state === StateType.GameStartIntro"
      @introDone="socket.emit('readyForNext', StateType.GameStartIntro)"
    ></IntroAnimation>
  </Transition>
</template>

<style scoped>
.intro-enter-active,
.intro-leave-active {
  transition: opacity 0.5s ease;
}

.intro-enter-from {
  opacity: 1;
}

.intro-leave-to {
  opacity: 0;
}

#board {
  display: grid;
  grid-template-columns: repeat(var(--columns, 5), minmax(min-content, 1fr));
  grid-auto-rows: 1fr;
  /* grid-template-rows: repeat(auto-fit, minmax(min-content, 1fr)); */
  text-align: center;
  text-transform: uppercase;
  height: 100%;
  width: 100%;
  box-sizing: border-box;

  user-select: none;
  overflow-wrap: break-word;
  word-break: break-word;
}

.category {
  --10px-vh: 0.67364563545vh;
  --15px-vh: 1.01046845317vh;

  position: relative;
  border: solid black;
  border-width: var(--15px-vh) var(--10px-vh);
  outline: var(--10px-vh) solid black;
  align-content: center;
  font-size: 2vh;

  transition: background 0.1s ease;
}

.category::before {
  content: "";
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-image: url("../assets/img/banner.png");
  background-size: cover;
  background-position: center;
  z-index: -1;

  transition: opacity 0.5s ease;
}

.category.revealed::before {
  opacity: 0;
}

.category > h2 {
  opacity: 0;
  transition: opacity 0.5s ease;
}

.category.revealed > h2 {
  opacity: 1;
}

.clue {
  --10px-vh: 0.67364563545vh;

  border: var(--10px-vh) solid black;
  outline: var(--10px-vh) solid black;
  align-content: center;
  color: var(--color-primary);
  font-size: 7vh;
  font-weight: bold;
  text-shadow: 5px 7px 0 black;
  background: none;

  transition: background 0.1s ease;
  cursor: pointer;
}

.clue:hover {
  background-color: var(--color-accent3);
}

.clue .selected {
  background-color: var(--color-accent) !important;
}

.clue > *,
.category > * {
  padding: 0;
  /* margin: 0.5em; */
  margin: 0 0.5em;
}
</style>
