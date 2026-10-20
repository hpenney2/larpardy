<script setup lang="ts">
import { auth } from "@/discord";
import type { SearchBoardPartial, User } from "@larpardy/shared/userBoards";
import { ref } from "vue";
import WaitFor from "./Util/WaitFor.vue";

const isOpen = ref(false);

const boardData = ref<SearchBoardPartial | null>(null);
const userData = ref<User | null>(null);
const userDataError = ref(false);

const busy = ref(false);

async function open(board?: SearchBoardPartial, user?: string) {
  isOpen.value = true;
  boardData.value = null;
  userData.value = null;

  if (board) {
    boardData.value = board;
  }

  let route: string | null = null;
  if (user) {
    route = "/api/users/" + user;
  } else if (board) {
    route = "/api/board/" + board.id + "/author";
  }

  if (route) {
    const response = await fetch(route, {
      method: "GET",
      headers: {
        Authorization: auth.access_token,
      },
    });

    if (response.ok) {
      userData.value = await response.json();
    } else {
      userDataError.value = true;
    }
  }
}

defineExpose({ open });

// Moderation
async function restrictBoard(restrict: boolean) {
  if (!boardData.value) return;

  busy.value = true;

  try {
    const response = await fetch("/api/board/" + boardData.value.id + "/restrict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth.access_token,
      },
      body: JSON.stringify({ value: restrict }),
    });

    if (response.ok) {
      const data = await response.json();

      if (data.success) {
        boardData.value.restricted = data.date;
      }
    }
  } catch {}

  busy.value = false;
}

async function restrictUser(restrict: boolean) {
  if (!userData.value) return;

  busy.value = true;

  try {
    const response = await fetch("/api/users/" + userData.value.id + "/restrict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth.access_token,
      },
      body: JSON.stringify({ value: restrict }),
    });

    if (response.ok) {
      const data = await response.json();

      if (data.success) {
        userData.value.restricted = restrict;
      }
    }
  } catch {}

  busy.value = false;
}
</script>

<template>
  <div id="modMenu" v-if="isOpen">
    <section role="menu" aria-label="Moderation Menu">
      <h2 class="danger">Moderate</h2>
      <section v-if="boardData">
        <hr />

        <h3>Board</h3>
        <p>{{ boardData.title }}</p>
        <p>{{ boardData.id }}</p>
        <p>{{ boardData.plays }} plays and {{ boardData.favorites }} favorites</p>
        <p>{{ boardData.privacy.charAt(0).toUpperCase() + boardData.privacy.slice(1) }}</p>
        <p v-if="boardData.restricted" style="color: var(--color-negative)">
          Restricted on {{ boardData.restricted }}
        </p>

        <div class="modOptions">
          <button
            type="button"
            class="button danger"
            :disabled="busy"
            @click="restrictBoard(!boardData.restricted)"
          >
            {{ boardData.restricted ? "Unrestrict Board" : "Restrict Board" }}
          </button>
        </div>
      </section>

      <hr />

      <section v-if="!userDataError">
        <WaitFor :value="userData">
          <h3>User</h3>
          <p>@{{ userData?.username }} ({{ userData?.id }})</p>
          <p>Last login was {{ userData?.last_login }}</p>
          <p :class="{ danger: userData?.admin }">
            {{ userData?.admin ? "ADMIN" : "Not an admin" }}
          </p>
          <p :class="{ danger: userData?.restricted }">
            {{ userData?.restricted ? "RESTRICTED" : "Not restricted" }}
          </p>

          <div class="modOptions">
            <button
              type="button"
              class="button danger"
              :disabled="busy"
              @click="restrictUser(!userData?.restricted)"
            >
              {{ userData?.restricted ? "Unrestrict User" : "Restrict User" }}
            </button>
          </div>
        </WaitFor>

        <hr />
      </section>

      <button type="button" class="button" @click="isOpen = false">Done</button>
    </section>
  </div>
</template>

<style scoped>
#modMenu {
  position: fixed;
  width: 100dvw;
  height: 100dvh;
  inset: 0;
  backdrop-filter: brightness(20%);
  z-index: 1000;

  background: none;

  text-align: center;
  align-content: center;
}

#modMenu > section {
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

.modOptions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  gap: 0.5em;
}
</style>
