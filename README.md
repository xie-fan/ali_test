# WebSocket Proxy for Aliyun Qwen Real-Time API

This is a Go backend service that acts as a WebSocket proxy for the Aliyun DashScope Qwen real-time API. It allows frontend clients to connect via WebSocket to `/ws` endpoint and facilitates communication with the Aliyun API.

## Architecture

- **cmd/server**: Main application entry point
- **internal/config**: Configuration management with environment variables
- **internal/logger**: Structured logging utilities
- **internal/websocket**: WebSocket connection handling
- **internal/server**: HTTP server setup and lifecycle management

## Prerequisites

- Go 1.21 or higher
- Aliyun DashScope API key

## Getting Started

### 1. Clone and Setup

```bash
git clone <repo-url>
cd ws-proxy
```

### 2. Configure Environment

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set the required values:
- `DASHSCOPE_API_KEY`: Your Aliyun API key
- `DASHSCOPE_BASE_URL`: The API endpoint URL (defaults to Beijing region)
- `QWEN_MODEL`: The model to use (defaults to qwen3-asr-flash-realtime)
- `LISTEN_ADDR`: Where the proxy server listens (defaults to localhost:8080)

### 3. Run the Server

```bash
go run ./cmd/server
```

The server will start and listen on the configured address. You should see output like:

```
[INFO]  loaded configuration:
[INFO]    APIKey: sk-****-****
[INFO]    BaseURL: wss://dashscope.aliyuncs.com/api-ws/v1/realtime
[INFO]    Model: qwen3-asr-flash-realtime
[INFO]    ListenAddr: localhost:8080
[INFO]  starting server on localhost:8080
[INFO]  websocket endpoint: ws://localhost:8080/ws
[INFO]  health check endpoint: http://localhost:8080/health
[INFO]  server started successfully
```

## Protocol Specification

The WebSocket relay uses a custom JSON protocol for frontend-to-backend communication and transparently translates to Ali's OpenAI-compatible API format.

### Frontend Message Format

All frontend messages follow this structure:

```json
{
  "type": "config|audio_chunk|stop",
  "payload": {...}
}
```

#### Message Types

##### 1. Config Message (`config`)

Initialize the session with ASR configuration:

```json
{
  "type": "config",
  "payload": {
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

Maps to Ali's `session.update` event.

##### 2. Audio Chunk Message (`audio_chunk`)

Send PCM audio data in base64-encoded format:

```json
{
  "type": "audio_chunk",
  "payload": {
    "audio": "base64_encoded_pcm_data"
  }
}
```

- **audio**: Base64-encoded PCM audio chunk (typically 3200 bytes = ~0.1s at 16kHz/16-bit)
- Must be valid base64 or request will be rejected

Maps to Ali's `input_audio_buffer.append` event.

##### 3. Stop Message (`stop`)

Signal end of audio transmission:

```json
{
  "type": "stop",
  "payload": {}
}
```

Maps to Ali's `input_audio_buffer.commit` event.

### Frontend Response Format

Responses from Ali are forwarded as transcript events:

```json
{
  "type": "transcript",
  "data": {
    "text": "recognized text",
    "status": "interim|final"
  }
}
```

- **status**: `interim` for ongoing recognition, `final` for completed transcription

## Endpoints

### WebSocket Endpoint

- **URL**: `ws://localhost:8080/ws` (or `wss://` if using TLS)
- **Purpose**: Frontend clients connect here to proxy requests to Aliyun Qwen real-time API
- **Protocol**: WebSocket with JSON message format

#### Example Client Connection (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
    console.log('Connected to proxy');
    
    // Step 1: Send config
    ws.send(JSON.stringify({
        type: "config",
        payload: {
            modalities: ["text"],
            input_audio_format: "pcm",
            sample_rate: 16000,
            input_audio_transcription: {
                language: "zh"
            },
            turn_detection: {
                type: "server_vad",
                threshold: 0.2,
                silence_duration_ms: 800
            }
        }
    }));
    
    // Step 2: Send audio chunks
    const audioChunk = btoa('...PCM bytes...');
    ws.send(JSON.stringify({
        type: "audio_chunk",
        payload: {
            audio: audioChunk
        }
    }));
    
    // Step 3: Signal end
    ws.send(JSON.stringify({
        type: "stop",
        payload: {}
    }));
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'transcript') {
        console.log(`[${msg.data.status}] ${msg.data.text}`);
    }
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from proxy');
};
```

### Health Check Endpoint

- **URL**: `http://localhost:8080/health`
- **Method**: GET
- **Response**: `{"status":"ok"}`

## Configuration

Environment variables (see `.env.example` for defaults):

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHSCOPE_API_KEY` | Aliyun DashScope API key | `sk-default-key` |
| `DASHSCOPE_BASE_URL` | DashScope WebSocket endpoint | `wss://dashscope.aliyuncs.com/api-ws/v1/realtime` |
| `QWEN_MODEL` | Qwen model name | `qwen3-asr-flash-realtime` |
| `LISTEN_ADDR` | Server listen address | `localhost:8080` |

## Building

To create a production binary:

```bash
go build -o ws-proxy ./cmd/server
./ws-proxy
```

## Graceful Shutdown

The server gracefully handles shutdown signals (SIGINT, SIGTERM) with a 30-second timeout to complete ongoing requests. Press `Ctrl+C` to trigger shutdown.

## Logging

The server provides structured logging with the following levels:
- `[DEBUG]`: Detailed debugging information
- `[INFO]`: General informational messages
- `[WARN]`: Warning messages
- `[ERROR]`: Error messages

## Development

### Project Structure

