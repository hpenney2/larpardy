<script setup lang="ts">
import { computed, ref } from "vue";
import BaseModal from "./Util/BaseModal.vue";

const { question, answer } = defineProps<{ question?: string | null; answer?: string | null }>();

const emit = defineEmits(["cancel", "done"]);

const newQuestion = ref(question ?? "");
const newAnswer = ref(answer ?? "");

const valid = computed(() => newQuestion.value.trim() && newAnswer.value.trim());

function cancel() {
  emit("cancel");
}

function done() {
  if (valid.value) emit("done", newQuestion.value, newAnswer.value);
}
</script>

<template>
  <BaseModal>
    <section class="editorQuestion" role="menu">
      <div class="questionAnswer">
        <div>
          <label>
            Question
            <textarea rows="5" v-model="newQuestion"></textarea>
          </label>
          <p class="hint">
            This is usually worded as a statement
            <br />
            (e.g., "A group of these animals are called a 'flamboyance'")
          </p>
        </div>
        <div>
          <label>
            Answer
            <textarea rows="5" v-model="newAnswer"></textarea>
          </label>
          <p class="hint">
            This is usually worded as a question
            <br />
            (e.g., "[What are] flamingos?")
          </p>
        </div>
      </div>
      <div class="questionButtons">
        <button class="button" @click="cancel">Cancel</button>
        <button
          class="button"
          style="border-color: var(--color-positive)"
          :disabled="!valid"
          @click="done"
        >
          Continue
        </button>
      </div>
    </section>
  </BaseModal>
</template>

<style scoped>
.editorQuestion {
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

  display: flex;
  flex-direction: column;
  gap: 1em;
}

.questionAnswer {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1em;
}

.questionAnswer > * {
  flex: 1;
}

.questionAnswer textarea {
  display: block;
  resize: vertical;
  width: 100%;
  font-size: 1.25em;
}

.questionAnswer > * + * {
  border-left: 2px black solid;
  padding-left: 1em;
}

.questionButtons > * + * {
  margin-left: 0.5em;
}

.hint {
  /* font-size: 0.8em; */
  opacity: 0.75;
}
</style>
