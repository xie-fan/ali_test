# Qwen Real-time API Frontend

Vue 3 frontend application for real-time microphone capture and transcription using the Qwen API through a WebSocket proxy.

## Features

- 🎤 Real-time microphone capture using Web Audio API
- 📝 Live transcription display with streaming updates
- 🔊 Volume meter for audio monitoring
- 🎛️ PCM audio processing (16kHz mono, 16-bit)
- 📊 Audio statistics (duration, chunks sent)
- 🛡️ Permission handling with user-friendly error messages
- 🎨 Beautiful, responsive UI with real-time status indicators
- ♿ Accessible controls with disabled states during connection

## Quick Start

### Prerequisites

- Node.js 16 or higher
- npm or yarn
- Running WebSocket proxy server on `localhost:8080`

### Installation

```bash
cd frontend
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Create production build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Configuration

Environment variables can be set in `.env` or `.env.local`:

```env
VITE_WS_URL=ws://localhost:8080/ws
```

## Testing

Run tests:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

## Project Structure

```
src/
├── components/
│   └── MicrophoneCapture.vue    # Main capture component
├── services/
│   ├── microphoneService.js     # Audio capture handling
│   └── websocketService.js      # WebSocket connection management
├── utils/
│   ├── pcm.js                   # PCM audio processing utilities
│   └── pcm.test.js              # PCM utility tests
├── App.vue                       # Root Vue component
└── main.js                       # Application entry point
```

## Component Features

### MicrophoneCapture Component

The main component handles:

- **Start/Stop Recording**: Toggle microphone capture
- **Live Transcription**: Display real-time transcription updates
- **Volume Meter**: Visual feedback of microphone input level
- **Connection Status**: Shows current connection state
- **Statistics**: Displays audio duration and chunks sent
- **Error Handling**: Shows user-friendly error messages

### Microphone Service

Handles audio capture with:

- Permission requests from user
- Audio context initialization
- ScriptProcessor for raw audio data
- Audio buffer accumulation
- Chunk generation at specified intervals (default: 100ms)
- Volume detection for UI feedback
- Error handling for common permission issues

### WebSocket Service

Manages connection with:

- Auto-reconnection (via message queue)
- Event-based architecture
- Message formatting per Qwen API spec
- Session management
- Audio input streaming

### PCM Audio Processing

Utilities for converting audio data:

- **float32ToPcm16**: Convert float32 to 16-bit signed integers
- **resampleAudio**: Resample to target rate using linear interpolation
- **stereoToMono**: Convert stereo to mono
- **processAudioChunk**: End-to-end processing with resampling
- **uint8ArrayToBase64**: Encode for transmission
- Comprehensive test suite with edge cases

## WebSocket Message Format

The component sends audio data in the following format:

```json
{
  "event_id": "event_123",
  "type": "input_audio_buffer.append",
  "audio": "base64-encoded-pcm-data"
}
```

And receives transcription updates like:

```json
{
  "type": "response.text.delta",
  "delta": "transcribed text"
}
```

## Browser Support

- Chrome/Edge 88+
- Firefox 87+
- Safari 14+
- Requires HTTPS in production (WebSocket and getUserMedia)

## Troubleshooting

### Microphone Permission Denied

1. Check browser permissions (usually shown in address bar)
2. For local testing, use localhost or file://
3. For production, must use HTTPS

### WebSocket Connection Failed

1. Verify proxy server is running on `localhost:8080`
2. Check browser console for connection errors
3. Ensure WebSocket URL is correct in `.env`

### No Transcription Results

1. Check microphone is actually capturing audio (volume meter should show activity)
2. Verify backend is receiving audio chunks
3. Check browser console for error messages
4. Ensure language setting matches API expectations

### Audio Quality Issues

1. Check microphone input levels (volume meter)
2. Verify 16kHz mono PCM format is being sent
3. Check for dropped audio chunks in network tab
4. Reduce microphone noise and echo with device settings

## Debug Mode

Press 'D' key to toggle debug information display including:

- Microphone status
- Last received message type
- Audio context state
- More technical details

## Performance Notes

- Audio chunks generated every 100ms (configurable)
- Resampling done in real-time on audio thread
- Base64 encoding adds ~33% to transmission size
- Typical bandwidth: ~19 KB/s at 16kHz mono 16-bit

## API Specification Reference

Based on Aliyun Qwen Real-time API:
- Sample rate: 16000 Hz
- Channels: 1 (mono)
- Bit depth: 16-bit signed integers
- Format: PCM
- Encoding for transport: Base64

## License

MIT
