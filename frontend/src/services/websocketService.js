/**
 * WebSocket Service
 * Manages WebSocket connection to the proxy server and handles message formatting
 */

export class WebSocketService {
  constructor(url = 'ws://localhost:8080/ws') {
    this.url = url
    this.ws = null
    this.listeners = new Map()
    this.messageQueue = []
    this.isConnected = false
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.isConnected = true
          this.flushMessageQueue()
          this.emit('open')
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.emit('message', data)
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e)
          }
        }

        this.ws.onerror = (error) => {
          this.isConnected = false
          this.emit('error', error)
          reject(error)
        }

        this.ws.onclose = () => {
          this.isConnected = false
          this.emit('close')
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  /**
   * Send message through WebSocket
   * @param {Object} message - Message object to send
   */
  send(message) {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  /**
   * Send audio input chunk
   * @param {string} base64Audio - Base64-encoded PCM audio data
   * @param {string} eventId - Event ID for tracking
   */
  sendAudioInput(base64Audio, eventId) {
    const message = {
      event_id: eventId,
      type: 'input_audio_buffer.append',
      audio: base64Audio
    }
    this.send(message)
  }

  /**
   * Send session update with configuration
   * @param {string} eventId - Event ID for tracking
   * @param {Object} options - Configuration options
   */
  sendSessionUpdate(eventId, options = {}) {
    const message = {
      event_id: eventId,
      type: 'session.update',
      session: {
        modalities: options.modalities || ['text'],
        input_audio_format: 'pcm',
        sample_rate: options.sample_rate || 16000,
        input_audio_transcription: {
          language: options.language || 'zh'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: options.threshold || 0.2,
          silence_duration_ms: options.silence_duration_ms || 800
        },
        ...options.session
      }
    }
    this.send(message)
  }

  /**
   * Send input audio buffer commit message
   * @param {string} eventId - Event ID for tracking
   */
  sendCommit(eventId) {
    const message = {
      event_id: eventId,
      type: 'input_audio_buffer.commit'
    }
    this.send(message)
  }

  /**
   * Register event listener
   * @param {string} event - Event name ('open', 'close', 'message', 'error')
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in ${event} listener:`, error)
        }
      })
    }
  }

  /**
   * Flush queued messages when connection is ready
   * @private
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (this.ws && this.isConnected) {
        this.ws.send(JSON.stringify(message))
      }
    }
  }
}

export default WebSocketService
