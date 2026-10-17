<script setup lang="ts">
import { gameState, socket } from "@/socket";
import { ref, watch, watchEffect } from "vue";
import BoardSelectList from "./BoardSelectList.vue";
import { auth, discordSdk } from "@/discord.ts";
import { Common as SDKCommon } from "@discord/embedded-app-sdk";
import type { SearchBoardPartial } from "@larpardy/shared/userBoards";
import WaitFor from "./Util/WaitFor.vue";

const menuOpen = defineModel<boolean>();

const searchText = defineModel("search", { default: "" });

const showingDisconnectWarning = ref(false);
function enterEditor() {
  console.log("disconnecting and entering board editor");
  showingDisconnectWarning.value = false;
  socket.disconnect();
  gameState.inEditor = true;
}

const sortMethod = ref("plays");

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    resetPages();
    search(searchText.value, sortMethod.value);
  }
}

watchEffect(() => {
  if (menuOpen.value) {
    discordSdk.commands.setOrientationLockState({
      lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
      picture_in_picture_lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
      grid_lock_state: SDKCommon.OrientationLockStateTypeObject.LANDSCAPE,
    });
  }
});

const cursorPages = ref<string[]>([]);
const pageIndex = ref(0);

function resetPages() {
  cursorPages.value = [""];
  pageIndex.value = 0;
}

const searchResults = ref<SearchBoardPartial[] | null>(null);
const searchError = ref<string | null>(null);
async function search(query: string, sort: string, goingBack: boolean = false, cursor?: string) {
  const parameters = new URLSearchParams({ query, sort, cursor: cursor ?? "" }).toString();

  if (cursor == null) {
    resetPages();
  }

  searchResults.value = null;
  searchError.value = null;

  const response = await fetch("/api/search_boards?" + parameters, {
    method: "GET",
    headers: {
      Authorization: auth.access_token,
    },
  });

  if (response.ok) {
    const data = await response.json();
    searchResults.value = data.results;

    if (!goingBack && data.next) {
      cursorPages.value[pageIndex.value + 1] = data.next;
    }
  } else {
    searchError.value = (await response.json())?.message ?? "An unexpected error occurred.";
  }
}

watch([menuOpen], () => {
  if (menuOpen.value) {
    searchText.value = "";
    sortMethod.value = "plays";
    search(searchText.value, sortMethod.value);
  }
});

watch([searchText], () => {
  if (searchText.value) sortMethod.value = "relevance";
  else sortMethod.value = "plays";
});

function selectBoard(id: string) {
  socket.emit("selectCustomBoard", id);
  menuOpen.value = false;
}
</script>

<template>
  <div id="boardMenu" v-if="menuOpen">
    <section role="menu" aria-label="Board Select">
      <button class="button closeButton" @click="menuOpen = !menuOpen" aria-label="Close">
        <v-icon name="bi-x-lg" />
      </button>
      <template v-if="!showingDisconnectWarning">
        <div class="boardBar">
          <button
            class="button"
            @click="
              resetPages();
              search(searchText, sortMethod);
            "
          >
            <v-icon name="bi-search" />
          </button>
          <input
            type="search"
            class="search"
            placeholder="Search"
            v-model="searchText"
            @keydown="onKeyDown"
          />
          <button class="button" @click="showingDisconnectWarning = true">
            <span style="color: var(--color-accent); font-size: x-large; vertical-align: middle"
              >+</span
            >&nbsp;Create
          </button>
        </div>
        <div class="boardMenuMain">
          <label
            >Sort by
            <select
              v-model="sortMethod"
              @change="
                resetPages();
                search(searchText, sortMethod);
              "
            >
              <option value="relevance" :disabled="!searchText">Relevance</option>
              <option value="plays">Popularity</option>
              <option value="favorites">Favorites Count</option>
              <option value="my_favorites">Your Favorites</option>
              <option value="my_boards">Your Boards</option>
            </select>
          </label>
          <WaitFor :value="searchResults != null" :error="searchError">
            <div class="paginator" v-if="cursorPages.length > 1">
              <button
                type="button"
                class="button"
                :disabled="pageIndex == 0"
                @click="
                  pageIndex--;
                  search(searchText, sortMethod, true, cursorPages[pageIndex]);
                "
              >
                ◄
              </button>
              <p>{{ pageIndex + 1 }}</p>
              <button
                type="button"
                class="button"
                :disabled="pageIndex == cursorPages.length - 1"
                @click="
                  pageIndex++;
                  search(searchText, sortMethod, false, cursorPages[pageIndex]);
                "
              >
                ►
              </button>
            </div>
            <BoardSelectList
              v-if="searchResults!.length > 0"
              :results="searchResults!"
              @selected="selectBoard($event)"
            />
            <p v-else>Sorry, no results found.</p>

            <template #error>
              <p style="color: var(--color-negative)">{{ searchError }}</p>
            </template>
          </WaitFor>
        </div>
      </template>
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
  border-radius: calc(sign(100cqi - 100%) * 25px);

  display: inline-block;
  /* width: 100em; */
  max-width: 98%;
  width: fit-content;
  /* box-sizing: content-box; */

  max-height: 95vh;
  overflow: auto;

  margin: auto;
  position: relative;
}

@media (orientation: portrait) {
  #boardMenu > section {
    max-height: 100vh;
  }
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

.boardMenuMain {
  margin-top: 1em;
}

.boardMenuMain select {
  font-size: inherit;
}

.paginator {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 2em;
  margin: 0.5em;

  justify-content: center;
  align-items: center;
}

.paginator .button {
  padding: 0.25em;
  font-size: 0.9em;
}

.paginator > * {
  margin: 0 !important;
}
</style>
