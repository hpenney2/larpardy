<script setup lang="ts">
import type { GameBoard } from "@larpardy/shared/state";
import { useTemplateRef, watchEffect } from "vue";

const boardRef = useTemplateRef("boardRef");

const { board } = defineProps<{ board: GameBoard }>();

watchEffect(() => {
  boardRef.value?.style.setProperty("--columns", board.length.toString());
});
</script>

<template>
  <article id="board" ref="boardRef">
    <div
      v-for="(category, idx) in board"
      ref="categories"
      class="category"
      :key="idx + category.name"
    >
      <h5>{{ category.name }}</h5>
    </div>
    <template v-for="clue in board[0]?.clues.length">
      <div :key="clue + category.name" v-for="category in board" class="clue">
        <button
          type="button"
          class="clueButton"
          :class="{ answered: category.clues[clue - 1]?.revealed }"
        >
          <span class="value">${{ category.clues[clue - 1]?.value }}</span>
          <span class="question">{{ category.clues[clue - 1]?.question }}</span>
        </button>
      </div>
    </template>
  </article>
</template>

<style scoped>
#board {
  display: grid;
  grid-template-columns: repeat(var(--columns, 5), minmax(min-content, 1fr));
  grid-auto-rows: 1fr;
  /* grid-template-rows: repeat(auto-fit, minmax(min-content, 1fr)); */
  text-align: center;
  text-transform: uppercase;
  /* height: 100%; */
  /* width: 100%; */
  box-sizing: border-box;

  position: relative;
  /* bottom: 0; */

  user-select: none;
  overflow-wrap: break-word;
  word-break: break-word;

  margin: 1.5em;
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

  width: 100%;
  /* height: 100%; */

  transition: background 0.1s ease;
}

.category h5 {
  margin: 0;
}

.clue {
  --10px-vh: 0.67364563545vh;

  align-content: center;
  border: var(--10px-vh) solid black;
  outline: var(--10px-vh) solid black;
  background: none;

  width: 100%;

  transition: background 0.1s ease;

  /* overflow: hidden; */
  position: relative;
}

.clueButton {
  background: none;
  align-content: center;
  color: var(--color-primary);
  font-size: 2vh;
  font-weight: bold;
  text-shadow: 5px 7px 0 black;
  border: none;
  width: 100%;
  height: 100%;
  padding: 0;

  transition: background 0.1s ease;
}

.clueButton > .value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  transition: opacity 0.25s linear;
}

.clueButton > .question {
  font-size: 0.55vw;
  opacity: 0;

  display: block;

  transition: opacity 0.25s linear;
}

.clueButton:hover {
  > .question {
    opacity: 1;
  }

  > .value {
    opacity: 0;
  }
}
</style>
