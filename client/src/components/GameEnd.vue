<script setup lang="ts">
import type { DiscordUsers } from "@/shared";
import { gameState } from "@/socket";
import PlayerCard from "./PlayerCard.vue";
import { auth } from "@/discord.ts";
import { computed } from "vue";

const { users } = defineProps<{
  users?: DiscordUsers;
  usersTalking: Set<string>;
}>();

const sortedPlayers = computed(() =>
  users?.participants
    .slice()
    .sort((a, b) => (gameState.state?.score[b.id] ?? 0) - (gameState.state?.score[a.id] ?? 0)),
);

const gameEndAudio = new Audio("/audio/gameEnd.mp3");
gameEndAudio.volume = 0.2;
gameEndAudio.play();

function returnToLobby() {
  if (gameState.state?.host === auth.user.id) {
  }
}
</script>

<template>
  <div class="gameEnd">
    <h2>GAME OVER!</h2>
    <section class="leaderboard">
      <h2>Leaderboard</h2>
      <div class="playerList">
        <template v-for="(user, i) in sortedPlayers" :key="user.id">
          <PlayerCard
            :user="user"
            :speaking="usersTalking.has(user.id)"
            :points="gameState.state?.score[user.id]"
            :active="i === 0"
            v-if="
              gameState.state?.players.includes(user.id) &&
              (gameState.state.settings.isHostless || user.id !== gameState.state.host)
            "
          ></PlayerCard>
        </template>
      </div>
      <button
        type="button"
        class="button"
        :disabled="gameState.state?.host !== auth.user.id"
        @click="returnToLobby"
      >
        Back to Lobby
      </button>
    </section>
  </div>
</template>

<style scoped>
.gameEnd {
  background-color: var(--color-bg);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  overflow-y: auto;

  padding: 2em;
}

.gameEnd > h2 {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2vw;

  animation: hide 1s ease-out 3s forwards;
}

@keyframes hide {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.leaderboard {
  text-align: center;

  display: flex;
  flex-direction: column;
  /* flex-wrap: nowrap; */
  /* justify-content: center; */
  align-items: center;
  min-height: 100%;

  gap: 1.5em;

  opacity: 0;

  animation: hide 1s ease-out 4s reverse forwards;
}

.leaderboard > :first-child {
  margin-top: auto;
}

.leaderboard > :last-child {
  margin-bottom: auto;
}

.leaderboard > h2 {
  /* font-size: 0.8vw; */
  margin: 0;
}

.playerList {
  display: flex;
  flex-direction: column;
  /* flex-wrap: nowrap; */
  /* justify-content: center; */
  /* align-items: center; */
  gap: 1em;
}
</style>
