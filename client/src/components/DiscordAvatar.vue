<script setup lang="ts">
import { api } from "@/discord";
import type { ImageSize } from "discord-api-types/v10";

defineProps<{
  user: {
    avatar?: string | null | undefined;
    id: string;
  };
  size?: ImageSize;
}>();
</script>

<template>
  <img
    :src="
      user.avatar
        ? api.cdn.avatar(user.id, user.avatar, { size: size ?? 64 })
        : api.cdn.defaultAvatar(Number((BigInt(user.id) >> 22n) % 6n))
    "
    class="avatar"
  />
</template>

<style scoped>
.avatar {
  border-radius: 50%;
}
</style>
