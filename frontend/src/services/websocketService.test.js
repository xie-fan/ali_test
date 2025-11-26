import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import WebSocketService from './websocketService.js'

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    this.sentMessages = []
  }

  send(data) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = 3
  }
}

// Replace global WebSocket
global.WebSocket = MockWebSocket

describe('WebSocketService', () => {
  let service
  let mockWs

  beforeEach(() => {
    service = new WebSocketService('ws://test.local/ws')
  })

  afterEach(() => {
    if (service) {
      service.disconnect()
    }
  })

  describe('connect', () => {
    it('should create a WebSocket connection', async () => {
      const connectPromise = service.connect()
      
      // Simulate successful connection
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await connectPromise
      expect(service.isConnected).toBe(true)
    })

    it('should emit open event on connection', (done) => {
      service.on('open', () => {
        expect(service.isConnected).toBe(true)
        done()
      })

      const connectPromise = service.connect()
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)
    })

    it('should emit error event on connection failure', (done) => {
      service.on('error', (error) => {
        expect(error).toBeDefined()
        done()
      })

      const connectPromise = service.connect()
      setTimeout(() => {
        if (service.ws && service.ws.onerror) {
          service.ws.onerror(new Error('Connection failed'))
        }
      }, 0)

      connectPromise.catch(() => {})
    })
  })

  describe('send', () => {
    it('should send message when connected', async () => {
      service.connect()
      
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await new Promise(resolve => setTimeout(resolve, 10))

      const message = { type: 'test', data: 'hello' }
      service.send(message)

      expect(service.ws.sentMessages.length).toBe(1)
      expect(JSON.parse(service.ws.sentMessages[0])).toEqual(message)
    })

    it('should queue message when not connected', () => {
      const message = { type: 'test', data: 'hello' }
      service.send(message)

      expect(service.messageQueue.length).toBe(1)
      expect(service.messageQueue[0]).toEqual(message)
    })

    it('should flush queue when connection opens', async () => {
      const message1 = { type: 'test1', data: 'hello' }
      const message2 = { type: 'test2', data: 'world' }

      service.send(message1)
      service.send(message2)

      expect(service.messageQueue.length).toBe(2)

      service.connect()
      
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(service.messageQueue.length).toBe(0)
      expect(service.ws.sentMessages.length).toBe(2)
    })
  })

  describe('sendAudioInput', () => {
    it('should format audio message correctly', async () => {
      service.connect()
      
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await new Promise(resolve => setTimeout(resolve, 10))

      const base64Audio = 'SGVsbG8gV29ybGQ='
      const eventId = 'test_event_123'
      
      service.sendAudioInput(base64Audio, eventId)

      const sentMessage = JSON.parse(service.ws.sentMessages[0])
      expect(sentMessage.event_id).toBe(eventId)
      expect(sentMessage.type).toBe('input_audio_buffer.append')
      expect(sentMessage.audio).toBe(base64Audio)
    })
  })

  describe('sendSessionUpdate', () => {
    it('should format session update message correctly', async () => {
      service.connect()
      
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await new Promise(resolve => setTimeout(resolve, 10))

      const eventId = 'session_event_123'
      
      service.sendSessionUpdate(eventId, {
        language: 'en',
        sample_rate: 16000
      })

      const sentMessage = JSON.parse(service.ws.sentMessages[0])
      expect(sentMessage.event_id).toBe(eventId)
      expect(sentMessage.type).toBe('session.update')
      expect(sentMessage.session.input_audio_format).toBe('pcm')
      expect(sentMessage.session.sample_rate).toBe(16000)
      expect(sentMessage.session.input_audio_transcription.language).toBe('en')
    })

    it('should include default values', async () => {
      service.connect()
      
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await new Promise(resolve => setTimeout(resolve, 10))

      service.sendSessionUpdate('event_1')

      const sentMessage = JSON.parse(service.ws.sentMessages[0])
      expect(sentMessage.session.sample_rate).toBe(16000)
      expect(sentMessage.session.modalities).toEqual(['text'])
      expect(sentMessage.session.turn_detection.type).toBe('server_vad')
    })
  })

  describe('sendCommit', () => {
    it('should format commit message correctly', async () => {
      service.connect()
      
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await new Promise(resolve => setTimeout(resolve, 10))

      const eventId = 'commit_event_123'
      
      service.sendCommit(eventId)

      const sentMessage = JSON.parse(service.ws.sentMessages[0])
      expect(sentMessage.event_id).toBe(eventId)
      expect(sentMessage.type).toBe('input_audio_buffer.commit')
    })
  })

  describe('event listeners', () => {
    it('should register and emit events', () => {
      const callback = vi.fn()
      service.on('test', callback)
      
      service.emit('test', { data: 'hello' })
      
      expect(callback).toHaveBeenCalledWith({ data: 'hello' })
    })

    it('should remove event listeners', () => {
      const callback = vi.fn()
      service.on('test', callback)
      service.off('test', callback)
      
      service.emit('test', { data: 'hello' })
      
      expect(callback).not.toHaveBeenCalled()
    })

    it('should support multiple listeners', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      service.on('test', callback1)
      service.on('test', callback2)
      
      service.emit('test', { data: 'hello' })
      
      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      service.connect()
      
      setTimeout(() => {
        if (service.ws && service.ws.onopen) {
          service.ws.onopen()
        }
      }, 0)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(service.isConnected).toBe(true)
      service.disconnect()
      expect(service.isConnected).toBe(false)
      expect(service.ws).toBeNull()
    })
  })
})
