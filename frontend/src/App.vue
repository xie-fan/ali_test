<template>
  <div id="app">
    <ConnectionStatus />
    <main class="main-content">
      <div class="container">
        <header class="app-header">
          <h1>Qwen Real-Time API Client</h1>
          <p class="subtitle">Record audio or upload files for real-time transcription</p>
        </header>

        <div class="layout">
          <div class="controls-section">
            <div class="card">
              <h3>Controls</h3>
              <div class="controls-grid">
                <RecordButton />
                <FileUpload />
              </div>
            </div>
          </div>

          <div class="transcript-section">
            <TranscriptPanel />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import ConnectionStatus from '@/components/ConnectionStatus.vue'
import RecordButton from '@/components/RecordButton.vue'
import FileUpload from '@/components/FileUpload.vue'
import TranscriptPanel from '@/components/TranscriptPanel.vue'
</script>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.app-header {
  margin-bottom: var(--spacing-2xl);
  text-align: center;
}

.app-header h1 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text);
}

.subtitle {
  color: var(--color-text-light);
  font-size: 1.125rem;
  margin: 0;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xl);
  height: calc(100vh - 200px);
}

.controls-section,
.transcript-section {
  display: flex;
  flex-direction: column;
}

.card {
  background-color: white;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-md);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card h3 {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-text);
}

.controls-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  flex: 1;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .main-content {
    padding: var(--spacing-lg);
  }
}

@media (max-width: 768px) {
  .app-header h1 {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .container {
    padding: 0;
  }

  .main-content {
    padding: var(--spacing-md);
  }
}
</style>
