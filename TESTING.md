# Testing Guide

This document describes how to test the Ali ASR relay implementation.

## Unit Tests

### Running All Tests

```bash
go test -v ./...
```

### Running Tests for WebSocket Package Only

```bash
go test -v ./internal/websocket/...
```

### Test Coverage

```bash
go test -cover ./...
```

Detailed coverage report:

```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## Unit Test Cases

The `relay_test.go` file contains comprehensive unit tests:

1. **TestTranslateConfigMessage**
   - Tests config message parsing and translation
   - Verifies session configuration is stored correctly
   - Checks language and sample rate are preserved

2. **TestTranslateAudioChunkMessage**
   - Tests audio chunk message processing
   - Verifies base64 audio is queued to Ali
   - Checks event type is set to `input_audio_buffer.append`

3. **TestTranslateStopMessage**
   - Tests stop message processing
   - Verifies `input_audio_buffer.commit` event is queued
   - Checks proper message sequencing

4. **TestInvalidBase64Audio**
   - Tests validation of base64-encoded audio
   - Verifies invalid base64 is rejected with error
   - Checks error message is descriptive

5. **TestTranslateTranscriptResponse**
   - Tests Ali transcript message translation
   - Verifies `conversation.item.input_audio_transcription.completed` is handled
   - Checks transcript is forwarded with status "final"

6. **TestTranslateTranscriptDelta**
   - Tests interim transcript handling
   - Verifies `response.audio_transcript.delta` is handled
   - Checks status is set to "interim"

7. **TestValidBase64**
   - Tests base64 validation function with multiple inputs
   - Verifies valid base64 is accepted
   - Verifies invalid base64 is rejected

8. **TestEventIDGeneration**
   - Tests event ID generation and uniqueness
   - Verifies sequential numbering
   - Checks no duplicates are generated

## Integration Tests

Integration tests are tagged with `+build integration` and test the full relay flow:

```bash
go test -tags=integration -v ./internal/websocket/...
```

### Integration Test Cases

1. **TestRelayClientIntegration**
   - Tests complete message flow: config → audio → stop
   - Verifies all message types are processed in sequence

2. **TestRelayContextCancellation**
   - Tests graceful shutdown with context cancellation
   - Verifies cleanup on context done signal

3. **TestEventIDIncrement**
   - Tests event ID generation across multiple messages
   - Verifies uniqueness in realistic scenarios

4. **TestMessageUnmarshallingRobustness**
   - Tests various valid and invalid message formats
   - Verifies robust error handling

## Smoke Test

Run the automated smoke test:

```bash
./smoke_test.sh
```

This script:
- Checks API key configuration
- Verifies Go installation
- Runs unit tests
- Builds the binary
- Starts the server
- Tests the health endpoint
- Tests WebSocket connectivity
- Cleans up resources

### Prerequisites for Smoke Test

```bash
export DASHSCOPE_API_KEY="sk-your-actual-key"
```

## Manual Testing

### 1. Start the Server

```bash
export DASHSCOPE_API_KEY="sk-your-api-key"
go run ./cmd/server
```

Expected output:
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

### 2. Test Health Endpoint

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{"status":"ok"}
```

### 3. Test WebSocket Connection with Python

```bash
pip install websocket-client
python test.py
```

The test.py script will:
- Connect to the WebSocket relay
- Send session configuration
- Stream audio chunks
- Receive and display transcript

### 4. Test WebSocket Connection with wscat

Install wscat:
```bash
npm install -g wscat
```

Connect:
```bash
wscat -c ws://localhost:8080/ws
```

Send a config message:
```json
{"type":"config","payload":{"modalities":["text"],"input_audio_format":"pcm","sample_rate":16000,"input_audio_transcription":{"language":"zh"}}}
```

Send a stop message:
```json
{"type":"stop","payload":{}}
```

### 5. Test WebSocket Connection with JavaScript/Browser

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
    console.log('Connected');
    
    // Send config
    ws.send(JSON.stringify({
        type: 'config',
        payload: {
            modalities: ['text'],
            input_audio_format: 'pcm',
            sample_rate: 16000,
            input_audio_transcription: { language: 'zh' }
        }
    }));
};

ws.onmessage = (event) => {
    console.log('Received:', JSON.parse(event.data));
};

ws.onerror = (error) => {
    console.error('Error:', error);
};
```

## Performance Testing

### Load Testing with Concurrent Connections

```bash
# Simple concurrent connection test (requires Apache Bench)
ab -n 100 -c 10 http://localhost:8080/health
```

### Memory Profiling

```bash
go test -memprofile=mem.prof ./internal/websocket
go tool pprof mem.prof
# Commands: top, list <function>, etc.
```

### CPU Profiling

```bash
go test -cpuprofile=cpu.prof ./internal/websocket
go tool pprof cpu.prof
```

## Debugging

### Enable Debug Logging

Server logs are automatically set to INFO level. To see debug messages during testing:

The logger includes timestamps and file locations for each message.

### Logging Examples

When a client connects:
```
[INFO]  client connected from 127.0.0.1:54321
```

When processing a config message:
```
[DEBUG] queued session.update to Ali
```

When sending audio:
```
[DEBUG] queued audio chunk to Ali (size: 3200 bytes)
```

When receiving transcripts:
```
[DEBUG] sent final transcript to client
```

## Troubleshooting Test Failures

### Test: TestInvalidBase64Audio Fails

**Symptom**: Test expects an error but none is returned

**Fix**: Check that `validateBase64()` is properly checking for invalid characters

### Test: Messages Don't Reach Ali Channel

**Symptom**: Test processes message but aliSend channel is empty

**Fix**: Ensure relay.aliSend channel is properly initialized before test

### Server Won't Start

**Symptom**: "configuration error: DASHSCOPE_API_KEY is required"

**Fix**: Set the environment variable:
```bash
export DASHSCOPE_API_KEY="sk-test-key"
```

### WebSocket Connection Fails

**Symptom**: Connection refused or timeout

**Fix**: 
1. Verify server is running: `curl http://localhost:8080/health`
2. Check LISTEN_ADDR matches in both server and client
3. Verify no firewall blocking port 8080

### Ali Connection Fails

**Symptom**: Server starts but relay fails to connect

**Fix**:
1. Verify DASHSCOPE_API_KEY is valid
2. Check DASHSCOPE_BASE_URL is correct for your region
3. Verify network connectivity to ali services
4. Check logs for specific error messages

## CI/CD Testing

Tests should pass before committing:

```bash
go test -v ./...
go fmt ./...
go vet ./...
go build ./cmd/server
```

## Test Metrics

Current test coverage should include:
- Message translation: 8 test cases
- Base64 validation: 4 test cases  
- Event ID generation: 1 test case
- Integration flow: 4 test cases
- Error handling: Multiple sub-cases in robustness tests

Total: 17+ test cases covering all critical functionality
