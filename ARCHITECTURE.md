# WebSocket Proxy and Frontend Architecture

## System Overview

This project consists of two main components:

1. **Backend**: Go WebSocket proxy service (in `/cmd` and `/internal`)
2. **Frontend**: Vue 3 real-time microphone capture application (in `/frontend`)

## Backend Architecture

### Go WebSocket Proxy Service

**Purpose**: Acts as a WebSocket proxy between frontend clients and the Aliyun DashScope Qwen Real-time API.

**Key Components**:

- **config** (`internal/config/config.go`): Loads and validates environment configuration
- **logger** (`internal/logger/logger.go`): Structured logging with multiple levels
- **websocket** (`internal/websocket/handler.go`): WebSocket connection handling using readPump/writePump pattern
- **server** (`internal/server/server.go`): HTTP server setup and graceful shutdown

**Features**:
- CORS enabled (CheckOrigin returns true)
- Graceful shutdown with 30-second timeout
- Message buffering with 256-byte channel
- Read limit of 512KB for safety
- Masked API key logging (shows first and last 4 chars)

**WebSocket Endpoints**:
- `/ws`: Main WebSocket endpoint for client connections
- `/health`: Health check endpoint returning `{"status":"ok"}`

## Frontend Architecture

### Vue 3 Microphone Capture Application

**Purpose**: Capture audio from user's microphone, convert to PCM format, and send through WebSocket for real-time transcription.

### Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── MicrophoneCapture.vue      # Main Vue component
│   ├── services/
│   │   ├── microphoneService.js       # Audio capture handling
│   │   ├── microphoneService.test.js  # Microphone service tests
│   │   ├── websocketService.js        # WebSocket connection
│   │   └── websocketService.test.js   # WebSocket service tests
│   ├── utils/
│   │   ├── pcm.js                     # PCM audio utilities
│   │   └── pcm.test.js                # PCM conversion tests
│   ├── App.vue                        # Root component
│   └── main.js                        # Entry point
├── index.html                         # HTML template
├── package.json                       # Dependencies
├── vite.config.js                     # Vite configuration
├── vitest.config.js                   # Test configuration
└── README.md                          # Frontend documentation
```

## Component Details

### 1. MicrophoneCapture Component (`src/components/MicrophoneCapture.vue`)

**Responsibilities**:
- Manage recording start/stop lifecycle
- Display real-time transcription results
- Show connection status and audio statistics
- Handle user interactions (buttons, controls)
- Display volume meter for audio feedback

**Key Features**:
- Beautiful responsive UI with status indicators
- Live transcript display with partial/final items
- Volume meter visualization
- Audio duration tracking
- Error message display
- Debug mode toggle (press 'D')
- Button disable state during connection

**User Flow**:
1. Component mounts and auto-connects to WebSocket
2. User clicks "Start Recording" → Permission request
3. Audio captured and processed into 100ms chunks
4. Chunks sent to backend via WebSocket
5. Backend messages received and displayed as transcriptions
6. User clicks "Stop Recording" → Session committed
7. Cleanup of resources

### 2. MicrophoneService (`src/services/microphoneService.js`)

**Responsibilities**:
- Request microphone permission from user
- Initialize Web Audio API context
- Capture raw audio data using ScriptProcessor
- Buffer and process audio into chunks
- Convert to target format (16kHz mono PCM)

**Technical Details**:
- Uses `navigator.mediaDevices.getUserMedia()`
- Creates `AudioContext` for Web Audio API
- Uses `createScriptProcessor()` for raw audio access (fallback from AudioWorklet)
- Buffers audio with accumulation logic
- Generates chunks at specified intervals (default: 100ms)
- Provides volume detection via frequency analyzer
- Handles all common error cases (permission denied, not found, etc.)

**Error Handling**:
- NotAllowedError: "Microphone permission denied"
- NotFoundError: "No microphone found"
- NotReadableError: "Microphone is already in use"
- TypeError: "getUserMedia not supported"

### 3. WebSocketService (`src/services/websocketService.js`)

**Responsibilities**:
- Manage WebSocket connection lifecycle
- Send formatted messages to backend
- Handle incoming messages
- Queue messages if not connected
- Provide event-based interface for components

**API Methods**:
- `connect()`: Establish connection
- `disconnect()`: Close connection
- `send(message)`: Send generic message
- `sendAudioInput(base64Audio, eventId)`: Send audio chunk
- `sendSessionUpdate(eventId, options)`: Initialize session
- `sendCommit(eventId)`: Finalize audio buffer
- `on(event, callback)`: Register listener
- `off(event, callback)`: Unregister listener

**Message Formats** (per Qwen API spec):

Session Update:
```json
{
  "event_id": "unique_id",
  "type": "session.update",
  "session": {
    "modalities": ["text"],
    "input_audio_format": "pcm",
    "sample_rate": 16000,
    "input_audio_transcription": {"language": "zh"},
    "turn_detection": {"type": "server_vad", "threshold": 0.2, "silence_duration_ms": 800}
  }
}
```

Audio Input:
```json
{
  "event_id": "unique_id",
  "type": "input_audio_buffer.append",
  "audio": "base64-encoded-pcm-data"
}
```

Commit:
```json
{
  "event_id": "unique_id",
  "type": "input_audio_buffer.commit"
}
```

### 4. PCM Audio Utilities (`src/utils/pcm.js`)

**Responsibilities**:
- Convert audio formats for transmission
- Resample to target sample rate
- Convert stereo to mono
- Encode to base64

**Key Functions**:

1. **float32ToPcm16(float32Data)**: Convert float32 samples to 16-bit signed integers
   - Clamps values to [-1, 1] range
   - Scales using 0x7fff for positive, 0x8000 for negative

2. **resampleAudio(audioData, sourceSampleRate, targetSampleRate)**: Resample using linear interpolation
   - Calculates resampling ratio
   - Uses linear interpolation for smooth results
   - Handles edge cases efficiently

3. **stereoToMono(left, right)**: Convert stereo to mono
   - Averages left and right channels
   - Returns original if right channel not provided

4. **processAudioChunk(buffer, currentRate, targetRate)**: End-to-end processing
   - Combines resampling and PCM conversion
   - Produces base64-encoded output
   - Default target rate: 16000 Hz

5. **uint8ArrayToBase64(uint8Array)**: Encode binary data
   - Converts byte array to base64 string
   - Used for transmission over WebSocket

## Audio Processing Pipeline

```
Microphone Input
    ↓
