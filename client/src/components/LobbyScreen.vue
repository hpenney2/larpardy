<script setup lang="ts">
import { type DiscordUsers } from "@/shared";
import DiscordAvatar from "./DiscordAvatar.vue";
import TitleHeader from "./TitleHeader.vue";
import { auth as discordAuth } from "@/discord.ts";
import { socket, gameState } from "@/socket.ts";

defineProps<{
  users: DiscordUsers | null | undefined;
  usersTalking: Set<string>;
}>();

function ready() {
  if (gameState.state?.readyForNextState.includes(discordAuth.user.id)) {
    socket.volatile.emit("unreadyForNext");
  } else {
    socket.volatile.emit("readyForNext", gameState.state!.state);
  }
}

function startGame() {
  if (gameState.state?.isReadyForNext) {
    socket.emit("startGame");
  }
}
</script>
<template>
  <TitleHeader></TitleHeader>

  <div class="lobbyScreen">
    <h2>Lobby</h2>
    <h3>Waiting to start...</h3>
    <div class="players">
      <div
        v-for="user in users?.participants"
        :key="user.id"
        :class="{ playerReady: gameState.state?.readyForNextState.includes(user.id) }"
      >
        <p>
          {{ user.nickname ?? user.global_name }}
        </p>
        <DiscordAvatar
          :user="user"
          :speaking="usersTalking.has(user.id)"
          :size="64"
          class="avatar"
          :class="{ loading: !gameState.state?.players.includes(user.id) }"
        ></DiscordAvatar>
      </div>
    </div>
    <div class="buttons">
      <button @click="ready">
        {{ gameState.state?.readyForNextState.includes(discordAuth.user.id) ? "Unready" : "Ready" }}
      </button>
      <button
        id="startButton"
        :disabled="!gameState.state?.isReadyForNext"
        type="button"
        @click="startGame"
      >
        START!
      </button>
    </div>
  </div>
</template>
<style scoped>
.lobbyScreen {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.lobbyScreen * {
  margin-left: auto;
  margin-right: auto;
}

.players {
  display: flex;
  flex-wrap: wrap;
  background-color: #000000aa;
  border: solid 10px black;

  padding: 1em;
  gap: 2em;

  max-width: 50%;
}

.playerReady {
  color: var(--color-primary);
  font-weight: bold;
}

.playerReady .avatar::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  inset: 0;
  animation: flashAccent 1s ease-out forwards;
  /* mix-blend-mode: lighten; */
  pointer-events: none;
  /* background-color: rgb(from var(--color-accent) r g b / 1); */
}

@keyframes flashAccent {
  from {
    background-color: rgb(from var(--color-accent) r g b / 0.75);
  }

  to {
    background-color: rgb(from var(--color-accent) r g b / 0);
  }
}

.buttons {
  display: flex;
  margin: 1em;
  gap: 1em;
}

#startButton {
  border: solid 4px var(--color-accent);
}
</style>
