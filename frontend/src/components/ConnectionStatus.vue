<template>
  <div class="connection-status">
    <div class="status-container">
      <div :class="['status-indicator', `status-${connectionStatus}`]"></div>
      <span class="status-text">{{ statusLabel }}</span>
    </div>
    <div v-if="queuedMessages > 0" class="queued-messages">
      {{ queuedMessages }} message{{ queuedMessages !== 1 ? 's' : '' }} queued
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'

const { connectionStatus, queuedMessages } = useWebSocket()

const statusLabel = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting...'
    case 'disconnected':
      return 'Disconnected'
    default:
      return 'Unknown'
  }
})
</script>

<style scoped>
.connection-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.status-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-indicator.status-connected {
  background-color: var(--color-success);
  animation: pulse-success 2s infinite;
}

.status-indicator.status-connecting {
  background-color: var(--color-warning);
  animation: pulse-warning 1s infinite;
}

.status-indicator.status-disconnected {
  background-color: var(--color-error);
  animation: none;
}

.status-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-light);
}

.queued-messages {
  font-size: 0.75rem;
  color: var(--color-warning);
  background-color: rgba(245, 158, 11, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

@keyframes pulse-success {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes pulse-warning {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
</style>
