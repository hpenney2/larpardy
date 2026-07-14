<script setup lang="ts">
import { api } from "@/discord";
import type { ImageSize } from "discord-api-types/v10";

defineProps<{
  user: {
    avatar?: string | null | undefined;
    id: string;
  };
  size?: ImageSize;
  speaking?: boolean;
  loading?: boolean;
}>();
</script>

<template>
  <div class="avatarContainer" :class="{ speaking, loading }">
    <img
      :src="
        user.avatar
          ? api.cdn.avatar(user.id, user.avatar, { size: size ?? 64 })
          : api.cdn.defaultAvatar(Number((BigInt(user.id) >> 22n) % 6n))
      "
      class="avatar"
      draggable="false"
    />
  </div>
</template>

<style scoped>
.avatar {
  -webkit-user-drag: none;
  /* width: 100%;
  height: 100%; */
}

.avatarContainer {
  border-radius: 50%;
  line-height: 0;
  width: min-content;
  position: relative;
  display: inline-block;
  overflow: clip;
}

.speaking::after {
  /* box-shadow: 0 0 0 0px var(--status-speaking), inset 0 0 0 2px var(--status-speaking), inset 0 0 0 3px var(--background-base-lower); */
  box-shadow: inset 0 0 0 3px var(--user-speaking);
  content: "";
  inset: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}

.loading::after {
  content: "...";
  display: block;
  align-content: center;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  backdrop-filter: brightness(50%);

  animation: wait 2s linear infinite;
}
</style>
