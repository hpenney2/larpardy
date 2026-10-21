<script setup lang="ts">
import { ref, useTemplateRef, watch } from "vue";
import BoardPreview from "./BoardPreview.vue";
import type { SearchBoardPartial } from "@larpardy/shared/userBoards";
import { pluralize } from "@/shared.ts";
import type { GameBoard } from "@larpardy/shared/state";
import { auth } from "@/discord.ts";
import WaitFor from "./Util/WaitFor.vue";
import ModerationMenu from "./ModerationMenu.vue";
import ConfirmModal from "./Util/ConfirmModal.vue";
import { gameState } from "@/socket.ts";

const { results } = defineProps<{ results: SearchBoardPartial[]; modMode: boolean }>();
const emit = defineEmits<{
  selected: [id: string];
  removed: [id: string];
  edit: [existingData: SearchBoardPartial, board: GameBoard];
}>();

const modMenu = useTemplateRef("modMenu");

const previewRef = useTemplateRef("preview");
// previewRef.value?.scrollIntoView()

const selected = ref<SearchBoardPartial | null>(null);
const boardCache = ref<Record<string, GameBoard>>({});

watch(
  () => selected.value?.id,
  async () => {
    if (selected.value && boardCache.value[selected.value.id] == null) {
      const response = await fetch("/api/board/" + selected.value?.id, {
        method: "GET",
        headers: {
          Authorization: auth.access_token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        boardCache.value[selected.value.id] = data.board;
      }
    }
  },
);

const busy = ref(false);
async function favorite() {
  if (!selected.value) return;

  busy.value = true;
  const board = selected.value;

  const response = await fetch(`/api/board/${board.id}/favorite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth.access_token,
    },
    body: JSON.stringify({ value: !board.favorited }),
  });

  if (response.ok) {
    board.favorited = !board.favorited;

    if (board.favorited) {
      board.favorites++;
    } else {
      board.favorites--;
    }
  }

  busy.value = false;
}

const deleting = ref(false);
async function deleteBoard() {
  if (!selected.value) return;

  busy.value = true;
  const board = selected.value;

  const response = await fetch(`/api/board/${board.id}`, {
    method: "DELETE",
    headers: {
      Authorization: auth.access_token,
    },
  });

  if (response.ok) {
    selected.value = null;
    emit("removed", board.id);
  }

  busy.value = false;
}

function formatNumber(num: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(
    num,
  );
}

function parseDateISO(date: string) {
  const initDate = new Date(date);
  return new Date(initDate.getTime() - initDate.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}
</script>

<template>
  <section class="boardSelectList">
    <ul class="boardList">
      <li
        v-for="board in results"
        :key="board.id"
        :class="{ private: board.privacy !== 'public', restricted: board.restricted }"
        @click="selected = board"
      >
        <h4 style="margin-top: 0.5em">
          {{ board.title }}
        </h4>
        <div class="stats">
          <cite>@{{ board.author }}</cite>
          <span><v-icon name="bi-play-fill" />{{ formatNumber(board.plays) }}</span>
          <span
            ><v-icon name="bi-heart-fill" scale="0.5" />{{ formatNumber(board.favorites) }}</span
          >
          <span>{{ parseDateISO(board.created) }}</span>
        </div>
      </li>
    </ul>
    <div class="boardPreview" ref="preview" v-if="selected">
      <h4 class="boardTitle">{{ selected.title }}</h4>
      <p class="code">{{ selected.id }}</p>
      <p>
        Created by <cite>@{{ selected.author }}</cite> &bullet; {{ selected.plays }} play{{
          pluralize("s", selected.plays)
        }}
        &bullet; {{ selected.favorites }} favorite{{ pluralize("s", selected.favorites) }}
      </p>
      <p>
        Created
        <time :datetime="selected.created">{{ parseDateISO(selected.created) }}</time>
        <span v-if="selected.edited">
          (edited
          <time :datetime="selected.edited"> {{ parseDateISO(selected.edited) }} </time>)</span
        >
      </p>
      <p>{{ selected.privacy.charAt(0).toUpperCase() + selected.privacy.slice(1) }}</p>
      <div class="previewButtons">
        <button type="button" class="button danger" v-if="modMode" @click="modMenu?.open(selected)">
          Moderate
        </button>
        <button
          type="button"
          class="button"
          :class="{ favorited: selected.favorited }"
          :aria-label="selected.favorited ? 'Unfavorite' : 'Favorite'"
          :disabled="busy"
          @click="favorite()"
        >
          <v-icon name="bi-heart" v-if="!selected.favorited" />
          <v-icon name="bi-heart-fill" v-else />
        </button>

        <button
          type="button"
          class="button danger"
          v-if="selected.owned"
          :disabled="busy"
          @click="deleting = true"
        >
          Delete
        </button>

        <button
          type="button"
          class="button"
          v-if="selected.owned && boardCache[selected.id]"
          @click="emit('edit', selected, boardCache[selected.id]!)"
        >
          Edit
        </button>
        <button
          type="button"
          class="button"
          @click="emit('selected', selected.id)"
          :disabled="auth.user.id !== gameState.state?.host"
        >
          Select
        </button>
      </div>
      <WaitFor :value="boardCache[selected.id] != null">
        <BoardPreview :board="boardCache[selected.id]!" />
      </WaitFor>
    </div>
  </section>

  <ModerationMenu ref="modMenu" />

  <ConfirmModal
    v-if="deleting && selected"
    @yes="
      deleting = false;
      deleteBoard();
    "
    @no="deleting = false"
  >
    Are you sure you want to delete <cite>{{ selected.title }}</cite
    >?
  </ConfirmModal>
</template>

<style scoped>
.boardSelectList {
  display: flex;
  flex-direction: row;
  flex-wrap: no-wrap;
  gap: 2em;
}

.boardList {
  overflow-y: auto;

  flex: 1 1 auto;
  list-style: none;
  padding: 0;

  text-align: left;

  max-height: 90%;
}

.boardSelectList * {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.boardList > li {
  background-color: #000000aa;
  padding: 0.5em;
  border: var(--color-accent) solid 2px;
  border-radius: 10px;

  width: fit-content;

  transition: all 0.1s linear;
}

.boardList > li.private {
  border-style: dashed;
}

.boardList > li.restricted {
  border-color: var(--color-negative);
}

.boardList > li:hover {
  background-color: rgb(255, 255, 255);
  color: black;
  cursor: pointer;
}

.boardList > li + li {
  margin-top: 0.5em;
}

.boardList > li > h4 {
  overflow-wrap: break-word;
  word-break: break-word;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  column-gap: 2em;
  justify-content: space-between;
  align-items: center;

  font-size: smaller;
}

.stats svg {
  vertical-align: -0.315em;
}

.boardPreview {
  flex: 2 1 auto;
  position: sticky;
  align-self: flex-start;
  margin-top: auto;
  bottom: 0;

  max-width: 90%;

  text-align: right;
}

@media (orientation: portrait) {
  .boardSelectList {
    flex-wrap: wrap-reverse;
  }

  .boardPreview {
    max-width: unset;
  }
}

.boardTitle {
  font-size: larger;
}

.previewButtons {
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 1em;
}

.favorited {
  background-color: var(--color-accent3);
}

.code {
  font-size: smaller;
  user-select: all;
}
</style>
