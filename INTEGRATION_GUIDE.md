# Integration Guide: Qwen Real-time API with Microphone Capture

## Quick Start

### For Development

1. **Start the backend proxy server**:
   ```bash
   # In project root
   go run ./cmd/server
   ```
   Server listens on `localhost:8080`

2. **Start the frontend in a separate terminal**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend available at `http://localhost:5173`

3. **Open your browser**:
   - Go to `http://localhost:5173`
   - The frontend will auto-connect to the WebSocket proxy
   - Click "Start Recording" to begin capturing audio
   - Speak into your microphone
   - See transcription results update in real-time

### For Production

1. **Build the backend**:
   ```bash
   go build -o ws-proxy ./cmd/server
   ./ws-proxy
   ```

2. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   ```
   Output: `frontend/dist/` directory

3. **Serve the frontend files** using any static file server and proxy WebSocket requests to the backend

## API Message Flow

### 1. Connection Established
```
[Frontend]                          [Backend]                    [Aliyun API]
    |                                  |                              |
    |--- WebSocket Connect ----------->|                              |
    |<-- WebSocket Open Confirmed -----|                              |
```

### 2. Session Initialization
```
[Frontend]                          [Backend]                    [Aliyun API]
    |                                  |                              |
    |--- session.update message ------>|--- Forward session.update -->|
    |                                  |<-- session.created ---------|
    |<---- session.created ------------|                              |
```

### 3. Audio Streaming (Continuous)
```
[Frontend]                          [Backend]                    [Aliyun API]
    |                                  |                              |
    |--- input_audio_buffer.append --->|--- Forward audio chunk ----->|
    |--- input_audio_buffer.append --->|--- Forward audio chunk ----->|
    |--- input_audio_buffer.append --->|--- Forward audio chunk ----->|
    |                                  |<-- response.text.delta ------|
    |<-- response.text.delta ---------|                              |
    |                                  |<-- response.text.delta ------|
    |<-- response.text.delta ---------|                              |
```

### 4. Session Finalization
```
[Frontend]                          [Backend]                    [Aliyun API]
    |                                  |                              |
    |--- input_audio_buffer.commit --->|--- Forward commit ---------->|
    |                                  |<-- response.done ------------|
    |<-- response.done ---|            |                              |
```

## Message Schemas

### Session Update
Sent once when connection is established to configure the session:

```json
{
  "event_id": "event_1234567890_1",
  "type": "session.update",
  "session": {
    "modalities": ["text"],
    "input_audio_format": "pcm",
    "sample_rate": 16000,
    "input_audio_transcription": {
      "language": "zh"
    },
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.2,
      "silence_duration_ms": 800
    }
  }
}
```

### Audio Input (Repeated for each chunk)
Sent approximately every 100 milliseconds:

```json
{
  "event_id": "event_1234567890_2",
  "type": "input_audio_buffer.append",
  "audio": "//NExAAiAF..."
}
```

### Commit Message
Sent when recording stops to finalize the audio buffer:

```json
{
  "event_id": "event_1234567890_100",
  "type": "input_audio_buffer.commit"
}
```

## Error Handling

### Common Errors

**Microphone Permission Denied**
- User clicked "Don't Allow" in permission prompt
- Solution: Check browser permissions in address bar, reset if needed

**WebSocket Connection Failed**
- Backend not running
- Wrong WebSocket URL
- Firewall blocking connection
- Solution: Verify backend is running on correct port

**No Transcription Results**
- Audio not being sent
- API key invalid
- Network issues
- Solution: Check browser console for errors, verify API key

## Testing

### Manual Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads and auto-connects
- [ ] Status shows "Connected" immediately
- [ ] Volume meter appears during recording
- [ ] Microphone permission request works
- [ ] Permission denied handling works
- [ ] Audio chunks are being sent (check network tab)
- [ ] Transcription appears in real-time
- [ ] Stop recording works
- [ ] Clear button works
- [ ] Can record multiple times in same session
- [ ] Responsive design works on mobile
- [ ] Debug mode toggle (press 'D') shows information

### Automated Testing

```bash
# Run frontend tests
cd frontend
npm test

# Run with coverage
npm test -- --coverage

