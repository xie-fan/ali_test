<template>
  <MicrophoneCapture />
</template>

<script>
import MicrophoneCapture from './components/MicrophoneCapture.vue'

export default {
  name: 'App',
  components: {
    MicrophoneCapture
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}
</style>