[WebAudio API] → AudioContext → ScriptProcessor
    ↓
[Raw Float32 Audio Data] (48kHz, 32-bit float, stereo/mono)
    ↓
[Microphone Service] accumulates 100ms chunks
    ↓
[PCM Utilities]
    ├─→ Resample to 16kHz
    ├─→ Convert to 16-bit signed integers
    └─→ Encode to base64
    ↓
[WebSocket Service] sends "input_audio_buffer.append"
    ↓
[Backend Proxy] forwards to Aliyun API
    ↓
[Aliyun Qwen API] processes and transcribes
    ↓
[Backend Proxy] returns results
    ↓
[Frontend] displays transcription updates
```

## Testing Strategy

### PCM Utilities Tests (`src/utils/pcm.test.js`)
- ✅ Float32 to PCM16 conversion
- ✅ Clamping behavior
- ✅ Resampling accuracy
- ✅ Stereo to mono conversion
- ✅ Base64 encoding
- ✅ Edge cases (empty arrays, single samples, extreme values)

### WebSocket Service Tests (`src/services/websocketService.test.js`)
- ✅ Connection lifecycle
- ✅ Message sending (connected and queued)
- ✅ Message formatting
- ✅ Event listeners
- ✅ Queue flushing

### Running Tests
```bash
cd frontend
npm test              # Run all tests
npm run test:ui       # Run with UI
```

## Configuration

### Environment Variables

**Backend** (`.env` in project root):
```env
DASHSCOPE_API_KEY=your-api-key
DASHSCOPE_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/realtime
QWEN_MODEL=qwen3-asr-flash-realtime
LISTEN_ADDR=localhost:8080
```

**Frontend** (`.env.local` in `frontend` directory):
```env
VITE_WS_URL=ws://localhost:8080/ws
```

## Getting Started

### Backend Setup
```bash
# Install Go 1.21+
# Configure .env with your API key
go run ./cmd/server
# Server runs on localhost:8080
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# App runs on localhost:5173
```

## API Specifications

### WebSocket Protocol

**Incoming from Backend**:
- `response.text.delta`: Partial transcription text
- `response.content_part.done`: Final transcription item
- `conversation.item.create`: Complete conversation item
- `error`: Error messages from backend/API

**Outgoing to Backend**:
- `session.update`: Configure session parameters
- `input_audio_buffer.append`: Send audio chunk
- `input_audio_buffer.commit`: Finalize audio buffer

### Audio Format Requirements

- **Sample Rate**: 16,000 Hz (16 kHz)
- **Channels**: 1 (Mono)
- **Bit Depth**: 16-bit signed integers
- **Format**: PCM
- **Transport**: Base64-encoded, one chunk per message

### Chunk Specification

- **Size**: ~100 milliseconds of audio
- **At 16kHz**: ~3,200 samples per chunk (6,400 bytes raw PCM)
- **Base64 Encoded**: ~8,500 characters per chunk
- **Typical Bandwidth**: ~19 KB/s

## Performance Characteristics

### Audio Processing
- **Resampling**: O(n) linear interpolation
- **PCM Conversion**: O(n) direct conversion
- **Base64 Encoding**: O(n) standard library
- **Total Latency**: <50ms for 100ms audio chunk

### Network
- **Chunk Size**: ~8.5 KB (base64 encoded)
- **Chunk Rate**: 10 per second
- **Bandwidth**: ~85 KB/s or ~680 kbps

### Browser Resources
- **Memory**: ~5-10 MB total
- **CPU**: <5% typical on modern hardware
- **Permissions**: Microphone access only

## Browser Compatibility

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅ 88+  | ✅ 88+ |
| Firefox | ✅ 87+  | ✅ 68+ |
| Safari  | ✅ 14+  | ✅ 14+ |
| Edge    | ✅ 88+  | ✅ 88+ |

**Requirements**:
- HTTPS (or localhost for testing)
- getUserMedia support
- WebSocket support
- AudioContext support

## Troubleshooting

### Microphone Not Working
1. Check browser permissions in address bar
2. Verify no other app is using microphone
3. Test with browser's built-in permissions reset
4. Check browser console for errors

### WebSocket Connection Failed
1. Verify backend is running on `localhost:8080`
2. Check network tab for connection errors
3. Ensure WebSocket protocol is not blocked by firewall
4. Verify proxy server is accessible

### No Transcription Results
1. Check microphone is capturing (volume meter active)
2. Verify API key is valid
3. Check backend logs for API errors
4. Ensure audio format is correct (16kHz mono)

### Audio Quality Issues
1. Reduce room noise
2. Use noise-cancelling microphone
3. Adjust microphone input levels
4. Verify microphone is not muted

## Development Notes

### Code Style
- Go: Standard Go conventions (tabs, interfaces, error handling)
- Vue: Single File Components with `<template>`, `<script>`, `<style>`
- JavaScript: ES6+ modules, no build-time transpilation needed
- CSS: Scoped styles in Vue, responsive design

### Adding Features
1. Update backend first (if needed)
2. Add tests for new utilities
3. Implement component changes
4. Test all browser compatibility

### Debugging
- **Frontend**: Browser DevTools (F12)
  - Network tab for WebSocket messages
  - Console for errors and logs
  - Application tab for local storage
- **Backend**: Check server logs
  - `[INFO]` for connection events
  - `[DEBUG]` for message details
  - `[ERROR]` for issues

## Future Improvements

- [ ] Implement AudioWorklet for better performance
- [ ] Add support for multiple audio codecs
- [ ] Implement audio recording/playback
- [ ] Add speaker detection
- [ ] Implement voice activity detection (VAD)
- [ ] Add session persistence
- [ ] Implement metrics collection
- [ ] Add support for multiple languages
- [ ] Implement reconnection with backoff
- [ ] Add certificate pinning for production

## License

MIT
