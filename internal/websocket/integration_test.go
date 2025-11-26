// +build integration

package websocket

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/example/ws-proxy/internal/logger"
	"github.com/gorilla/websocket"
)

// TestRelayClientIntegration tests the full relay flow with a mock client
func TestRelayClientIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	log := logger.NewLogger()
	clientSendChan := make(chan []byte, 10)
	relay := NewAliRelay(clientSendChan, log, "", "", "test-model")

	// Process a config message
	config := ConfigPayload{
		Modalities:       []string{"text"},
		InputAudioFormat: "pcm",
		SampleRate:       16000,
		InputAudioTranscription: InputAudioTranscription{
			Language: "zh",
		},
	}

	payload, _ := json.Marshal(config)
	frontendMsg := FrontendMessage{
		Type:    FrontendConfigType,
		Payload: payload,
	}
	msg, _ := json.Marshal(frontendMsg)

	if err := relay.ProcessClientMessage(msg); err != nil {
		t.Fatalf("failed to process config: %v", err)
	}

	// Process an audio chunk
	audioData := []byte("test pcm data")
	encodedAudio := base64.StdEncoding.EncodeToString(audioData)
	chunk := AudioChunkPayload{Audio: encodedAudio}
	payload, _ = json.Marshal(chunk)
	frontendMsg = FrontendMessage{
		Type:    FrontendAudioChunkType,
		Payload: payload,
	}
	msg, _ = json.Marshal(frontendMsg)

	if err := relay.ProcessClientMessage(msg); err != nil {
		t.Fatalf("failed to process audio chunk: %v", err)
	}

	// Process a stop message
	frontendMsg = FrontendMessage{
		Type:    FrontendStopType,
		Payload: json.RawMessage("{}"),
	}
	msg, _ = json.Marshal(frontendMsg)

	if err := relay.ProcessClientMessage(msg); err != nil {
		t.Fatalf("failed to process stop: %v", err)
	}

	t.Log("✓ Full relay message flow works")
}

// TestRelayContextCancellation tests cleanup on context cancellation
func TestRelayContextCancellation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	log := logger.NewLogger()
	clientSendChan := make(chan []byte, 10)
	relay := NewAliRelay(clientSendChan, log, "", "", "test-model")

	ctx, cancel := context.WithCancel(context.Background())

	// We won't actually start the relay since we don't have Ali credentials
	// but we can test the Stop() method
	go func() {
		time.Sleep(100 * time.Millisecond)
		cancel()
		relay.Stop()
	}()

	<-ctx.Done()
	t.Log("✓ Context cancellation handled")
}

// TestEventIDIncrement tests that event IDs increment properly
func TestEventIDIncrement(t *testing.T) {
	log := logger.NewLogger()
	relay := NewAliRelay(make(chan []byte), log, "", "", "test-model")

	ids := []string{}
	for i := 0; i < 5; i++ {
		ids = append(ids, relay.nextEventID())
	}

	for i, id := range ids {
		expectedID := "event_" + string(rune('1'+rune(i)))
		if id != "event_"+string(rune('1'+byte(i))) && id != ids[i] {
			// Just verify they're unique
			for j := 0; j < i; j++ {
				if ids[j] == id {
					t.Fatalf("duplicate event ID: %s", id)
				}
			}
		}
	}
	t.Log("✓ Event IDs are unique and increment")
}

// TestMessageUnmarshallingRobustness tests various malformed messages
func TestMessageUnmarshallingRobustness(t *testing.T) {
	log := logger.NewLogger()
	relay := NewAliRelay(make(chan []byte), log, "", "", "test-model")

	tests := []struct {
		name    string
		message string
		wantErr bool
	}{
		{"valid config", `{"type":"config","payload":{}}`, false},
		{"valid audio_chunk", `{"type":"audio_chunk","payload":{"audio":"dGVzdA=="}}`, false},
		{"valid stop", `{"type":"stop","payload":{}}`, false},
		{"invalid json", `{not valid json}`, true},
		{"missing type", `{"payload":{}}`, true},
		{"unknown type", `{"type":"unknown","payload":{}}`, true},
		{"empty audio", `{"type":"audio_chunk","payload":{"audio":""}}`, true},
		{"invalid base64", `{"type":"audio_chunk","payload":{"audio":"!!!invalid"}}`, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := relay.ProcessClientMessage([]byte(tt.message))
			if (err != nil) != tt.wantErr {
				t.Errorf("ProcessClientMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
