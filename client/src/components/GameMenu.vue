<script setup lang="ts">
import { auth } from "@/discord";
import { gameState, socket } from "@/socket";
import { ref } from "vue";

const inMenu = ref(false);

function returnToLobby() {
  if (gameState.state?.host === auth.user.id) {
    socket.emit("returnToLobby");
  }
}
</script>

<template>
  <button class="button menuButton" @click="inMenu = !inMenu">
    <v-icon name="gi-hamburger-menu"></v-icon>
  </button>
  <div id="gameMenu" v-if="inMenu">
    <section role="menu">
      <h2>Menu</h2>
      <button class="button closeButton" @click="inMenu = false">
        <v-icon name="bi-x-lg" />
      </button>
      <button class="button" @click="returnToLobby">Return to Lobby / End Game</button>
    </section>
  </div>
</template>

<style scoped>
.menuButton {
  position: absolute;
  left: 0;
  bottom: 0;
  margin: 4px;
  padding: 0.25em;
  border-radius: 50%;
}

.closeButton {
  position: absolute;
  right: 0;
  top: 0;
  margin: 0.5em;
  padding: 0.25em;
  border-radius: 50%;
}

#gameMenu {
  position: fixed;
  width: 100dvw;
  height: 100dvh;
  inset: 0;
  backdrop-filter: brightness(20%);
  /* z-index: 1000; */

  text-align: center;
  align-content: center;
}

#gameMenu > section {
  background-color: black;
  padding: 2em;
  /* border: 0.5em solid var(--color-accent2); */
  border-radius: 25px;
  min-width: 20vw;
  width: fit-content;
  margin: auto;
  position: relative;
}
</style>
