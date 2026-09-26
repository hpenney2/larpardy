<script setup lang="ts">
import { Common as SDKCommon } from "@discord/embedded-app-sdk";
import { discordSdk } from "@/discord";
import { gameState, socket } from "@/socket";
import { computed, ref, useTemplateRef, watchEffect } from "vue";
import type { BoardClue, GameBoard } from "@larpardy/shared/state";
import BoardEditorQuestion from "./BoardEditorQuestion.vue";
import BoardEditorFinish from "./BoardEditorFinish.vue";

function leaveEditor() {
  gameState.state = null; // clear leftover state
  socket.connect();
  gameState.inEditor = false;
}

// board mode; lock to landscape mode
discordSdk.commands.setOrientationLockState({
  lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
  picture_in_picture_lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
  grid_lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
});

const board = useTemplateRef("board");

const columns = ref(6);
const rows = ref(5);

const selectedCol = ref<number | undefined>();
const selectedRow = ref<number | undefined>();

const finishing = ref(false);

const boardData = ref<GameBoard>([]);

// fill missing columns
watchEffect(() => {
  if (boardData.value.length < columns.value) {
    const need = columns.value - boardData.value.length;

    for (let i = 1; i <= need; i++) {
      const clues: BoardClue[] = [];
      for (let r = 1; r <= rows.value; r++) {
        const value = boardData.value[0]?.clues[r]?.value ?? r * 200;
        clues.push({ answered: false, revealed: false, value: value, question: "", answer: "" });
      }

      boardData.value.push({ name: "", clues });
    }
  }
});

// fill missing rows (clues)
watchEffect(() => {
  if (boardData.value[0] && boardData.value[0].clues.length < rows.value) {
    for (const category of boardData.value) {
      for (let i = category.clues.length; i <= rows.value; i++) {
        const value = boardData.value[0]?.clues[i]?.value ?? i * 200;
        category.clues.push({
          answered: false,
          revealed: false,
          value: value,
          question: "",
          answer: "",
        });
      }
    }
  }
});

// the value fields just update the first column; if one of those change, update all of them!
// we also resort the rows
watchEffect(() => {
  for (let i = 1; i < boardData.value.length; i++) {
    const category = boardData.value[i];
    if (category) {
      for (const [n, clue] of category.clues.entries()) {
        clue.value = boardData.value[0]?.clues[n]?.value ?? n * 200;
      }
    }
  }

  for (const category of boardData.value) {
    category.clues = category.clues.sort((a, b) => a.value - b.value);
  }
});

// function validateBoard() {}
const limitedBoard = computed(() =>
  boardData.value.slice(0, columns.value).map((category) => {
    return { ...category, clues: category.clues.slice(0, rows.value) };
  }),
);

const isBoardValid = computed(() => {
  for (const category of limitedBoard.value) {
    console.log(category.name.trim(), category.name.trim() === "");
    if (category.name.trim() === "") return false;

    for (const clue of category.clues) {
      console.log(clue, clue.question?.trim() === "", clue.answer?.trim() === "", clue.value < 0);
      if (clue.question?.trim() === "" || clue.answer?.trim() === "" || clue.value < 0)
        return false;
    }
  }

  return true;
});

function clampNumber(num: number, min?: number, max?: number) {
  if (max != null && num > max) num = max;
  else if (min != null && num < min) num = min;

  return num;
}

function clampInputInt(event: InputEvent, min?: number, max?: number): number {
  const field = event.target as HTMLInputElement;

  event.preventDefault();

  let newValue: number;
  if (field.value.trim() !== "" && Number.isInteger(+field.value)) {
    newValue = clampNumber(parseInt(field.value), min, max);
  } else {
    newValue = min ?? 0;
  }
  field.value = newValue.toString();

  return newValue;
}

// function onValueChanged(event: InputEvent, row: number) {
//   const newValue = clampInputInt(event, 0, 999999999);

