<script setup lang="ts">
import { gameState, socket } from "@/socket";
import { ref } from "vue";

const menuOpen = defineModel<boolean>();

const searchText = defineModel("search", { default: "" });

const showingDisconnectWarning = ref(false);
function enterEditor() {
  console.log("disconnecting and entering board editor");
  showingDisconnectWarning.value = false;
  socket.disconnect();
  gameState.inEditor = true;
}
</script>

<template>
  <div id="boardMenu" v-if="menuOpen">
    <section role="menu" aria-label="Board Select">
      <button class="button closeButton" @click="menuOpen = !menuOpen" aria-label="Close">
        <v-icon name="bi-x-lg" />
      </button>
      <div class="boardBar" v-if="!showingDisconnectWarning">
        <button class="button" :disabled="!searchText">
          <v-icon name="bi-search" />
        </button>
        <input type="text" class="search" placeholder="Search" v-model="searchText" />
        <button class="button" @click="showingDisconnectWarning = true">
          <span style="color: var(--color-accent); font-size: x-large; vertical-align: middle"
            >+</span
          >&nbsp;Create
        </button>
      </div>
      <div class="boardBar" v-else>
        <p class="disconnectWarning">
          Opening the board editor will disconnect you from this lobby. Continue?
        </p>
        <button class="button confirm positive" @click="enterEditor()">Yes</button>
        <button class="button confirm negative" @click="showingDisconnectWarning = false">
          No
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.closeButton {
  position: absolute;
  right: 0;
  top: 0;
  margin: 0.5em !important;
  padding: 0.25em;
  border-radius: 50%;
}

#boardMenu {
  position: fixed;
  width: 100dvw;
  height: 100dvh;
  inset: 0;
  backdrop-filter: brightness(20%);
  z-index: 1000;

  text-align: center;
  align-content: center;
}

#boardMenu > section {
  background-color: var(--color-bg);
  padding: 2em;
  padding-top: 2.5em;

  /* border: 0.5em solid var(--color-accent2); */
  border-radius: 25px;
  display: inline-block;
  /* width: 100em; */
  max-width: 100vw;
  width: fit-content;
  /* box-sizing: content-box; */

  margin: auto;
  position: relative;
}

.boardBar {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-content: center;
  gap: 1em;
}

.search {
  background-color: #000000aa;
  color: white;
  border: 2px solid white;
  border-radius: 15px;

  padding: 0.5em;
  font-size: large;

  flex: 1;
}

.disconnectWarning {
  background-color: #000000;
  color: white;
  border: 2px solid white;
  border-radius: 10px;
  padding: 1em;
  margin: 0;
}

.confirm {
  border-radius: 15px;
  color: black;
  flex: 1;
}

.positive {
  background-color: var(--color-positive);
}

.negative {
  background-color: var(--color-negative);
}
</style>
