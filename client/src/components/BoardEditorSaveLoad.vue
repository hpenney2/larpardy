<script setup lang="ts">
import type { GameBoard } from "@larpardy/shared/state";
import BaseModal from "./Util/BaseModal.vue";
import { ref, watchEffect } from "vue";
import { editorState } from "@/socket.ts";

const { board } = defineProps<{ board: GameBoard }>();
const emit = defineEmits<{ done: []; loaded: [] }>();

const saved = ref<Record<string, { name: string; board: GameBoard }>>({});

const selected = ref("new");
const saveName = ref("");

watchEffect(() => {
  saveName.value = selected.value === "new" ? "" : saved.value[selected.value]!.name;
});

try {
  const encoded = localStorage.getItem("larpCustomSaved");
  if (encoded) {
    saved.value = JSON.parse(encoded);
  }
} catch {}

function save() {
  if (selected.value === "new") {
    saved.value[crypto.randomUUID()] = { name: saveName.value, board };
  } else {
    saved.value[selected.value] = { name: saveName.value, board };
  }

  localStorage.setItem("larpCustomSaved", JSON.stringify(saved.value));
}

function load() {
  if (selected.value !== "new") {
    editorState.existingBoard = saved.value[selected.value]?.board;
  }
}

let timeoutId: NodeJS.Timeout | null = null;
const isConfirmingSave = ref(false);
const isConfirmingLoad = ref(false);
function confirmSave() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  if (!isConfirmingSave.value) {
    isConfirmingLoad.value = false;
    isConfirmingSave.value = true;

    timeoutId = setTimeout(() => (isConfirmingSave.value = false), 3000);
  } else {
    isConfirmingSave.value = false;
    save();
    emit("done");
  }
}

function confirmLoad() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  if (!isConfirmingLoad.value) {
    isConfirmingLoad.value = true;
    isConfirmingSave.value = false;

    timeoutId = setTimeout(() => (isConfirmingLoad.value = false), 3000);
  } else {
    isConfirmingLoad.value = false;
    load();
    emit("loaded");
  }
}
</script>

<template>
  <BaseModal>
    <div class="savePrompt">
      <h3>Save / Load</h3>
      <p>Board drafts saved here are stored locally only.</p>

      <p>If you want to upload a board, choose <strong>Finish</strong> instead.</p>
      <p>
        <strong class="danger">WARNING:</strong> Drafts might not be saved permanently on mobile.
      </p>
      <div class="saveInputs">
        <select size="10" v-model="selected">
          <option value="new" style="font-weight: bold">&lt;&lt; NEW &gt;&gt;</option>
          <option v-for="(save, id) in saved" :key="id" :value="id">{{ save.name }}</option>
        </select>
        <label>
          {{ selected == "new" ? "Save Name" : "Rename Save" }}
          <input type="text" v-model="saveName" />
        </label>
        <button type="button" class="button" :disabled="!saveName.trim()" @click="confirmSave()">
          {{ isConfirmingSave ? "Are you sure you want to save?" : "Save" }}
        </button>
        <button type="button" class="button" :disabled="selected === 'new'" @click="confirmLoad()">
          {{ isConfirmingLoad ? "Are you sure you want to load?" : "Load" }}
        </button>
        <button
          type="button"
          class="button"
          style="border-color: var(--color-negative)"
          @click="$emit('done')"
        >
          Cancel
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.savePrompt {
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

.saveInputs {
  display: flex;
  flex-direction: column;
  gap: 1em;
}
</style>
