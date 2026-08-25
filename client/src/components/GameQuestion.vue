<script setup lang="ts">
import { type BoardClue } from "@larpardy/shared/state";
import BuzzerButton from "./BuzzerButton.vue";

defineProps<{ clue: BoardClue }>();
</script>

<template>
  <div class="question">
    <p class="questionText">{{ clue.question }}</p>
    <BuzzerButton></BuzzerButton>
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
</style>
