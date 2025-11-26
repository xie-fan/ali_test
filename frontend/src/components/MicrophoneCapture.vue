<template>
  <div class="mic-capture">
    <div class="container">
      <div class="header">
        <h1>🎤 Qwen Real-time Transcription</h1>
        <p class="subtitle">Speak and see live transcription updates</p>
      </div>

      <div class="status-section">
        <div :class="['status-card', statusClass]">
          <div class="status-indicator">
            <span :class="['dot', statusClass]"></span>
            <span class="status-text">{{ statusLabel }}</span>
          </div>
          <div v-if="error" class="error-message">
            {{ error }}
          </div>
        </div>
      </div>

      <div class="controls-section">
        <button
          @click="toggleRecording"
          :disabled="isConnecting || (isRecording && wsService && !wsService.isConnected)"
          :class="['btn', 'btn-primary', { active: isRecording, disabled: isConnecting }]"
        >
          <span v-if="!isRecording">🎙️ Start Recording</span>
          <span v-else>⏹️ Stop Recording</span>
        </button>

        <button
          @click="reset"
          :disabled="!isRecording && transcript.length === 0"
          class="btn btn-secondary"
        >
          🔄 Clear
        </button>
      </div>

      <div class="volume-meter" v-if="isRecording">
        <div class="volume-label">Volume</div>
        <div class="volume-bar">
          <div class="volume-fill" :style="{ width: volume + '%' }"></div>
        </div>
        <div class="volume-value">{{ volume }}%</div>
      </div>

      <div class="stats-section">
        <div class="stat">
          <span class="stat-label">Audio Duration:</span>
          <span class="stat-value">{{ formattedDuration }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Chunks Sent:</span>
          <span class="stat-value">{{ chunksSent }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Connection:</span>
          <span :class="['stat-value', wsService?.isConnected ? 'connected' : 'disconnected']">
            {{ wsService?.isConnected ? '✓ Connected' : '✗ Disconnected' }}
          </span>
        </div>
      </div>

      <div class="transcript-section">
        <div class="transcript-header">Live Transcript</div>
        <div class="transcript-box">
          <div v-if="transcript.length === 0" class="transcript-placeholder">
            <p>Start recording to see transcription results here...</p>
          </div>
          <div v-else class="transcript-content">
            <div v-for="(item, index) in transcript" :key="index" :class="['transcript-item', item.type]">
              <span class="transcript-type">{{ item.type === 'partial' ? '▌' : '✓' }}</span>
              <span class="transcript-text">{{ item.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="debugMode" class="debug-section">
        <div class="debug-header">Debug Info</div>
        <div class="debug-content">
          <div class="debug-item">
            <span class="debug-label">Mic Status:</span>
            <span class="debug-value">{{ micStatus }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Last Message:</span>
            <span class="debug-value">{{ lastMessage }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Audio Context:</span>
            <span class="debug-value">{{ audioContext }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import WebSocketService from '../services/websocketService.js'
import MicrophoneService from '../services/microphoneService.js'

export default {
  name: 'MicrophoneCapture',
  setup() {
    const isRecording = ref(false)
    const isConnecting = ref(false)
    const status = ref('disconnected') // disconnected, connecting, connected, recording, error
    const error = ref('')
    const volume = ref(0)
    const transcript = ref([])
    const chunksSent = ref(0)
    const elapsedSeconds = ref(0)
    const debugMode = ref(false)
    const micStatus = ref('idle')
    const lastMessage = ref('none')
    const audioContext = ref('not initialized')

    let wsService = null
    let micService = null
    let volumeUpdateInterval = null
    let elapsedTimeInterval = null
    let eventIdCounter = 0

    const statusLabel = computed(() => {
      const labels = {
        disconnected: '⚫ Disconnected',
        connecting: '🟡 Connecting...',
        connected: '🟢 Connected',
        recording: '🔴 Recording',
        error: '🔴 Error'
      }
      return labels[status.value] || 'Unknown'
    })

    const statusClass = computed(() => {
      const classes = {
        disconnected: 'disconnected',
        connecting: 'connecting',
        connected: 'connected',
        recording: 'recording',
        error: 'error'
      }
      return classes[status.value] || 'disconnected'
    })

    const formattedDuration = computed(() => {
      const minutes = Math.floor(elapsedSeconds.value / 60)
      const seconds = elapsedSeconds.value % 60
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    })

    const generateEventId = () => {
      eventIdCounter++
      return `event_${Date.now()}_${eventIdCounter}`
    }

    const initializeWebSocket = async () => {
      if (wsService) {
        return
      }

      isConnecting.value = true
      status.value = 'connecting'
      error.value = ''

      try {
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
        wsService = new WebSocketService(wsUrl)

        wsService.on('open', () => {
          status.value = 'connected'
          isConnecting.value = false
          
          // Send session update on connection
          wsService.sendSessionUpdate(generateEventId(), {
            language: 'zh',
            modalities: ['text'],
            sample_rate: 16000
          })
        })

        wsService.on('message', (data) => {
          lastMessage.value = data.type || 'unknown'
          handleWebSocketMessage(data)
        })

        wsService.on('error', (err) => {
          status.value = 'error'
          isConnecting.value = false
          error.value = 'WebSocket connection error'
          console.error('WebSocket error:', err)
        })

        wsService.on('close', () => {
          status.value = 'disconnected'
          isConnecting.value = false
          if (isRecording.value) {
            stopRecording()
          }
        })

        await wsService.connect()
      } catch (err) {
        status.value = 'error'
        isConnecting.value = false
        error.value = `Failed to connect: ${err.message}`
        console.error('Connection error:', err)
      }
    }

    const handleWebSocketMessage = (data) => {
      if (!data.type) {
        return
      }

      // Handle transcription updates
      if (data.type === 'conversation.item.create') {
        if (data.item && data.item.transcript) {
          addTranscript(data.item.transcript, 'final')
        }
      } else if (data.type === 'response.text.delta') {
        if (data.delta) {
          addTranscript(data.delta, 'partial')
        }
      } else if (data.type === 'response.content_part.done') {
        // Mark the current item as complete
        if (transcript.value.length > 0) {
          const lastItem = transcript.value[transcript.value.length - 1]
          if (lastItem.type === 'partial') {
            lastItem.type = 'final'
          }
        }
      }

      // Handle errors
      if (data.type === 'error') {
        error.value = data.error?.message || 'API Error'
      }
    }

    const addTranscript = (text, type = 'partial') => {
      if (!text) {
        return
      }

      // Find if we're continuing a partial
      if (type === 'partial') {
        let found = false
        for (let i = transcript.value.length - 1; i >= 0; i--) {
          if (transcript.value[i].type === 'partial') {
            transcript.value[i].text += text
            found = true
            break
          }
          if (transcript.value[i].type === 'final') {
            break
          }
        }
        if (!found) {
          transcript.value.push({ text, type })
        }
      } else if (type === 'final') {
        transcript.value.push({ text, type: 'final' })
      }

      // Auto-scroll to bottom (in real Vue, you might use a ref)
      setTimeout(() => {
        const transcriptBox = document.querySelector('.transcript-box')
        if (transcriptBox) {
          transcriptBox.scrollTop = transcriptBox.scrollHeight
        }
      }, 0)
    }

    const startRecording = async () => {
      if (!wsService || !wsService.isConnected) {
        await initializeWebSocket()
      }

      if (!wsService.isConnected) {
        error.value = 'Not connected to server'
        return
      }

      isRecording.value = true
      status.value = 'recording'
      error.value = ''
      chunksSent.value = 0
      elapsedSeconds.value = 0
      transcript.value = []

      // Start microphone capture
      micService = new MicrophoneService({
        targetSampleRate: 16000,
        chunkDurationMs: 100,
        onAudioChunk: (base64Audio) => {
          if (wsService && wsService.isConnected) {
            wsService.sendAudioInput(base64Audio, generateEventId())
            chunksSent.value++
          }
        },
        onError: (errorMsg) => {
          error.value = errorMsg
          stopRecording()
        },
        onStatusChange: (newStatus) => {
          micStatus.value = newStatus
        }
      })

      try {
        await micService.start()

        // Start volume meter update
        volumeUpdateInterval = setInterval(() => {
          if (micService && micService.isActive()) {
            volume.value = micService.getVolume()
          }
        }, 100)

        // Start elapsed time update
        elapsedTimeInterval = setInterval(() => {
          if (isRecording.value) {
            elapsedSeconds.value++
          }
        }, 1000)
      } catch (err) {
        error.value = err.message
        isRecording.value = false
        status.value = 'connected'
      }
    }

    const stopRecording = () => {
      isRecording.value = false

      if (elapsedTimeInterval) {
        clearInterval(elapsedTimeInterval)
        elapsedTimeInterval = null
      }

      if (volumeUpdateInterval) {
        clearInterval(volumeUpdateInterval)
        volumeUpdateInterval = null
      }

      volume.value = 0

      if (micService) {
        micService.stop()
        micService = null
      }

      // Send commit to finalize the session
      if (wsService && wsService.isConnected) {
        wsService.sendCommit(generateEventId())
      }

      status.value = wsService && wsService.isConnected ? 'connected' : 'disconnected'
    }

    const toggleRecording = async () => {
      if (!isRecording.value) {
        await startRecording()
      } else {
        stopRecording()
      }
    }

    const reset = () => {
      transcript.value = []
      chunksSent.value = 0
      elapsedSeconds.value = 0
      error.value = ''
    }

    onMounted(async () => {
      // Auto-connect on mount
      await initializeWebSocket()

      // Enable debug mode with keyboard shortcut (D)
      const handleKeyPress = (e) => {
        if (e.key === 'd' || e.key === 'D') {
          debugMode.value = !debugMode.value
        }
      }
      window.addEventListener('keydown', handleKeyPress)

      onUnmounted(() => {
        window.removeEventListener('keydown', handleKeyPress)
      })
    })

    onUnmounted(() => {
      if (volumeUpdateInterval) {
        clearInterval(volumeUpdateInterval)
      }
      if (elapsedTimeInterval) {
        clearInterval(elapsedTimeInterval)
      }
      if (micService) {
        micService.stop()
      }
      if (wsService) {
        wsService.disconnect()
      }
    })

    return {
      isRecording,
      isConnecting,
      status,
      statusLabel,
      statusClass,
      error,
      volume,
      transcript,
      chunksSent,
      formattedDuration,
      debugMode,
      micStatus,
      lastMessage,
      audioContext,
      toggleRecording,
      reset,
      wsService
    }
  }
}
</script>

<style scoped>
.mic-capture {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 600px;
  padding: 40px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 8px 0;
  font-weight: 700;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.status-section {
  margin-bottom: 25px;
}

.status-card {
  padding: 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
}

.status-card.disconnected {
  background: #f5f5f5;
  border-left: 4px solid #999;
}

.status-card.connecting {
  background: #fffaec;
  border-left: 4px solid #ffa500;
}

.status-card.connected {
  background: #f0f9ff;
  border-left: 4px solid #10b981;
}

.status-card.recording {
  background: #fee;
  border-left: 4px solid #ef4444;
  animation: pulse 0.5s ease-in-out infinite;
}

.status-card.error {
  background: #fef2f2;
  border-left: 4px solid #dc2626;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: none;
}

.dot.recording {
  background: #ef4444;
  animation: blink 0.5s ease-in-out infinite;
}

.dot.connected {
  background: #10b981;
}

.dot.connecting {
  background: #ffa500;
  animation: spin 1s linear infinite;
}

.dot.disconnected {
  background: #999;
}

.dot.error {
  background: #dc2626;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  font-weight: 600;
  color: #333;
}

.error-message {
  color: #dc2626;
  font-size: 13px;
  font-weight: 500;
}

.controls-section {
  display: flex;
  gap: 12px;
  margin-bottom: 25px;
}

.btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary.active {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.btn-secondary {
  background: #f3f4f6;
  color: #333;
  border: 1px solid #e5e7eb;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
  transform: translateY(-2px);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.volume-meter {
  margin-bottom: 25px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.volume-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.volume-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.volume-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #fbbf24 70%, #f87171 100%);
  transition: width 0.1s ease;
}

.volume-value {
  font-size: 12px;
  color: #999;
  text-align: right;
  font-weight: 500;
}

.stats-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 25px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.stat-value.connected {
  color: #10b981;
}

.stat-value.disconnected {
  color: #ef4444;
}

.transcript-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}

.transcript-header {
  font-size: 12px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.transcript-box {
  flex: 1;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
  min-height: 200px;
  max-height: 300px;
}

.transcript-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
  text-align: center;
}

.transcript-placeholder p {
  margin: 0;
}

.transcript-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transcript-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border-radius: 6px;
  background: white;
  border-left: 3px solid #ddd;
}

.transcript-item.partial {
  border-left-color: #fbbf24;
  background: #fffbec;
}

.transcript-item.final {
  border-left-color: #10b981;
  background: #ecfdf5;
}

.transcript-type {
  font-weight: 700;
  color: #999;
  min-width: 16px;
  font-size: 12px;
}

.transcript-text {
  font-size: 14px;
  color: #333;
  word-break: break-word;
  line-height: 1.4;
}

.debug-section {
  margin-top: 20px;
  padding: 12px;
  background: #1f2937;
  border-radius: 8px;
  font-family: monospace;
}

.debug-header {
  color: #10b981;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.debug-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debug-item {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.debug-label {
  color: #9ca3af;
}

.debug-value {
  color: #10b981;
  word-break: break-all;
}

@media (max-width: 600px) {
  .container {
    padding: 24px;
    border-radius: 12px;
    max-height: calc(100vh - 40px);
  }

  .header h1 {
    font-size: 24px;
  }

  .stats-section {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .controls-section {
    flex-direction: column;
  }

  .btn {
    padding: 14px 20px;
    font-size: 14px;
  }

  .transcript-box {
    min-height: 150px;
    max-height: 250px;
  }
}
</style>
