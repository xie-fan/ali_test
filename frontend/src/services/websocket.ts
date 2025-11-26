import type { WebSocketMessage, WebSocketEventHandler } from '@/types/websocket'

const DEFAULT_RECONNECT_INTERVAL = 3000
const MAX_RECONNECT_ATTEMPTS = 10

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private messageQueue: WebSocketMessage[] = []
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map()
  private reconnectInterval: number = DEFAULT_RECONNECT_INTERVAL
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = MAX_RECONNECT_ATTEMPTS
  private isManualClose: boolean = false
  private reconnectTimeout: number | null = null

  constructor(url?: string) {
    this.url = url || this.getBackendUrl()
  }

  private getBackendUrl(): string {
    const protocol = import.meta.env.VITE_WS_PROTOCOL || 'ws'
    const host = import.meta.env.VITE_WS_HOST || 'localhost'
    const port = import.meta.env.VITE_WS_PORT || '8080'
    return `${protocol}://${host}:${port}/ws`
  }

  private emit(eventType: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      handlers.forEach((handler) => {
        handler({ type: eventType as any, data })
      })
    }
  }

  public on(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set())
    }
    this.eventHandlers.get(eventType)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler)
    }
  }

  public off(eventType: string, handler: WebSocketEventHandler): void {
    this.eventHandlers.get(eventType)?.delete(handler)
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      this.isManualClose = false
      const ws = new WebSocket(this.url)

      ws.onopen = () => {
        this.ws = ws
        this.reconnectAttempts = 0
        this.emit('connect')

        // Process queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift()
          if (message) {
            this.send(message)
          }
        }

        resolve()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.emit('message', message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        this.emit('error', error)
        reject(error)
      }

      ws.onclose = () => {
        this.ws = null
        this.emit('disconnect')

        if (!this.isManualClose) {
          this.attemptReconnect()
        }
      }
    })
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.emit('error', new Error('Max reconnection attempts reached'))
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1)

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }

  public send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      // Queue message if not connected
      this.messageQueue.push(message)
    }
  }

  public disconnect(): void {
    this.isManualClose = true

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.messageQueue = []
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  public getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.ws === null) {
      return 'disconnected'
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      return 'connected'
    }

    return 'connecting'
  }

  public getQueuedMessageCount(): number {
    return this.messageQueue.length
  }
}

// Singleton instance
let wsInstance: WebSocketService | null = null

export function getWebSocketService(url?: string): WebSocketService {
  if (!wsInstance) {
    wsInstance = new WebSocketService(url)
  }
  return wsInstance
}
