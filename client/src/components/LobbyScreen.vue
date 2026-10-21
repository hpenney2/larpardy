<script setup lang="ts">
import { DISCORD_INVITE, type DiscordUsers } from "@/shared";
import DiscordAvatar from "./DiscordAvatar.vue";
import TitleHeader from "./TitleHeader.vue";
import { auth, auth as discordAuth, discordSdk } from "@/discord.ts";
import { socket, gameState } from "@/socket.ts";
import ToggleSwitch from "./ToggleSwitch.vue";
import { computed, ref, watch, watchEffect } from "vue";
import HoverTooltip from "./HoverTooltip.vue";
import BoardSelectionMenu from "./BoardSelectionMenu.vue";
import { Common as SDKCommon } from "@discord/embedded-app-sdk";
import type { UserPartial } from "@larpardy/shared/userBoards";

defineProps<{
  users?: DiscordUsers;
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

const isHost = computed(() => discordAuth.user.id === gameState.state?.host);

function sendSettings() {
  if (isHost.value) {
    socket.emit("updateSettings", gameState.state!.settings);
  }
}

const isTransferringHost = ref(false);
watchEffect(() => {
  if (!isHost.value) isTransferringHost.value = false;
});

const boardMenuOpen = ref(false);

watchEffect(() => {
  if (!boardMenuOpen.value) {
    discordSdk.commands.setOrientationLockState({
      lock_state: SDKCommon.OrientationLockStateTypeObject.PORTRAIT,
      picture_in_picture_lock_state: SDKCommon.OrientationLockStateTypeObject.PORTRAIT,
      grid_lock_state: SDKCommon.OrientationLockStateTypeObject.PORTRAIT,
    });
  }
});

discordSdk.commands.setOrientationLockState({
  lock_state: SDKCommon.OrientationLockStateTypeObject.UNLOCKED,
  picture_in_picture_lock_state: SDKCommon.OrientationLockStateTypeObject.UNLOCKED,
  grid_lock_state: SDKCommon.OrientationLockStateTypeObject.UNLOCKED,
});

// pull down user data
async function pullUserData() {
  const response = await fetch("/api/users/me", {
    method: "GET",
    headers: {
      Authorization: auth.access_token,
    },
  });

  if (response.ok) {
    const data: UserPartial = await response.json();
    gameState.isAdmin = data.admin;
    gameState.isRestricted = data.restricted;
  }
}

watch(
  boardMenuOpen,
  async () => {
    await pullUserData();
  },
  { immediate: true },
);
</script>
<template>
  <TitleHeader></TitleHeader>
  <!-- TODO: add host transfer -->
  <div class="lobbyScreen">
    <h2>Lobby</h2>
    <h3>Waiting to start...</h3>
    <div class="players">
      <div
        v-for="user in users?.participants"
        :key="user.id"
        :class="{
          playerReady: gameState.state?.readyForNextState.includes(user.id),
          transferHint:
            isTransferringHost &&
            gameState.state?.host !== user.id &&
            gameState.state?.players.includes(user.id),
        }"
        @click="if (isTransferringHost) socket.emit('changeHost', user.id);"
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
        <p v-if="user.id === gameState.state?.host" class="hostTag">(host)</p>
      </div>
    </div>
    <div class="buttons">
      <button type="button" @click="ready" class="button">
        {{ gameState.state?.readyForNextState.includes(discordAuth.user.id) ? "Unready" : "Ready" }}
      </button>
      <button
        id="startButton"
        class="button"
        :disabled="!gameState.state?.isReadyForNext"
        type="button"
        @click="startGame"
        v-if="isHost"
      >
        START!
      </button>
    </div>
    <div class="settings">
      <h3>Settings</h3>

      <ToggleSwitch
        v-model="gameState.state!.settings.isHostless"
        :disabled="!isHost"
        @update:model-value="sendSettings"
        >Hostless Mode<HoverTooltip
          title="Allows the game host to play, but only one person can buzz in per question."
        ></HoverTooltip
      ></ToggleSwitch>

      <button
        class="button"
        @click="isTransferringHost = !isTransferringHost"
        v-if="isHost && (isTransferringHost || (gameState.state?.players.length ?? 0) > 1)"
        :class="{ highlighted: isTransferringHost }"
      >
        {{ isTransferringHost ? "Cancel Host Transfer" : "Transfer Host" }}
      </button>

      <hr />

      <div>
        <!-- <p>Gamemode: Standard / Random</p> -->
        <button class="button" @click="boardMenuOpen = !boardMenuOpen">Custom Boards</button>
        <p v-if="gameState.state?.customId">
          Selected:
          <br />
          <cite>{{ gameState.state.customTitle }}</cite>
          <br />
          by <cite>@{{ gameState.state.customAuthor }}</cite>
        </p>
        <button
          class="button"
          v-if="gameState.state?.customId && isHost"
          @click="socket.emit('resetBoard')"
        >
          Reset
        </button>
        <BoardSelectionMenu v-model="boardMenuOpen"></BoardSelectionMenu>
      </div>
    </div>
    <div class="discord">
      <span>Join our server!</span>
      <button type="button" @click="discordSdk.commands.openExternalLink({ url: DISCORD_INVITE })">
        <v-icon name="bi-discord" scale="2.5"></v-icon>
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

  padding-top: 1em;
  padding-bottom: 2em;
}

.lobbyScreen * {
  margin-left: auto;
  margin-right: auto;
}

.players {
  display: flex;
  flex-wrap: wrap;
  background-color: #000000aa;
  border: solid 0.6em black;

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

.hostTag {
  font-size: smaller;
  color: #ddd;
  margin: 1em 0;
}

.transferHint {
  border: 2px yellow dashed;
  background-color: rgba(255, 255, 0, 50%);
  padding-left: 1em;
  padding-right: 1em;

  cursor: pointer;
}

.buttons {
  display: flex;
  margin: 1em;
  gap: 1em;
}

#startButton {
  border: solid 4px var(--color-accent);
}

.settings * {
  margin-left: 0;
  margin-right: 0;
}

.settings > * + * {
  margin-top: 1em;
}

.discord {
  position: absolute;
  right: 1em;
  bottom: 1em;

  display: flex;
  align-items: center;
  gap: 0.5em;
  color: white;
}

.discord * {
  text-box-trim: trim-both;
  text-box-edge: cap alphabetic;
}

/* fixes button height being weird
  thanks https://stackoverflow.com/a/67305216 ! */
.discord svg {
  display: block;
}

.discord > button {
  background: none;
  border: none;
  color: inherit;

  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.discord > button:hover {
  color: var(--discord-blurple);
  transform: scale(1.2);
  cursor: pointer;
}
</style>
