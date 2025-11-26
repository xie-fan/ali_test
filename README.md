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
    // Send session.update event
    ws.send(JSON.stringify({
        event_id: "event_123",
        type: "session.update",
        session: {
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
};

ws.onmessage = (event) => {
    console.log('Received:', JSON.parse(event.data));
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

## Frontend

A Vue 3 + Vite + TypeScript frontend is provided in the `frontend/` directory for interacting with the WebSocket proxy.

### Quick Start

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173` and automatically connects to the backend WebSocket proxy.

### Frontend Features

- 🎨 Modern Vue 3 UI with responsive design
- 🔌 WebSocket service with auto-reconnection and message queuing
- 🎙️ Recording controls and audio file upload
- 📊 Real-time transcript display
- 💾 Connection status indicator
- 📘 Full TypeScript support

### Frontend Configuration

Edit `frontend/.env.local` to configure the WebSocket backend URL:

```env
VITE_WS_PROTOCOL=ws
VITE_WS_HOST=localhost
VITE_WS_PORT=8080
```

For more details, see [frontend/README.md](./frontend/README.md)

## Development

### Project Structure

```
.
├── cmd/
│   └── server/
│       └── main.go           # Entry point
├── internal/
│   ├── config/
│   │   └── config.go         # Configuration management
│   ├── logger/
│   │   └── logger.go         # Logging utilities
│   ├── websocket/
│   │   └── handler.go        # WebSocket handler
│   └── server/
│       └── server.go         # Server implementation
├── frontend/                 # Vue 3 + Vite + TypeScript frontend
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── README.md
├── go.mod
├── go.sum
├── .env.example
└── README.md
```

### Adding Dependencies

```bash
go get <package-url>
```

### Running Tests (When Available)

```bash
go test ./...
```

## Running Backend and Frontend Together

To run the full application locally:

### Terminal 1: Backend Server

```bash
# Set up environment
cp .env.example .env
# Edit .env with your Aliyun API credentials

# Run the Go backend
go run ./cmd/server
```

You should see:
```
[INFO]  loaded configuration:
[INFO]    APIKey: sk-****-****
[INFO]    BaseURL: wss://dashscope.aliyuncs.com/api-ws/v1/realtime
[INFO]    Model: qwen3-asr-flash-realtime
[INFO]    ListenAddr: localhost:8080
[INFO]  server started successfully
```

### Terminal 2: Frontend Application

```bash
cd frontend
npm install
npm run dev
```

You should see:
```
  VITE v4.4.9  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Open your browser to `http://localhost:5173` - the frontend will automatically connect to the backend.

## Troubleshooting

### Backend fails to start

1. Check that port 8080 is not in use: `lsof -i :8080`
2. Verify the `DASHSCOPE_API_KEY` is set in `.env`
3. Check that `.env` exists: `test -f .env && echo "exists" || echo "not found"`

### Frontend fails to connect

1. Ensure backend is running: `curl http://localhost:8080/health`
2. Check browser console (F12) for connection errors
3. Verify `VITE_WS_*` environment variables are correct in `frontend/.env.local`
4. Try refreshing the page with Ctrl+Shift+R

### WebSocket connection fails in production

1. Use `wss://` protocol if backend uses TLS
2. Ensure CORS is properly configured
3. Check WebSocket proxy headers

### Dependencies installation fails

**Backend**: 
```bash
go mod tidy
go mod download
```

**Frontend**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- [ ] Implement proxy forwarding to Aliyun API
- [ ] Add message routing and transformation
- [ ] Implement error handling and recovery
- [ ] Add metrics and monitoring
- [ ] Add request/response validation
- [ ] Implement TLS support
- [ ] Add frontend audio recording
- [ ] Implement real-time speech-to-text display

## References

- [Aliyun DashScope Documentation](https://help.aliyun.com/zh/model-studio)
- [Qwen Real-time API Guide](https://help.aliyun.com/zh/model-studio/user-guide/qwen-realtime-api)
- [Gorilla WebSocket](https://github.com/gorilla/websocket)

## License

MIT
