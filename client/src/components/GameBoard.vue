<script setup lang="ts">
import { gameState, socket } from "@/socket";
import { StateType } from "@larpardy/shared/state";
import { computed, ref, useTemplateRef, watch, watchEffect } from "vue";
import IntroAnimation from "./IntroAnimation.vue";
import { auth, discordSdk } from "@/discord.ts";
import { Common as SDKCommon } from "@discord/embedded-app-sdk";
import PlayerListGame from "./PlayerListGame.vue";
import type { DiscordUsers } from "@/shared.ts";
import GameQuestion from "./GameQuestion.vue";

defineProps<{
  users?: DiscordUsers;
  usersTalking: Set<string>;
}>();

// game is started; lock to landscape mode
discordSdk.commands.setOrientationLockState({
  lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
  picture_in_picture_lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
  grid_lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
});

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

// play sound effect when it's time to select a clue again
const playerUpAudio = new Audio("/audio/playerUp.mp3");
watch(
  () => gameState.state?.state,
  (state, oldState) => {
    if (state === StateType.SelectClue && state !== oldState) {
      playerUpAudio.currentTime = 0;
      playerUpAudio.play();
    }
  },
  { immediate: true },
);

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
    }, 1500);
    onCleanup(() => clearInterval(timeout));
  } else if (gameState.state != null && gameState.state.state > StateType.GameStartShowCategories) {
    revealed.value = gameState.state.board.length;
  }
});

// const clueRefs = useTemplateRef("clue");
// const questionRef = useTemplateRef("questionRef");
const ourTurn = computed(
  () =>
    gameState.state?.state === StateType.SelectClue &&
    gameState.state?.activePlayer === auth.user.id,
);
function selectClue(cat?: number, clue?: number) {
  if (
    cat != null &&
    clue != null &&
    ourTurn.value &&
    gameState.state?.currentlyAnsweringCategory == null &&
    gameState.state?.currentlyAnsweringClue == null
  ) {
    socket.emit("selectClue", cat, clue);
  }
}
</script>

<template>
  <div id="board" ref="board" :class="{ ourTurn }">
    <div
      v-for="(category, idx) in gameState.state?.board"
      ref="categories"
      class="category"
      :class="{
        selected: gameState.state?.currentlyAnsweringCategory == idx,
        revealed: revealed > idx,
      }"
      :key="idx + category.name"
    >
      <h2>{{ category.name }}</h2>
    </div>
    <template v-for="clue in gameState.state?.board[0]?.clues.length">
      <div
        :key="clue + category.name"
        v-for="(category, idx) in gameState.state?.board"
        class="clue"
        :class="{
          selected:
            gameState.state?.currentlyAnsweringCategory == idx &&
            gameState.state?.currentlyAnsweringClue == clue - 1,
        }"
      >
        <button
          type="button"
          class="clueButton"
          @click="selectClue(idx, clue - 1)"
          :class="{ answered: category.clues[clue - 1]?.revealed }"
        >
          ${{ category.clues[clue - 1]?.value }}
        </button>
      </div>
    </template>
    <Transition name="questionAnim">
      <GameQuestion
        v-if="
          gameState.state?.state === StateType.AnsweringClue &&
          gameState.state.currentlyAnsweringCategory != null &&
          gameState.state.currentlyAnsweringClue != null
        "
        :clue="
          gameState.state.board[gameState.state.currentlyAnsweringCategory]?.clues[
            gameState.state.currentlyAnsweringClue
          ]!
        "
        class="question"
      ></GameQuestion>
    </Transition>
  </div>
  <div class="userBox">
    <PlayerListGame
      :users="users"
      :usersTalking="usersTalking"
      :activePlayer="
        gameState.state?.state === StateType.SelectClue ? gameState.state?.activePlayer : undefined
      "
    ></PlayerListGame>
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
  height: 90%;
  width: 100%;
  box-sizing: border-box;

  position: relative;
  top: 0;

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

  align-content: center;
  border: var(--10px-vh) solid black;
  outline: var(--10px-vh) solid black;
  background: none;

  transition: background 0.1s ease;

  /* overflow: hidden; */
  position: relative;
}

.clue > .answered {
  opacity: 0;
  pointer-events: none;
}

.clueButton {
  background: none;
  align-content: center;
  color: var(--color-primary);
  font-size: 7vh;
  font-weight: bold;
  text-shadow: 5px 7px 0 black;
  border: none;
  width: 100%;
  height: 100%;

  transition: background 0.1s ease;
}

.ourTurn:not(:has(.selected)) .clueButton:hover {
  background-color: var(--color-accent3);
  cursor: pointer;
}

.selected {
  background-color: var(--color-accent) !important;
}

.category > * {
  padding: 0;
  /* margin: 0.5em; */
  margin: 0 0.5em;
}

.userBox {
  --10px-vh: 0.67364563545vh;

  /* display: flex;
  flex-wrap: nowrap; */
  background-color: #000000aa;
  height: 10%;
  border-top: var(--10px-vh) solid black;

  /* border: solid 0.6em black; */

  position: relative;
  bottom: 0;
}

.question {
  position: absolute;
  top: 0;
  left: 0;
  /* z-index: 1; */

  width: 100%;
  height: 100%;

  /* transition: scale 1s linear; */
  /* scale: 0.5; */

  /* transform: translateX(var(--translate-x)) translateY(var(--translate-y)); */
}

.questionAnim-enter-from,
.questionAnim-leave-to {
  opacity: 0;
  scale: 0;
}

.questionAnim-enter-active,
.questionAnim-leave-active {
  transition:
    opacity 0.5s ease-in-out,
    scale 1s linear;
}
</style>
