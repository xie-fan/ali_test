# Ali Relay Architecture Documentation

## Overview

The Ali Relay system implements a bidirectional WebSocket proxy that translates between a simplified frontend protocol and Aliyun's OpenAI-compatible DashScope ASR API.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Browser/Frontend Client                                     │
│ (Connects via WebSocket to /ws)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │ Handler.ServeWS()       │
        │ (HTTP Upgrade)          │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │ Client Structure        │
        │ - conn                  │
        │ - relay (AliRelay)      │
        │ - send channel          │
        └────────────┬────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    │                │                │
┌───▼────────┐  ┌───▼───────┐  ┌────▼──────────┐
│ readPump() │  │writePump()│  │ AliRelay      │
│            │  │           │  │ (manages Ali) │
│ Client→    │  │ ←Backend  │  │               │
│ Relay      │  │ Channel   │  │ Ali←→↓↑→ Ali  │
└───┬────────┘  └───┬───────┘  └────┬──────────┘
    │               │               │
    └───────────┬───┴───────────────┘
                │
┌───────────────▼──────────────────────────────┐
│ Ali ASR WebSocket Connection                 │
│ (wss://dashscope.aliyuncs.com/api-ws/v1/...) │
└────────────────────────────────────────────────┘
```

## Message Flow

### 1. Client Connection

```
Browser WebSocket
       ↓
Handler.ServeWS() → Upgrade HTTP to WebSocket
       ↓
New Client created with relay
       ↓
Client.readPump() and Client.writePump() started
       ↓
AliRelay.Start() → Connect to Ali service
```

### 2. Client Message Processing

```
Frontend Message (JSON)
{
  "type": "config|audio_chunk|stop",
  "payload": {...}
}
       ↓
Client.readPump() receives message
       ↓
AliRelay.ProcessClientMessage()
       ↓
Translate to Ali protocol
       ↓
Queue in aliSend channel
       ↓
AliRelay.aliWritePump() sends to Ali
```

### 3. Ali Response Processing

```
Ali WebSocket Message
{
  "type": "conversation.item.input_audio_transcription.completed",
  "transcript": "hello world",
  ...
}
       ↓
AliRelay.aliReadPump() receives
       ↓
AliRelay.handleAliMessage()
       ↓
Transform to Frontend Response:
{
  "type": "transcript",
  "data": {
    "text": "hello world",
    "status": "final"
  }
}
       ↓
Queue in client.send channel
       ↓
Client.writePump() sends to browser
```

## Core Components

### AliRelay Structure

```go
type AliRelay struct {
    aliConn        *websocket.Conn        // Connection to Ali
    aliConnMux     sync.Mutex             // Protects aliConn
    clientSend     chan []byte            // Send to frontend
    aliSend        chan *AliMessage       // Send to Ali
    done           chan struct{}          // Shutdown signal
    logger         *logger.Logger
    baseURL        string                 // Ali API URL
    apiKey         string                 // Authorization
    model          string                 // Model name
    sessionConfig  *SessionConfig         // Current config
    sessionMux     sync.RWMutex           // Protects config
    eventIDCounter int                    // For event IDs
    eventIDMux     sync.Mutex             // Protects counter
}
```

### Message Translation

#### Frontend Config → Ali session.update

**Frontend:**
```json
{
  "type": "config",
  "payload": {
    "modalities": ["text"],
    "input_audio_format": "pcm",
    "sample_rate": 16000,
    "input_audio_transcription": {"language": "zh"},
    "turn_detection": {"type": "server_vad", "threshold": 0.2}
  }
}
```

**Translated to Ali:**
```json
{
  "event_id": "event_1",
  "type": "session.update",
  "session": {
    "modalities": ["text"],
    "input_audio_format": "pcm",
    "sample_rate": 16000,
    "input_audio_transcription": {"language": "zh"},
    "turn_detection": {"type": "server_vad", "threshold": 0.2}
  }
}
```

#### Frontend Audio Chunk → Ali input_audio_buffer.append

**Frontend:**
```json
{
  "type": "audio_chunk",
  "payload": {
    "audio": "AAECAwQFBgcICQoLDA0ODxAREhM..."
  }
}
```

**Translated to Ali:**
```json
{
  "event_id": "event_2",
  "type": "input_audio_buffer.append",
  "audio": "AAECAwQFBgcICQoLDA0ODxAREhM..."
}
```

#### Frontend Stop → Ali input_audio_buffer.commit

**Frontend:**
```json
{
  "type": "stop",
  "payload": {}
}
```

**Translated to Ali:**
```json
{
  "event_id": "event_3",
  "type": "input_audio_buffer.commit"
}
```

### Concurrency Model

The system uses three goroutines per client:

1. **readPump()** - Client → Relay
   - Reads WebSocket messages from frontend
   - Validates and processes through relay
   - Closes relay on disconnect

2. **writePump()** - Relay → Client
   - Sends messages from client.send channel to WebSocket
   - Handles write timeouts and errors

3. **aliReadPump()** - Ali → Relay
   - Reads from Ali WebSocket
   - Processes responses and forwards to client
   - Handles reconnection

4. **aliWritePump()** - Relay → Ali
   - Sends messages from aliSend channel to Ali
   - Handles write timeouts and errors

5. **heartbeatPump()** - Connection maintenance
   - Sends periodic ping messages to Ali
   - Detects dead connections

### Synchronization

- **aliConnMux**: Protects aliConn to prevent concurrent access
- **sessionMux**: Protects sessionConfig for thread-safe reads/writes
- **eventIDMux**: Protects eventIDCounter for unique event IDs
- **Channels**: Decouple reader/writer goroutines

## Error Handling

### Base64 Validation

```go
func validateBase64(s string) error {
    _, err := base64.StdEncoding.DecodeString(s)
    return err
}
```

Rejects invalid base64 audio with error response to client.

### Ali Connection Failures

```
Write error detected
    ↓
Disconnect from Ali
    ↓
Attempt reconnection (up to 3 times)
    ↓
Wait 1 second between attempts
    ↓
Queue dropped message for retry
    ↓
Log error for debugging
```

### Graceful Shutdown

```
Client disconnects
    ↓
readPump() defers cleanup:
  - Call relay.Stop()
  - Close send channel
  - Cancel context
  - Close WebSocket
    ↓
relay.Stop() closes aliSend channel
    ↓
All goroutines exit cleanly
```

## Timeout and Interval Configuration

```go
const (
    heartbeatInterval = 30 * time.Second        // Ping interval
    reconnectAttempts = 3                       // Retry count
    reconnectDelay    = 1 * time.Second         // Retry delay
    writeTimeout      = 10 * time.Second        // Write deadline
    readTimeout       = 15 * time.Second        // Read deadline
)
```

## Protocol Validation

### Config Message Validation

- Required fields: type, payload
- Payload fields checked for valid types
- Language code validated if provided

### Audio Chunk Validation

- Audio field must not be empty
- Audio must be valid base64
- Decoded size validates memory usage

### Unknown Message Types

Logged but not processed:
```go
default:
    relay.logger.Debugf("ignoring Ali message type: %s", msgType)
```

## Performance Considerations

### Buffering

- Client send channel: 256 bytes buffered
- Ali send channel: 64 messages buffered
- Prevents blocking reads/writes

### Resource Cleanup

- Per-connection Ali WebSocket
- Closed on client disconnect
- Prevents connection leaks

### Concurrent Connections

- Each client gets isolated Ali connection
- No connection pooling (each client is independent)
- Scales with frontend load

## Testing

Unit tests validate:

1. **Message Translation**
   - Config → session.update
   - Audio → input_audio_buffer.append
   - Stop → input_audio_buffer.commit

2. **Base64 Validation**
   - Valid base64 accepted
   - Invalid base64 rejected
   - Empty audio rejected

3. **Response Translation**
   - Ali transcription → frontend transcript
   - Ali transcript delta → interim status

4. **Event ID Generation**
   - Sequential IDs generated
   - No duplicates

## Debugging

Enable debug logging:

```bash
# Default logging includes info level
LISTEN_ADDR=localhost:8080 DASHSCOPE_API_KEY=sk-xxx go run ./cmd/server
```

Monitor logs for:
- Client connection/disconnection
- Ali relay start/stop
- Message processing
- Connection errors
- Reconnection attempts

Example debug output:
```
[INFO]  client connected from 127.0.0.1:54321
[DEBUG] queued session.update to Ali
[DEBUG] queued audio chunk to Ali (size: 3200 bytes)
[DEBUG] sent final transcript to client
[INFO]  client 127.0.0.1:54321 disconnected
```
