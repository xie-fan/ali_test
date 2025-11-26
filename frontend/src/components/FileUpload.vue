<template>
  <div class="file-upload">
    <!-- Upload input section -->
    <div v-if="!state.isUploading" class="upload-input-section">
      <label class="upload-label" :class="{ 'drag-over': isDragging }">
        <input
          type="file"
          ref="fileInput"
          @change="handleFileSelect"
          @dragenter="isDragging = true"
          @dragover="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleFileDrop"
          accept="audio/*"
          :disabled="state.isUploading"
          style="display: none"
        />
        <span class="upload-icon">📁</span>
        <span class="upload-text">
          <span class="upload-main">Upload Audio File</span>
          <span class="upload-sub">WAV, MP3, MP4, OGG, or FLAC</span>
          <span class="upload-sub-size">Max 100MB</span>
        </span>
      </label>
    </div>

    <!-- Uploaded file display -->
    <div v-if="state.file && !state.isUploading" class="uploaded-file">
      <div class="file-info">
        <span class="file-icon">🎵</span>
        <div class="file-details">
          <span class="file-name">{{ state.file.name }}</span>
          <span class="file-size">{{ formatFileSize(state.file.size) }}</span>
        </div>
      </div>
      <button type="button" @click="cancelUploadHandler" class="clear-button">✕</button>
    </div>

    <!-- Upload progress section -->
    <div v-if="state.isUploading" class="upload-progress-section">
      <div class="progress-header">
        <span class="progress-title">Uploading: {{ state.file?.name }}</span>
        <span class="progress-percent">{{ progressPercent }}%</span>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <div class="progress-info">
        <span>Chunk {{ state.currentChunk }} of {{ state.totalChunks }}</span>
        <span v-if="state.isPaused" class="status-paused">Paused</span>
        <span v-else class="status-uploading">Uploading...</span>
      </div>

      <div class="upload-controls">
        <button
          v-if="!state.isPaused"
          type="button"
          @click="pauseUploadHandler"
          class="control-button pause-button"
        >
          ⏸ Pause
        </button>
        <button
          v-else
          type="button"
          @click="resumeUploadHandler"
          class="control-button resume-button"
        >
          ▶ Resume
        </button>
        <button
          type="button"
          @click="cancelUploadHandler"
          class="control-button cancel-button"
        >
          ✕ Cancel
        </button>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="state.error" class="error-message">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ state.error }}</span>
      <button type="button" @click="clearErrorHandler" class="error-close">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFileUpload } from '@/composables/useFileUpload'
import { formatFileSize } from '@/utils/audioProcessor'

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)

const { state, progressPercent, uploadFile, pauseUpload, resumeUpload, cancelUpload, clearError } =
  useFileUpload({
    targetSampleRate: 16000,
    chunkSizeKB: 40,
  })

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadFile(file)
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    uploadFile(file)
  }
}

const pauseUploadHandler = () => {
  pauseUpload()
}

const resumeUploadHandler = () => {
  resumeUpload()
}

const cancelUploadHandler = () => {
  cancelUpload()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const clearErrorHandler = () => {
  clearError()
}
</script>

<style scoped>
.file-upload {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* Upload input section */
.upload-input-section {
  width: 100%;
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

.upload-sub-size {
  font-size: 0.75rem;
  color: var(--color-text-light);
  font-weight: 500;
}

/* Uploaded file display */
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

.file-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.file-icon {
  font-size: 1.5rem;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-weight: 500;
  color: var(--color-success);
}

.file-size {
  font-size: 0.75rem;
  color: rgba(16, 185, 129, 0.7);
}

.clear-button {
  background-color: transparent;
  color: var(--color-error);
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0;
  transition: all var(--transition-base);
  flex-shrink: 0;
  margin-left: var(--spacing-md);
}

.clear-button:hover {
  transform: scale(1.1);
  color: #dc2626;
}

/* Upload progress section */
.upload-progress-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-title {
  font-weight: 500;
  color: var(--color-text);
  font-size: 0.95rem;
}

.progress-percent {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 1rem;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  border-radius: var(--radius-md);
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--color-text-light);
}

.status-uploading {
  color: var(--color-primary);
  font-weight: 500;
}

.status-paused {
  color: #f59e0b;
  font-weight: 500;
}

.upload-controls {
  display: flex;
  gap: var(--spacing-sm);
}

.control-button {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: white;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all var(--transition-base);
}

.pause-button {
  color: #f59e0b;
  border-color: #f59e0b;
}

.pause-button:hover {
  background-color: rgba(245, 158, 11, 0.05);
  border-color: #d97706;
  color: #d97706;
}

.resume-button {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.resume-button:hover {
  background-color: rgba(59, 130, 246, 0.05);
  border-color: #2563eb;
  color: #2563eb;
}

.cancel-button {
  color: var(--color-error);
  border-color: var(--color-error);
}

.cancel-button:hover {
  background-color: rgba(239, 68, 68, 0.05);
  border-color: #dc2626;
  color: #dc2626;
}

/* Error message */
.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: var(--color-error);
}

.error-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.error-text {
  flex: 1;
  font-size: 0.875rem;
}

.error-close {
  background-color: transparent;
  color: var(--color-error);
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.error-close:hover {
  transform: scale(1.1);
  color: #dc2626;
}
</style>
