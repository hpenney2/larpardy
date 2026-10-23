<script setup lang="ts">
import { updateLogData } from "@/socket.ts";
import BaseModal from "./Util/BaseModal.vue";
import { VueMarkdown } from "@crazydos/vue-markdown";
import { computed, ref } from "vue";

const isOpen = ref(false);

const currentDate = ref(new Date());
const newThreshold = computed(() => {
  const date = new Date();
  date.setDate(currentDate.value.getDate() - 14);
  return date;
});

function open() {
  currentDate.value = new Date();
  isOpen.value = true;
  updateLogData.shouldShow = false;
}

function close() {
  isOpen.value = false;
}

defineExpose({ open, close });

const processedUpdates = computed(() =>
  updateLogData.updates?.map((update) => ({ ...update, updated_at: new Date(update.updated_at) })),
);
</script>

<template>
  <BaseModal v-if="isOpen">
    <section class="changelog">
      <button class="button closeButton" @click="close" aria-label="Close">
        <v-icon name="bi-x-lg" />
      </button>

      <h2>Updates</h2>
      <ul v-if="processedUpdates && processedUpdates.length > 0">
        <li class="change" v-for="update in processedUpdates" :key="update.id">
          <article>
            <header>
              <h3>{{ update.title }}</h3>
              <p>
                <span class="new" v-if="update.updated_at >= newThreshold">NEW!</span>
                &nbsp;
                <time :datetime="update.updated_at.toISOString()">{{
                  update.updated_at.toLocaleDateString()
                }}</time>
              </p>
            </header>

            <VueMarkdown :markdown="update.content" :sanitize="true" />
          </article>
        </li>
      </ul>
      <p v-else-if="updateLogData.updates !== null">
        Oh, there's no updates available to read. Sorry!
      </p>
      <p v-else>Loading...</p>
    </section>
  </BaseModal>
</template>

<style scoped>
.changelog {
  background-color: var(--color-bg);
  padding: 2em;
  padding-top: 2.5em;

  border-radius: calc(sign(100cqi - 100%) * 25px);
  display: inline-block;

  max-width: min(100em, 98vw);
  width: fit-content;
  max-height: 80%;
  /* box-sizing: content-box; */

  margin: auto;
  position: relative;

  /* font-size: 2vh; */

  overflow: auto;
}

.closeButton {
  position: absolute;
  right: 0;
  top: 0;
  margin: 0.5em !important;
  padding: 0.25em;
  border-radius: 50%;
}

.changelog > * {
  margin: unset;
}

.changelog > ul {
  padding: 0;
  list-style: none;
  text-align: left;
}

.change {
  /* background-color: rgb(from var(--color-accent2) r g b / 0.5); */
  padding: 1em;
}

.change h3 {
  background-color: rgb(from var(--color-accent3) r g b / 1);
  padding: 0.75em;
  width: fit-content;
}

.change :deep(h4) {
  font-size: 1.1em;
}

.change :deep(strong) {
  background-color: rgb(from var(--color-accent3) r g b / 0.5);
  padding: 0.25em;
  display: inline-block;
}

.change header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1em;
}

.change .new {
  padding: 0.75em;
  font-weight: bold;
  background-color: rgb(from var(--color-accent3) r g b / 0.8);
}

.change + .change {
  border-top: 2px solid white;
}
</style>