```
.
├── cmd/
│   └── server/
│       └── main.go                    # Entry point
├── internal/
│   ├── config/
│   │   └── config.go                  # Configuration management
│   ├── logger/
│   │   └── logger.go                  # Logging utilities
│   ├── websocket/
│   │   ├── handler.go                 # WebSocket handler & client management
│   │   ├── relay.go                   # Ali relay logic
│   │   ├── relay_test.go              # Relay unit tests
│   │   └── messages.go                # Message protocol definitions
│   └── server/
│       └── server.go                  # Server implementation
├── go.mod
├── go.sum
├── .env.example
├── test.py                            # Python test client
└── README.md
```

### Key Components

- **handler.go**: Manages WebSocket connections from clients, creates relays
- **relay.go**: Bidirectional relay between frontend client and Ali ASR service
  - `ProcessClientMessage()`: Translates frontend messages to Ali protocol
  - `aliReadPump()`: Receives messages from Ali and forwards to client
  - `aliWritePump()`: Sends queued Ali messages
  - `heartbeatPump()`: Keeps connection alive with periodic pings
  - Auto-reconnection with exponential backoff
- **messages.go**: Protocol definitions for both frontend and Ali APIs
- **relay_test.go**: Comprehensive unit tests for message translation

### Adding Dependencies

```bash
go get <package-url>
```

### Running Tests

Unit tests for message translation are included:

```bash
go test ./...
```

To run tests with verbose output:

```bash
go test -v ./...
```

Tests cover:
- Config message translation to Ali's `session.update`
- Audio chunk message validation and base64 encoding
- Stop message translation to Ali's `input_audio_buffer.commit`
- Invalid base64 rejection
- Transcript response translation
- Event ID generation

## API Key Configuration

The service requires a valid Aliyun DashScope API key. There are multiple ways to provide it:

### Option 1: Environment Variable (Recommended)

```bash
export DASHSCOPE_API_KEY="sk-your-actual-key"
go run ./cmd/server
```

### Option 2: .env File

```bash
cp .env.example .env
# Edit .env and set DASHSCOPE_API_KEY=sk-your-actual-key
source .env
go run ./cmd/server
```

### Option 3: Docker Environment

```bash
docker run -e DASHSCOPE_API_KEY="sk-your-actual-key" \
  -p 8080:8080 \
  your-image:latest
```

To get your API key:
1. Visit [Aliyun Model Studio](https://help.aliyun.com/zh/model-studio/get-api-key)
2. Create an API key
3. Copy the key starting with `sk-`

## End-to-End Smoke Test

### Prerequisites

1. Go 1.21+
2. Valid Aliyun DashScope API key
3. PCM audio file for testing

### Running the Smoke Test

1. Start the server:
```bash
export DASHSCOPE_API_KEY="sk-your-actual-key"
go run ./cmd/server
```

2. In another terminal, run the Python test client:
```bash
pip install websocket-client
export DASHSCOPE_API_KEY="sk-your-actual-key"
python test.py
```

The test.py script:
- Connects to the WebSocket server
- Sends session configuration
- Streams PCM audio from `your_audio_file.pcm`
- Receives transcription results
- Closes connection gracefully

3. Expected output:
```
[INFO]  Connected to server.
[INFO]  Sending event: {...}
[INFO]  Sending audio event: event_xyz
[INFO]  Received event: {...transcript...}
[INFO]  Final transcript: recognized text
```

### Manual WebSocket Test with curl and wscat

Install wscat:
```bash
npm install -g wscat
```

Test connection:
```bash
wscat -c ws://localhost:8080/ws
```

Send a config message:
```json
{"type":"config","payload":{"modalities":["text"],"input_audio_format":"pcm","sample_rate":16000,"input_audio_transcription":{"language":"zh"}}}
```

### Debugging Tips

1. **Server logs**: Check for connection and relay errors
2. **Ali connection issues**: Verify DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL
3. **Message validation**: Ensure audio is valid base64
4. **Timeouts**: Check network connectivity to Ali's servers

## Troubleshooting

### Server fails to start

1. Check that the configured `LISTEN_ADDR` port is available
2. Verify the `DASHSCOPE_API_KEY` is set in `.env` or environment
3. Check logs for more details

### WebSocket connection fails

1. Ensure the server is running and reachable
2. Verify the WebSocket URL is correct
3. Check browser console for connection errors

### Messages not being processed

1. Verify the message format matches the API specification
2. Check server logs for error messages
3. Ensure the API key is valid

## Features Implemented

- [x] Bidirectional WebSocket relay between frontend clients and Ali ASR
- [x] Message translation (config → session.update, audio → input_audio_buffer.append, stop → input_audio_buffer.commit)
- [x] Base64 validation for audio chunks
- [x] Per-client Ali connections with full isolation
- [x] Concurrent read/write pumps with goroutines
- [x] Heartbeat mechanism (30s pings) to keep connections alive
- [x] Error propagation and logging
- [x] Automatic reconnection to Ali service (3 attempts with 1s delay)
- [x] Transcript forwarding from Ali to browser
- [x] Unit tests for message translation
- [x] Complete protocol documentation

## Potential Future Improvements

- [ ] Add metrics and monitoring (Prometheus)
- [ ] Implement TLS support for production
- [ ] Add connection pooling for better resource management
- [ ] Support for multiple languages and configurations per client
- [ ] Circuit breaker pattern for Ali API failures
- [ ] Message compression for large audio chunks
- [ ] Rate limiting per client

## References

- [Aliyun DashScope Documentation](https://help.aliyun.com/zh/model-studio)
- [Qwen Real-time API Guide](https://help.aliyun.com/zh/model-studio/user-guide/qwen-realtime-api)
- [Gorilla WebSocket](https://github.com/gorilla/websocket)

## License

MIT
