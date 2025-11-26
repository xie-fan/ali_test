import { ref, onMounted, onUnmounted } from 'vue'
import { getWebSocketService } from '@/services/websocket'
import type { WebSocketMessage, WebSocketEvent } from '@/types/websocket'

export function useWebSocket() {
  const ws = getWebSocketService()
  const connectionStatus = ref<'connected' | 'connecting' | 'disconnected'>(
    ws.getConnectionStatus()
  )
  const lastMessage = ref<WebSocketMessage | null>(null)
  const error = ref<Error | null>(null)
  const queuedMessages = ref(0)

  const handleConnect = () => {
    connectionStatus.value = 'connected'
    error.value = null
    queuedMessages.value = 0
  }

  const handleDisconnect = () => {
    connectionStatus.value = 'disconnected'
  }

  const handleMessage = (event: WebSocketEvent) => {
    lastMessage.value = event.data as WebSocketMessage
  }

  const handleError = (event: WebSocketEvent) => {
    error.value = event.data instanceof Error ? event.data : new Error(String(event.data))
  }

  const connect = async () => {
    try {
      connectionStatus.value = 'connecting'
      await ws.connect()
    } catch (err) {
      connectionStatus.value = 'disconnected'
      error.value = err instanceof Error ? err : new Error(String(err))
    }
  }

  const disconnect = () => {
    ws.disconnect()
    connectionStatus.value = 'disconnected'
  }

  const send = (message: WebSocketMessage) => {
    ws.send(message)
    queuedMessages.value = ws.getQueuedMessageCount()
  }

  onMounted(() => {
    const unsubConnect = ws.on('connect', handleConnect)
    const unsubDisconnect = ws.on('disconnect', handleDisconnect)
    const unsubMessage = ws.on('message', handleMessage)
    const unsubError = ws.on('error', handleError)

    // Auto-connect on mount
    connect()

    onUnmounted(() => {
      unsubConnect()
      unsubDisconnect()
      unsubMessage()
      unsubError()
    })
  })

  return {
    connectionStatus,
    lastMessage,
    error,
    queuedMessages,
    connect,
    disconnect,
    send,
  }
}
