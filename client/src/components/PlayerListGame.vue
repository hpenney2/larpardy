<script setup lang="ts">
import type { DiscordUsers } from "@/shared";
import PlayerCard from "./PlayerCard.vue";
import { gameState } from "@/socket.ts";

defineProps<{ users?: DiscordUsers; usersTalking: Set<string>; activePlayer?: string }>();
</script>

<template>
  <div class="playerList">
    <template v-for="user in users?.participants" :key="user.id">
      <PlayerCard
        :user="user"
        :speaking="usersTalking.has(user.id)"
        :active="activePlayer === user.id"
        :points="gameState.state?.score[user.id]"
        v-if="
          gameState.state?.players.includes(user.id) &&
          (gameState.state.settings.isHostless || user.id !== gameState.state.host)
        "
      ></PlayerCard>
    </template>
  </div>
</template>

<style scoped>
.playerList {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  gap: 1em;
}
</style>
