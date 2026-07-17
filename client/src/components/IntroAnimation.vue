<script setup lang="ts">
import { onUnmounted } from "vue";

const emit = defineEmits(["introDone"]);

const audio = new Audio("/audio/LarpardyIntro.mp3");

const timer = setTimeout(() => emit("introDone"), 7000);
onUnmounted(() => clearInterval(timer));

audio.play();
</script>

<template>
  <div id="game-intro">
    <div class="gridbg"></div>
    <img class="intrologo" src="../assets/img/wordmark.svg" alt="" draggable="false" />
  </div>
</template>

<style scoped>
#game-intro {
  position: fixed;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  background-color: var(--color-bg);
  overflow: hidden;

  user-select: none;
}

.gridbg {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;

  background-image:
    linear-gradient(to right, var(--color-accent3) 5px, transparent 5px),
    linear-gradient(to bottom, var(--color-accent3) 5px, transparent 5px);
  background-size: 6.75vh 6.75vh;
  /* background-position: 100px 50px; */

  animation: animatedGrid 15s linear infinite;
  transform: perspective(1000px) rotateX(45deg) scale(2);
  transform-origin: center;

  mask-image: linear-gradient(to bottom, rgb(0 0 0 / 0), rgb(0 0 0 / 1));
  -webkit-mask-image: linear-gradient(to bottom, rgb(0 0 0 / 0), rgb(0 0 0 / 1));
}

@keyframes animatedGrid {
  from {
    background-position: center 25%;
  }
  to {
    background-position: center 125%;
  }
}

.intrologo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateZ(0);
  /* translate: -50% -50%; */
  translate: -200% 200%;
  width: 50vw;
  image-rendering: pixelated;
  -webkit-user-drag: none;

  animation: logoanim 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 300ms;
}

@keyframes logoanim {
  0% {
    translate: -200% 200%;
    scale: 2.5;
  }
  /* 20% {
    translate: -150% 100%;
  } */
  100% {
    translate: -50% -50%;
    scale: 1;
  }
}
</style>