# Run with UI
npm run test:ui
```

## Performance Metrics

### Audio Processing
- Sample Rate: 16,000 Hz (16 kHz)
- Channels: 1 (Mono)
- Bit Depth: 16-bit
- Chunk Duration: ~100 ms
- Samples per Chunk: ~3,200
- Bytes per Chunk (raw): ~6,400
- Bytes per Chunk (base64): ~8,500

### Network
- Chunk Rate: ~10 chunks/second
- Bandwidth: ~85 KB/s
- Typical Session Duration: Variable
- Max Payload: 512 KB per message (backend limit)

### Browser Performance
- Memory Usage: 5-10 MB
- CPU Usage: <5% on modern hardware
- Latency: <50ms audio processing per chunk

## Troubleshooting

### Frontend Console Shows "WebSocket Connection Error"

1. Check if backend is running:
   ```bash
   curl http://localhost:8080/health
   # Should return: {"status":"ok"}
   ```

2. Check network tab in browser:
   - Look for WebSocket connection in Network tab
   - Check if connection shows 101 Switching Protocols

3. Verify WebSocket URL:
   - Default: `ws://localhost:8080/ws`
   - Production: May need `wss://` for HTTPS

### No Audio Being Sent

1. Check browser permissions:
   - Browser may be blocking microphone
   - Check address bar for permission icons

2. Check volume meter:
   - If not showing during recording, microphone may not be working
   - Try system microphone test

3. Check browser console:
   - Look for errors in console
   - Check for specific error messages

### Transcription Not Appearing

1. Check backend logs:
   - Look for error messages
   - Verify API key is valid

2. Check network requests:
   - Open Network tab in browser DevTools
   - Look for WebSocket messages
   - Verify audio chunks are being sent

3. Check browser console:
   - Look for parsing errors
   - Check for WebSocket message errors

## Environment Configuration

### Backend (.env)
```env
DASHSCOPE_API_KEY=your-api-key-here
DASHSCOPE_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/realtime
QWEN_MODEL=qwen3-asr-flash-realtime
LISTEN_ADDR=localhost:8080
```

### Frontend (.env.local in frontend/)
```env
VITE_WS_URL=ws://localhost:8080/ws
```

## Code Organization

### Frontend Structure
- **components/**: Vue components (only MicrophoneCapture.vue currently)
- **services/**: Business logic
  - `microphoneService.js`: Web Audio API integration
  - `websocketService.js`: WebSocket connection management
- **utils/**: Utility functions
  - `pcm.js`: Audio format conversion

### Backend Structure
- **cmd/server**: Entry point
- **internal/config**: Configuration management
- **internal/logger**: Logging utilities
- **internal/websocket**: WebSocket handler
- **internal/server**: HTTP server

## Adding Features

### Adding a New UI Component

1. Create file: `frontend/src/components/NewComponent.vue`
2. Import in `MicrophoneCapture.vue`
3. Use the component in template
4. Style as needed

### Adding a New Utility Function

1. Create/edit file: `frontend/src/utils/newUtils.js`
2. Export functions
3. Write tests in `newUtils.test.js`
4. Run tests to verify

### Modifying PCM Processing

1. Edit `frontend/src/utils/pcm.js`
2. Update corresponding tests
3. Run tests with `npm test`
4. Verify audio quality

## Browser Debugging

### Using Browser DevTools

1. **Network Tab**:
   - Filter by WebSocket
   - Inspect message payloads
   - Check message size and frequency

2. **Console Tab**:
   - Check for errors
   - View debug output (press 'D' to toggle)

3. **Application Tab**:
   - View local storage
   - Check permissions
   - Inspect audio context

### Common Debug Steps

```javascript
// Open browser console and run:

// Check WebSocket status
console.log(app._instance.ctx.wsService.isConnected)

// Check if microphone is active
console.log(app._instance.ctx.micService?.isActive())

// Check current volume
console.log(app._instance.ctx.volume)

// Check transcript items
console.log(app._instance.ctx.transcript)
```

## Production Deployment

### Backend Deployment

1. Set environment variables:
   ```bash
   export DASHSCOPE_API_KEY=your-key
   export LISTEN_ADDR=0.0.0.0:8080
   ```

2. Run the binary:
   ```bash
   ./ws-proxy
   ```

3. Use process manager (e.g., systemd, supervisor) for auto-restart

### Frontend Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Serve files with static file server:
   ```bash
   # Using simple-http-server
   cd dist
   simple-http-server -p 3000
   ```

3. Proxy WebSocket requests to backend (using nginx/Apache)

### HTTPS/WSS Setup

For production, use HTTPS and WSS:

1. Generate SSL certificate
2. Configure backend to use TLS
3. Update frontend WebSocket URL to use `wss://`

## Support and Resources

- [Aliyun DashScope API Documentation](https://help.aliyun.com/zh/model-studio)
- [Web Audio API MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Vue 3 Documentation](https://vuejs.org/)
- [WebSocket Protocol RFC 6455](https://tools.ietf.org/html/rfc6455)

## Contact

For issues or questions, please refer to the project's issue tracker or contact the development team.
