export interface WebSocketMessage {
  type: string
  data?: unknown
}

export interface WebSocketEvent {
  type: 'connect' | 'disconnect' | 'message' | 'error'
  data?: unknown
}

export type WebSocketEventHandler = (event: WebSocketEvent) => void
