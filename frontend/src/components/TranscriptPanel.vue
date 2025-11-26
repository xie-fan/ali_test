<template>
  <div class="transcript-panel">
    <div class="transcript-header">
      <h2>Transcript</h2>
      <button v-if="messages.length > 0" @click="clearTranscript" class="clear-btn">
        Clear
      </button>
    </div>
    <div class="transcript-content">
      <div v-if="messages.length === 0" class="empty-state">
        <p>No transcriptions yet</p>
        <p class="text-hint">Start recording or upload an audio file to see transcriptions</p>
      </div>
      <div v-else class="messages-list">
        <div v-for="(message, index) in messages" :key="index" class="message-item">
          <div class="message-meta">
            <span class="message-type">{{ message.type }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-text">{{ message.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'

interface Message {
  type: 'user' | 'transcription' | 'response'
  text: string
  timestamp: Date
}

const { lastMessage } = useWebSocket()

const messages = ref<Message[]>([])

watch(lastMessage, (newMessage) => {
  if (newMessage && newMessage.data) {
    const text = newMessage.data.text || JSON.stringify(newMessage.data)
    messages.value.push({
      type: 'transcription',
      text,
      timestamp: new Date(),
    })

    // Auto-scroll to bottom
    setTimeout(() => {
      const panel = document.querySelector('.transcript-content')
      if (panel) {
        panel.scrollTop = panel.scrollHeight
      }
    }, 0)
  }
})

const clearTranscript = () => {
  messages.value = []
}

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<style scoped>
.transcript-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.transcript-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-secondary);
}

.transcript-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.clear-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-error);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all var(--transition-base);
}

.clear-btn:hover {
  background-color: #dc2626;
  box-shadow: var(--shadow-sm);
}

.transcript-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-light);
}

.empty-state p {
  margin: 0;
}

.empty-state p:first-child {
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}

.text-hint {
  font-size: 0.875rem;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.message-item {
  padding: var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  animation: slideIn 0.3s ease;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
  font-size: 0.75rem;
  color: var(--color-text-light);
}

.message-type {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-transform: uppercase;
}

.message-time {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.message-text {
  color: var(--color-text);
  word-break: break-word;
  line-height: 1.6;
  font-size: 0.95rem;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
