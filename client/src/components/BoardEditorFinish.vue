<script setup lang="ts">
import BaseModal from "./Util/BaseModal.vue";

const emit = defineEmits(["return"]);

defineProps<{ valid: boolean }>();

function publish() {}

function cancel() {
  emit("return");
}
</script>

<template>
  <BaseModal>
    <section class="editorFinish" role="menu">
      <h3>Ready to publish your board?</h3>
      <div v-if="valid">:D</div>
      <div v-else>
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
      <div class="finishButtons">
        <button class="button" @click="cancel">Cancel</button>
        <button
          class="button"
          style="border-color: var(--color-positive)"
          v-if="valid"
          @click="publish"
        >
          Publish
        </button>
      </div>
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

  display: flex;
  flex-direction: column;
  /* gap: 1em; */
}

.finishButtons {
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-around;
  align-items: center;
}
</style>
