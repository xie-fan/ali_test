import { ref, computed } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'
import {
  isSupportedAudioFormat,
  processAudioFile,
  validateAudioFileSize,
  type AudioProcessingOptions,
} from '@/utils/audioProcessor'

export interface FileUploadState {
  file: File | null
  isUploading: boolean
  isPaused: boolean
  progress: number
  currentChunk: number
  totalChunks: number
  error: string | null
}

export function useFileUpload(processingOptions: AudioProcessingOptions = {}) {
  const { send, connectionStatus } = useWebSocket()

  const state = ref<FileUploadState>({
    file: null,
    isUploading: false,
    isPaused: false,
    progress: 0,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
  })

  let uploadAbortController: AbortController | null = null

  const progressPercent = computed(() => {
    if (state.value.totalChunks === 0) return 0
    return Math.round((state.value.currentChunk / state.value.totalChunks) * 100)
  })

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!isSupportedAudioFormat(file)) {
      return `Unsupported file format. Supported formats: WAV, MP3, MP4, OGG, FLAC`
    }

    // Check file size (max 100MB)
    if (!validateAudioFileSize(file, 100)) {
      return 'File size exceeds 100MB limit'
    }

    return null
  }

  const uploadFile = async (file: File) => {
    // Validate connection
    if (connectionStatus.value !== 'connected') {
      state.value.error = 'WebSocket is not connected. Please wait and try again.'
      return
    }

    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      state.value.error = validationError
      return
    }

    state.value.file = file
    state.value.isUploading = true
    state.value.isPaused = false
    state.value.error = null
    state.value.progress = 0
    uploadAbortController = new AbortController()

    try {
      // Process audio file
      console.log('Processing audio file:', file.name)
      const audioData = await processAudioFile(file, processingOptions)

      state.value.totalChunks = audioData.chunks.length

      console.log(
        `Audio processing complete. Chunks: ${audioData.chunks.length}, Duration: ${audioData.duration.toFixed(2)}s, Sample Rate: ${audioData.sampleRate}Hz`
      )

      // Send chunks
      for (let i = 0; i < audioData.chunks.length; i++) {
        // Check if upload was cancelled
        if (uploadAbortController?.signal.aborted) {
          state.value.error = 'Upload cancelled'
          state.value.isUploading = false
          state.value.file = null
          return
        }

        // Handle pause
        while (state.value.isPaused) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        // Send chunk
        const chunkData = audioData.chunks[i]
        send({
          type: 'input_audio_buffer.append',
          data: {
            audio_data: chunkData,
          },
        })

        state.value.currentChunk = i + 1
        state.value.progress = progressPercent.value

        console.log(`Sent chunk ${i + 1}/${audioData.chunks.length}`)

        // Add small delay between chunks to avoid overwhelming the connection
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Send commit message to finalize
      console.log('Sending input_audio_buffer.commit')
      send({
        type: 'input_audio_buffer.commit',
        data: {},
      })

      state.value.isUploading = false
      state.value.progress = 100

      // Reset after successful upload
      setTimeout(() => {
        state.value.file = null
        state.value.progress = 0
        state.value.currentChunk = 0
        state.value.totalChunks = 0
      }, 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      state.value.error = errorMessage
      state.value.isUploading = false
      console.error('Upload error:', errorMessage)
    } finally {
      uploadAbortController = null
    }
  }

  const pauseUpload = () => {
    if (state.value.isUploading && !state.value.isPaused) {
      state.value.isPaused = true
    }
  }

  const resumeUpload = () => {
    if (state.value.isPaused) {
      state.value.isPaused = false
    }
  }

  const cancelUpload = () => {
    if (state.value.isUploading) {
      uploadAbortController?.abort()
      state.value.isUploading = false
      state.value.isPaused = false
      state.value.error = 'Upload cancelled'
      state.value.file = null
      state.value.progress = 0
      state.value.currentChunk = 0
      state.value.totalChunks = 0
    }
  }

  const clearError = () => {
    state.value.error = null
  }

  return {
    state: state.value,
    progressPercent,
    uploadFile,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearError,
  }
}
