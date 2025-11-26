<template>
  <div class="file-upload">
    <label class="upload-label" :class="{ 'drag-over': isDragging }">
      <input
        type="file"
        ref="fileInput"
        @change="handleFileSelect"
        @dragenter="isDragging = true"
        @dragover="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleFileDrop"
        accept=".wav,.mp3,.ogg,.flac"
        :disabled="uploading"
        style="display: none"
      />
      <span class="upload-icon">📁</span>
      <span class="upload-text">
        <span class="upload-main">{{ uploading ? 'Uploading...' : 'Upload Audio File' }}</span>
        <span class="upload-sub">or drag and drop</span>
      </span>
    </label>
    <div v-if="uploadedFile" class="uploaded-file">
      <span>✓ {{ uploadedFile.name }}</span>
      <button type="button" @click="clearFile" class="clear-button">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'

const { connectionStatus, send } = useWebSocket()

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const uploading = ref(false)
const uploadedFile = ref<File | null>(null)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processFile(file)
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    processFile(file)
  }
}

const processFile = async (file: File) => {
  if (!file.type.startsWith('audio/')) {
    alert('Please select an audio file')
    return
  }

  uploading.value = true
  uploadedFile.value = file

  try {
    // Send file to server
    const reader = new FileReader()
    reader.onload = () => {
      if (connectionStatus.value === 'connected') {
        send({
          type: 'audio.data',
          data: {
            name: file.name,
            size: file.size,
            // In a real implementation, you would send the file data
          },
        })
      }
    }
    reader.readAsArrayBuffer(file)
  } finally {
    uploading.value = false
  }
}

const clearFile = () => {
  uploadedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>

<style scoped>
.file-upload {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.upload-label:hover:not(:disabled) {
  border-color: var(--color-primary);
  background-color: rgba(59, 130, 246, 0.05);
}

.upload-label.drag-over {
  border-color: var(--color-primary);
  background-color: rgba(59, 130, 246, 0.1);
  transform: scale(1.02);
}

.upload-icon {
  font-size: 2rem;
}

.upload-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.upload-main {
  font-weight: 600;
  color: var(--color-text);
}

.upload-sub {
  font-size: 0.875rem;
  color: var(--color-text-light);
}

.uploaded-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background-color: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-md);
  color: var(--color-success);
}

.clear-button {
  background-color: transparent;
  color: var(--color-error);
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0;
  transition: all var(--transition-base);
}

.clear-button:hover {
  transform: scale(1.1);
  color: #dc2626;
}
</style>