//   const clue = boardData.value[0]?.clues[row];
//   console.log(clue, row, boardData.value[0], boardData.value[0]?.clues);
//   if (clue != null) {
//     clue.value = newValue;
//   }
// }

function onValueChanged(event: InputEvent) {
  clampInputInt(event, 0, 999999999);
}

function onColumnsChanged(event: InputEvent) {
  columns.value = clampInputInt(event, 1, 12);
}

function onRowsChanged(event: InputEvent) {
  rows.value = clampInputInt(event, 1, 10);
}

function onlyNumberKeypress(event: KeyboardEvent) {
  if (!Number.isInteger(+event.key)) {
    event.preventDefault();
  }
}

function onEditDone(question: string, answer: string) {
  if (selectedCol.value != null && selectedRow.value != null) {
    // the clue MUST exist, otherwise we couldn't have selected it in the first place!
    const clue = boardData.value[selectedCol.value]!.clues[selectedRow.value]!;
    clue.question = question;
    clue.answer = answer;
  }

  selectedCol.value = undefined;
  selectedRow.value = undefined;
}

function swapWithRight(column: number) {
  // prettier-ignore
  if (boardData.value[column] && boardData.value[column + 1]) {
    [boardData.value[column], boardData.value[column + 1]] = [boardData.value[column + 1]!, boardData.value[column]]
  }
}

watchEffect(() => {
  board.value?.style.setProperty("--columns", columns.value.toString());
});
</script>

<template>
  <section class="detailsBar">
    <h2 class="editorHeader">Board Editor</h2>
    <!-- <button class="button" @click="leaveEditor()">Rejoin</button> -->
    <div class="leftBar">
      <label>
        Columns
        <input
          type="number"
          :value="columns"
          @keypress="onlyNumberKeypress"
          @input="onColumnsChanged"
        />
      </label>
      <label>
        Rows
        <input type="number" :value="rows" @keypress="onlyNumberKeypress" @input="onRowsChanged" />
      </label>
    </div>
    <div class="rightBar">
      <button class="button" @click="leaveEditor()">Rejoin</button
      ><button
        class="button"
        @click="finishing = !finishing"
        style="border-color: var(--color-positive)"
      >
        Finish
      </button>
    </div>
  </section>
  <div id="board" ref="board">
    <!-- blank space -->
    <div></div>

    <template v-for="idx in boardData.length" :key="idx + boardData[idx - 1]!.name">
      <div ref="categories" class="category" v-if="idx <= columns">
        <textarea
          type="text"
          placeholder="Category Name"
          :value="boardData[idx - 1]!.name"
          @change="boardData[idx - 1]!.name = ($event.target as HTMLInputElement).value"
        />
        <button
          class="swap"
          aria-label="Swap category"
          v-if="idx < columns"
          @click="swapWithRight(idx - 1)"
        >
          <v-icon name="bi-arrow-left-right" scale="1.5"></v-icon>
        </button>
      </div>
    </template>

    <template v-for="i in rows" :key="i">
      <div class="value">
        $
        <input
          type="number"
          :placeholder="(i * 200).toString()"
          min="0"
          :value="boardData[0]?.clues[i - 1]?.value"
          @keypress="onlyNumberKeypress"
          @input="onValueChanged"
          @change="
            if (boardData[0]?.clues[i - 1] != null)
              boardData[0]!.clues[i - 1]!.value = Number(($event.target as HTMLInputElement).value);
          "
        />
      </div>
      <template v-for="(category, idx) in boardData" :key="i + ':' + category.name">
        <div class="clue" v-if="idx < columns">
          <button
            type="button"
            class="clueButton"
            :class="{
              placeholder: !category.clues[i - 1]?.question,
              selected: selectedCol === idx && selectedRow === i - 1,
            }"
            @click="
              selectedCol = idx;
              selectedRow = i - 1;
            "
          >
            {{ category.clues[i - 1]?.question || "$" + category.clues[i - 1]?.value }}
          </button>
        </div>
      </template>
    </template>
  </div>

  <BoardEditorQuestion
    v-if="selectedCol != null && selectedRow != null"
    :question="boardData[selectedCol]?.clues[selectedRow]?.question"
    :answer="boardData[selectedCol]?.clues[selectedRow]?.answer"
    @done="onEditDone"
    @cancel="
      selectedCol = undefined;
      selectedRow = undefined;
    "
  ></BoardEditorQuestion>
  <BoardEditorFinish
    v-if="finishing"
    :valid="isBoardValid"
    @return="finishing = false"
  ></BoardEditorFinish>
