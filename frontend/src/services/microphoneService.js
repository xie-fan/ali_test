/**
 * Microphone Service
 * Handles audio capture from user's microphone using Web Audio API
 */

import { processAudioChunk } from '../utils/pcm.js'

export class MicrophoneService {
  constructor(options = {}) {
    this.audioContext = null
    this.mediaStream = null
    this.processor = null
    this.analyzer = null
    this.isRecording = false

    // Configuration
    this.targetSampleRate = options.targetSampleRate || 16000
    this.chunkDurationMs = options.chunkDurationMs || 100
    this.onAudioChunk = options.onAudioChunk || (() => {})
    this.onError = options.onError || (() => {})
    this.onStatusChange = options.onStatusChange || (() => {})

    // Audio buffer for accumulating samples
    this.audioBuffer = []
    this.currentBufferDuration = 0
  }

  /**
   * Request microphone access and initialize audio processing
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.onStatusChange('requesting_permission')

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      })

      this.onStatusChange('initializing')

      // Initialize audio context
      const audioContextClass = window.AudioContext || window.webkitAudioContext
      this.audioContext = new audioContextClass()

      // Create source from media stream
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Create script processor for raw audio access
      // Use 4096 sample buffer size (typical size)
      const bufferSize = 4096
      if (this.audioContext.createScriptProcessor) {
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)
      } else {
        // Fallback: try to use AudioWorklet if available
        try {
          await this.setupAudioWorklet(source)
          this.onStatusChange('recording')
          this.isRecording = true
          return
        } catch (e) {
          this.onError('AudioWorklet not available, falling back to ScriptProcessor')
        }
      }

      // Connect the audio graph
      source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      // Handle audio data
      this.processor.onaudioprocess = (event) => {
        this.handleAudioData(event)
      }

      // Create analyzer for volume detection (optional, for UI feedback)
      this.analyzer = this.audioContext.createAnalyser()
      source.connect(this.analyzer)

      this.onStatusChange('recording')
      this.isRecording = true
    } catch (error) {
      this.handleStartError(error)
    }
  }

  /**
   * Setup AudioWorklet for better performance (optional)
   * @private
   */
  async setupAudioWorklet(source) {
    try {
      // Try to load and initialize AudioWorklet
      // For now, we'll skip this and rely on ScriptProcessor
      throw new Error('AudioWorklet setup deferred')
    } catch (e) {
      throw e
    }
  }

  /**
   * Stop microphone capture
   */
  stop() {
    this.isRecording = false
    this.onStatusChange('stopping')

    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }

    if (this.analyzer) {
      this.analyzer.disconnect()
      this.analyzer = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close()
      }
      this.audioContext = null
    }

    this.audioBuffer = []
    this.currentBufferDuration = 0
    this.onStatusChange('stopped')
  }

  /**
   * Handle audio processing callback
   * @private
   */
  handleAudioData(event) {
    if (!this.isRecording) {
      return
    }

    const inputData = event.inputBuffer.getChannelData(0)
    const sampleRate = this.audioContext.sampleRate

    // Accumulate audio data
    this.audioBuffer.push(new Float32Array(inputData))

    // Calculate accumulated duration
    const samplesPerChunk = (sampleRate / 1000) * this.chunkDurationMs
    let totalSamples = 0
    for (let i = 0; i < this.audioBuffer.length; i++) {
      totalSamples += this.audioBuffer[i].length
    }

    // If we have enough samples, send a chunk
    if (totalSamples >= samplesPerChunk) {
      this.sendAudioChunk(sampleRate)
    }
  }

  /**
   * Send accumulated audio chunk
   * @private
   */
  sendAudioChunk(sampleRate) {
    if (this.audioBuffer.length === 0) {
      return
    }

    // Combine audio buffers
    let totalLength = 0
    for (let i = 0; i < this.audioBuffer.length; i++) {
      totalLength += this.audioBuffer[i].length
    }

    const combinedBuffer = new Float32Array(totalLength)
    let offset = 0
    for (let i = 0; i < this.audioBuffer.length; i++) {
      combinedBuffer.set(this.audioBuffer[i], offset)
      offset += this.audioBuffer[i].length
    }

    // Process and send
    try {
      const base64Audio = processAudioChunk(combinedBuffer, sampleRate, this.targetSampleRate)
      this.onAudioChunk(base64Audio)

      // Reset buffer
      this.audioBuffer = []
      this.currentBufferDuration = 0
    } catch (error) {
      this.onError(`Failed to process audio chunk: ${error.message}`)
    }
  }

  /**
   * Get current volume level (0-100)
   * @returns {number} Volume level
   */
  getVolume() {
    if (!this.analyzer) {
      return 0
    }

    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount)
    this.analyzer.getByteFrequencyData(dataArray)

    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const average = sum / dataArray.length
    return Math.min(100, Math.round((average / 255) * 100))
  }

  /**
   * Handle errors when starting microphone
   * @private
   */
  handleStartError(error) {
    let errorMessage = 'Unknown error'

    if (error.name === 'NotAllowedError') {
      errorMessage = 'Microphone permission denied'
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No microphone found'
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Microphone is already in use'
    } else if (error.name === 'TypeError') {
      errorMessage = 'getUserMedia not supported'
    } else {
      errorMessage = error.message
    }

    this.onStatusChange('error')
    this.onError(errorMessage)
  }

  /**
   * Check if microphone is currently recording
   * @returns {boolean}
   */
  isActive() {
    return this.isRecording
  }
}

export default MicrophoneService
