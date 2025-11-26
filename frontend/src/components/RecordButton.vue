<template>
  <button
    :class="['record-button', { recording }]"
    @click="toggleRecording"
    :disabled="!isConnected"
    :title="isConnected ? 'Toggle recording' : 'Connect to start recording'"
  >
    <span class="record-icon" v-if="!recording">●</span>
    <span class="stop-icon" v-else>■</span>
    {{ recording ? 'Stop Recording' : 'Start Recording' }}
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'

const { connectionStatus } = useWebSocket()

const recording = ref(false)

const isConnected = computed(() => connectionStatus.value === 'connected')

const toggleRecording = () => {
  if (!isConnected.value) {
    return
  }

  recording.value = !recording.value

  // Emit event or send message when toggling recording
  // This is a placeholder - implement actual recording logic as needed
}
</script>

<style scoped>
.record-button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-primary);
  color: white;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: 1rem;
}

.record-button:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  box-shadow: var(--shadow-md);
}

.record-button:disabled {
  background-color: #d1d5db;
  cursor: not-allowed;
  opacity: 0.6;
}

.record-button.recording {
  background-color: var(--color-error);
  animation: pulse-red 1.5s ease-in-out infinite;
}

.record-button.recording:hover:not(:disabled) {
  background-color: #dc2626;
}

.record-icon,
.stop-icon {
  font-size: 1.25rem;
  line-height: 1;
}

@keyframes pulse-red {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
}
</style>
