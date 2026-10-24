<script setup lang="ts">
import { computed, ref } from "vue";
import BaseModal from "./Util/BaseModal.vue";
import type { GameBoard } from "@larpardy/shared/state";
import type { BoardPrivacy, UserBoard } from "@larpardy/shared/userBoards";
import { auth, discordSdk } from "@/discord.ts";

const emit = defineEmits(["return", "backToLobby"]);

const existingId = defineModel<string>("id");
const existingTitle = defineModel<string>("title");
const existingPrivacy = defineModel<BoardPrivacy>("privacy");

const { board } = defineProps<{ valid: boolean; board: GameBoard }>();

const formData = ref<{ title: string; privacy: BoardPrivacy }>({
  title: existingTitle.value ?? "",
  privacy: existingPrivacy.value ?? "public",
});

async function publish() {
  submitting.value = true;
  submitErrorStatus.value = undefined;

  const data: UserBoard = { ...formData.value, board: board };

  const response = await fetch("/api/board" + (existingId.value ? "/" + existingId.value : ""), {
    method: existingId.value ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth.access_token,
    },
    body: JSON.stringify(data),
  });

  if (response.ok) {
    submissionId.value = await response.text();
    existingId.value = submissionId.value;
    existingTitle.value = formData.value.title;
    existingPrivacy.value = formData.value.privacy;
  } else {
    submitErrorStatus.value = response.status;
  }

  submitting.value = false;
}
1;

function cancel() {
  emit("return");
}

function backToLobby() {
  emit("backToLobby");
}

const submitting = ref(false);
const submissionId = ref<string | undefined>();
const submitErrorStatus = ref<number | undefined>();

const errorText = computed(() => {
  switch (submitErrorStatus.value) {
    case 400:
      return "The submitted data isn't valid. Either the board isn't valid, or an unexpected bug is causing this.";
    case 401:
      return "Authentication failed. Try restarting LARPARDY?";
    case 403:
      return "Forbidden. Either you are banned (restricted) or are somehow trying to edit a board that you did not create.";
    case 429:
      return "You are being rate limited. You have created too many boards today. Please try again later!";
    case 500:
      return "Unexpected error. Please report this!";
    case 502:
      return "The server is not available. Please try again later.";
    case 504:
      return "The server timed out. Please try again later; the server might be under load.";
    default:
      return "Unexpected error. You might want to report this.";
  }
});
</script>

<template>
  <BaseModal>
    <section class="editorFinish" role="menu">
      <div v-if="submissionId">
        <h3>Submitted</h3>
        <p>Your board has been published as {{ formData.privacy }}!</p>

        <p v-if="formData.privacy !== 'private'">
          The code below can be shared with others to search directly for your board.
        </p>
        <div class="submitInfo">
          <h4>{{ formData.title }}</h4>
          <p class="boardCode">{{ submissionId }}</p>
        </div>

        <div class="finishButtons">
          <button class="button" @click="backToLobby">Return to lobby</button>
          <button class="button" @click="cancel">Continue editing</button>
        </div>
      </div>
      <form v-else-if="valid" id="boardForm" @submit.prevent="publish">
        <h3>Ready to publish your board?</h3>

        <p v-if="existingId">
          This will update your existing board <br />
          (code <span class="inlineCode">{{ existingId }}</span
          >).
        </p>

        <fieldset :disabled="submitting">
          <legend>Privacy</legend>

          <label>
            <input
              type="radio"
              name="privacy"
              v-model="formData.privacy"
              value="private"
              required
            />Private
            <span class="hint" role="note">Only you can view or play this board.</span>
          </label>
          <label>
            <input
              type="radio"
              name="privacy"
              required
              v-model="formData.privacy"
              value="unlisted"
            />Unlisted
            <span class="hint" role="note">
              Only people with this board's code can view or play this board.
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="privacy"
              required
              v-model="formData.privacy"
              value="public"
            />Public
            <span class="hint" role="note">Anybody can play this board.</span>
          </label>
          <p>If others can view your board, your Discord username will be publicly visible.</p>
        </fieldset>
        <label>
          Title
          <input
            type="text"
            required
            pattern=".*\S.*"
            maxlength="500"
            v-model="formData.title"
            :disabled="submitting"
        /></label>
        <p>
          By submitting, you agree to our
          <a
            href="javascript:void(0);"
            @click="
              discordSdk.commands.openExternalLink({
                url: 'https://larpardy.purpld.dev/legal.html',
              })
            "
            >Terms of Service and Privacy Policy</a
          >.
        </p>
      </form>
      <div v-else>
        <h3>Not yet...</h3>
        <p>
          <strong style="color: var(--color-negative)">
            Your board is not ready to be published yet.
          </strong>
          <br />
          Make sure that:
        </p>
        <ul>
          <li>All cells have a question AND and an answer.</li>
          <li>All categories are named.</li>
        </ul>
        <p>
          If you don't need as many columns and/or rows, change the numbers at the top of the
          editor.
        </p>
      </div>
      <div class="finishButtons" v-if="!submissionId">
        <button class="button" @click="cancel" :disabled="submitting">Cancel</button>
        <button
          type="submit"
          form="boardForm"
          class="button"
          style="border-color: var(--color-positive)"
          v-if="valid"
          :disabled="submitting"
        >
          {{ submitting ? "Submitting..." : "Submit" }}
        </button>
      </div>
      <p class="error" v-if="!submitting && submitErrorStatus">
        <strong>ERROR {{ submitErrorStatus }}</strong
        >: {{ errorText }}
      </p>
    </section>
  </BaseModal>
</template>

<style scoped>
.editorFinish {
  background-color: var(--color-bg);
  padding: 2em;
  padding-top: 2.5em;

  /* border: 0.5em solid var(--color-accent2); */
  border-radius: calc(sign(100cqi - 100%) * 25px);
  display: inline-block;
  /* width: 100em; */
  max-width: 100vw;
  width: fit-content;
  /* box-sizing: content-box; */

  margin: auto;
  position: relative;

  font-size: 2vh;

  overflow: auto;

  /* display: flex;
  flex-direction: column;
  gap: 1em; */
}

.editorFinish label {
  display: block;
  text-align: left;
  max-width: 50em;
}

.editorFinish input {
  font-size: inherit;
}

.finishButtons {
  margin-top: 1em;
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-around;
  align-items: center;
}

.editorFinish form {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1em;
}

.hint {
  /* font-size: 0.8em; */
  opacity: 0.75;
}

.editorFinish input[type="radio"] {
  accent-color: var(--color-accent3);
}

.submitInfo {
  padding: 0.5em;
}

.boardCode {
  padding: 1em;
  background-color: var(--color-accent3);
  border-radius: 16px;

  font-family: "Courier New", Courier, monospace;

  user-select: all;
}

.inlineCode {
  font-family: "Courier New", Courier, monospace;
  background-color: var(--color-accent3);

  display: inline-block;
  padding: 0.25em;
  border-radius: 12px;

  user-select: all;
}

.error {
  color: var(--color-negative);
}
</style>
