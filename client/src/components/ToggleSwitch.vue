<script setup lang="ts">
const model = defineModel();
defineProps<{ disabled?: boolean }>();
</script>

<template>
  <label class="toggleLabel">
    <div class="toggle">
      <input type="checkbox" v-model="model" :disabled="disabled" />
      <span class="slider"></span>
    </div>
    <span class="toggleText"><slot></slot></span>
  </label>
</template>

<style scoped>
/* edited from https://www.w3schools.com/howto/howto_css_switch.asp */
.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 3em;
  height: 1.5em;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #000000aa;
  border-radius: 34px;
  transition: 0.2s;
}

.slider::before {
  position: absolute;
  content: "";
  height: 1em;
  width: 1em;
  left: 4px;
  bottom: 4px;
  background-color: white;
  -webkit-transition: 0.4s;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--color-accent3);
}

input:focus + .slider {
  box-shadow: 0 0 0 2px var(--color-accent);
}

input:checked + .slider::before {
  transform: translateX(1.5em);
}

input:disabled + .slider {
  opacity: 0.5;
  cursor: unset;
}

.toggleLabel {
  display: flex;
  flex-wrap: nowrap;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
}

.toggleText {
  display: inline-block;
}
</style>
