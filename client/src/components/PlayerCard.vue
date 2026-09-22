<script setup lang="ts">
import type { DiscordUser } from "@/shared";
import DiscordAvatar from "./DiscordAvatar.vue";

const { points = 0 } = defineProps<{
  user: DiscordUser;
  speaking?: boolean;
  loading?: boolean;
  points?: number;
  active?: boolean;
  host?: boolean;
}>();
</script>

<template>
  <div class="playerCard" :class="{ active }">
    <p class="username">
      {{ user.nickname ?? user.global_name }}
    </p>
    <DiscordAvatar
      :user="user"
      :speaking="speaking"
      :size="128"
      :loading="loading"
      class="avatar"
    ></DiscordAvatar>
    <p :class="{ badMoney: points < 0 }">
      {{ points >= 0 ? "" : "-" }}${{ (points >= 0 ? points : -points).toLocaleString() }}
    </p>
    <p class="hostNotice" v-if="host">(host)</p>
  </div>
</template>

<style scoped>
.username {
  font-weight: bold;
}

.playerCard {
  display: flex;
  gap: 1em;
  align-items: center;
  justify-content: center;
  background-color: #000000aa;
  padding: 1.5vh;
  border-radius: 10px;

  position: relative;

  font-size: 1.5vh;

  transition: transform 0.1s linear;
}

.playerCard.active {
  background-color: var(--color-accent);
  transform: scale(1.05);
}

@keyframes playerUp {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-1vh);
  }
  100% {
    transform: translateY(0);
  }
}

.avatar:deep(img) {
  width: 3.5vh;
}

.badMoney {
  color: red;
}

.hostNotice {
  position: absolute;
  opacity: 50%;
  bottom: -7.5%;
  /* left: 0; */
  font-size: 0.75em;
}
</style>
