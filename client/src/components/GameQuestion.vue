<script setup lang="ts">
import { StateType, type BoardClue } from "@larpardy/shared/state";
import BuzzerButton from "./BuzzerButton.vue";
import DiscordAvatar from "./DiscordAvatar.vue";
import { gameState } from "@/socket.ts";
import type { DiscordUsers } from "@/shared.ts";
import { computed } from "vue";
import { useTimestamp } from "@vueuse/core";
import QuestionHostControls from "./QuestionHostControls.vue";
import { auth } from "@/discord.ts";

const { users } = defineProps<{
  clue: BoardClue;
  users: DiscordUsers;
  usersTalking: Set<string>;
}>();

const now = useTimestamp();

const buzzedPlayer = computed(() =>
  users.participants.find((x) => x.id === gameState.state?.buzzedPlayer),
);

const buzzedInAgo = computed(() => {
  if (gameState.state?.buzzedInAt)
    return now.value - gameState.state.buzzedInAt - gameState.timeOffset;
});
</script>

<template>
  <div class="question">
    <p class="questionText">{{ clue.question }}</p>
    <Transition name="answer-reveal">
      <div v-if="clue.answer">
        <hr />
        <p class="questionText">{{ clue.answer }}</p>
      </div>
    </Transition>
    <BuzzerButton
      v-if="
        (gameState.state?.settings.isHostless || gameState.state?.host !== auth.user.id) &&
        !clue.answered
      "
    ></BuzzerButton>
    <div
      class="buzzedData"
      v-if="gameState.state?.state === StateType.BuzzedIn && buzzedPlayer && buzzedInAgo"
    >
      <h3>BUZZED</h3>
      <p>
        <DiscordAvatar
          :user="buzzedPlayer"
          :speaking="usersTalking.has(buzzedPlayer.id)"
          :size="64"
          class="avatar"
        ></DiscordAvatar>
        {{ buzzedPlayer.nickname ?? buzzedPlayer.global_name }}
      </p>
      <time :class="{ timeWarning: buzzedInAgo && buzzedInAgo >= 5000 }"
        >{{
          Math.floor(buzzedInAgo / 60000)
            .toString()
            .padStart(2, "0")
        }}:{{
          Math.floor((buzzedInAgo % 60000) / 1000)
            .toString()
            .padStart(2, "0")
        }}
      </time>
    </div>
    <QuestionHostControls :clue></QuestionHostControls>
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

.question hr {
  width: 90vw;
  margin: 0;
  color: white;
}

.answer-reveal-enter-from {
  opacity: 0;
}

.answer-reveal-enter-active {
  transition: opacity 1s ease;
}

.buzzedData {
  background-color: rgb(from var(--color-accent3) r g b / 0.5);
  border-radius: 5%;

  min-width: 10em;
  margin-top: 2em;
  padding: 1em;
}

.avatar:deep(img) {
  width: 2vw;
}

.avatar {
  display: inline-block;
  vertical-align: middle;
}

p:has(.avatar) {
  text-transform: none;
}

time.timeWarning {
  color: red;
}
</style>