</template>

<style scoped>
/* much of this styling is taken from GameBoard;
   is there a way to reduce the repetition?
   (do we WANT that? e.g. we may NOT want changes to affect both, actually) */

#board {
  display: grid;
  grid-template-columns: auto repeat(var(--columns, 5), minmax(min-content, 1fr));
  grid-auto-rows: 1fr;
  /* grid-template-rows: repeat(auto-fit, minmax(min-content, 1fr)); */
  text-align: center;
  text-transform: uppercase;
  height: 93%;
  width: 100%;
  box-sizing: border-box;

  position: relative;
  bottom: 0;

  user-select: none;
  overflow-wrap: break-word;
  word-break: break-word;
}

.detailsBar {
  --15px-vh: 1.01046845317vh;

  background-color: #000000aa;
  border-bottom: var(--15px-vh) solid black;

  height: 7%;
  top: 0;
  position: relative;

  display: flex;
  flex-direction: row;
  gap: 25vw;
  justify-content: space-evenly;
  align-items: center;
}

.detailsBar input {
  font-size: inherit;
  max-width: 5em;
}

.leftBar,
.rightBar {
  font-size: 1.5vh;
}

.leftBar {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 0.5vh;
  align-items: flex-end;

  /* position: relative;
  max-width: 30%; */
}

.leftBar > * {
  width: fit-content;
}

.rightBar {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 0.5vh;
}

.button {
  font-size: min(2rem, 1.5vh);
}

.editorHeader {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;

  font-size: 1.5vh;
}

.selected {
  background-color: var(--color-accent) !important;
}

.category {
  --10px-vh: 0.67364563545vh;
  --15px-vh: 1.01046845317vh;

  position: relative;
  border: solid black;
  border-width: var(--15px-vh) var(--10px-vh);
  /* outline: var(--10px-vh) solid black; */
  align-content: center;
  font-size: 2vh;

  transition: background 0.1s ease;
}

.category > textarea {
  font-size: 1.5em;
  text-align: center;
  background: none;
  border: none;

  color: inherit;
  font-weight: bold;
  width: 100%;
  height: 100%;
  margin: 0;

  resize: none;
}

.swap {
  --10px-vh: 0.67364563545vh;

  position: absolute;
  z-index: 1;
  background-color: black;
  color: white;
  border: none;
  right: 0;
  bottom: 50%;

  transform: translate(calc(var(--10px-vh) * 3), 50%);

  width: 3vh;
  height: 3vh;

  font-size: 0;

  cursor: pointer;
}

.swap > * {
  width: 100%;
  height: 100%;
}

.clue {
  --10px-vh: 0.67364563545vh;

  align-content: center;
  border: var(--10px-vh) solid black;
  /* outline: var(--10px-vh) solid black; */
  background: none;

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

  /* no effect? :( */
  /* overflow: auto;
  min-height: 0; */

  transition: background 0.1s ease;
}

.clueButton.placeholder {
  opacity: 50%;
}

.clueButton:hover {
  background-color: var(--color-accent3);
  cursor: pointer;
}

.category > * {
  padding: 0;
  /* margin: 0.5em; */
  /* margin: 0 0.5em; */
}

.value {
  display: flex;

  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 0.25vw;

  /* container-type: inline-size; */
  max-width: 5vw;
}

.value > input {
  field-sizing: content;
  min-width: 3em;
  font-size: 1.5vh;
}
</style>
