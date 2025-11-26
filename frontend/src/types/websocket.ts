export interface WebSocketMessage {
  type: string
  data?: unknown
  event_id?: string
  session?: unknown
}

export interface WebSocketEvent {
  type: 'connect' | 'disconnect' | 'message' | 'error'
  data?: unknown
}

export type WebSocketEventHandler = (event: WebSocketEvent) => void

// Audio-related message types for streaming
export interface AudioBufferAppendMessage extends WebSocketMessage {
  type: 'input_audio_buffer.append'
  data: {
    audio_data: string // base64 encoded PCM data
  }
}

export interface AudioBufferCommitMessage extends WebSocketMessage {
  type: 'input_audio_buffer.commit'
  data: Record<string, unknown>
}
