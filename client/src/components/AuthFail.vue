<script setup lang="ts">
import { auth, discordSdk } from "@/discord";
import { RPCCloseCodes } from "@discord/embedded-app-sdk";
import { computed } from "vue";

const { err } = defineProps<{ err: unknown }>();
const isServerProblem = computed(() => err instanceof Error && err.cause instanceof Response);
</script>

<template>
  <div id="__auth-failure-error">
    <h1>Uh oh!</h1>
    <h2>An error occured.</h2>
    <p>If you declined an authorization prompt, please accept it.</p>
    <p class="errorText">{{ err }}</p>
    <p v-if="isServerProblem">This is likely a temporary issue. Please try again later!</p>
    <button
      type="button"
      v-if="auth != null"
      @click="
        discordSdk.close(RPCCloseCodes.CLOSE_ABNORMAL, 'Sorry about that. Please restart the game!')
      "
    >
      Close
    </button>
  </div>
</template>

<style scoped>
:global(body:has(#__auth-failure-error)) {
  background-color: black;
}

div {
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: x-large;
}

h2 {
  font-size: larger;
}

.errorText {
  font-size: smaller;
  color: red;
}
</style>
