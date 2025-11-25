package websocket

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/example/ws-proxy/internal/logger"
)

func TestTranslateConfigMessage(t *testing.T) {
	log := logger.NewLogger()
	relay := NewAliRelay(make(chan []byte), log, "", "", "test-model")

	config := ConfigPayload{
		Modalities:       []string{"text"},
		InputAudioFormat: "pcm",
		SampleRate:       16000,
		InputAudioTranscription: InputAudioTranscription{
			Language: "zh",
		},
		TurnDetection: &TurnDetection{
			Type:              "server_vad",
			Threshold:         0.2,
			SilenceDurationMs: 800,
		},
	}

	payload, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	frontendMsg := FrontendMessage{
		Type:    FrontendConfigType,
		Payload: payload,
	}

	msg, err := json.Marshal(frontendMsg)
	if err != nil {
		t.Fatalf("failed to marshal message: %v", err)
	}

	if err := relay.ProcessClientMessage(msg); err != nil {
		t.Fatalf("failed to process config message: %v", err)
	}

	relay.sessionMux.RLock()
	sessionConfig := relay.sessionConfig
	relay.sessionMux.RUnlock()

	if sessionConfig == nil {
		t.Fatal("session config is nil")
	}

	if sessionConfig.SampleRate != 16000 {
		t.Errorf("expected sample rate 16000, got %d", sessionConfig.SampleRate)
	}

	if sessionConfig.InputAudioTranscription.Language != "zh" {
		t.Errorf("expected language zh, got %s", sessionConfig.InputAudioTranscription.Language)
	}

	if len(sessionConfig.Modalities) == 0 {
		t.Fatal("modalities is empty")
	}
}

func TestTranslateAudioChunkMessage(t *testing.T) {
	log := logger.NewLogger()
	aliSendChan := make(chan *AliMessage, 1)
	relay := NewAliRelay(make(chan []byte), log, "", "", "test-model")
	relay.aliSend = aliSendChan

	audioData := []byte("test audio data")
	encodedAudio := base64.StdEncoding.EncodeToString(audioData)

	chunk := AudioChunkPayload{
		Audio: encodedAudio,
	}

	payload, err := json.Marshal(chunk)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	frontendMsg := FrontendMessage{
		Type:    FrontendAudioChunkType,
		Payload: payload,
	}

	msg, err := json.Marshal(frontendMsg)
	if err != nil {
		t.Fatalf("failed to marshal message: %v", err)
	}

	if err := relay.ProcessClientMessage(msg); err != nil {
		t.Fatalf("failed to process audio chunk message: %v", err)
	}

	select {
	case aliMsg := <-aliSendChan:
		if aliMsg.Type != AliAudioBufferAppendType {
			t.Errorf("expected type %s, got %s", AliAudioBufferAppendType, aliMsg.Type)
		}
		if aliMsg.Audio != encodedAudio {
			t.Errorf("expected audio %s, got %s", encodedAudio, aliMsg.Audio)
		}
	default:
		t.Fatal("expected message in aliSend channel")
	}
}

func TestTranslateStopMessage(t *testing.T) {
	log := logger.NewLogger()
	aliSendChan := make(chan *AliMessage, 1)
	relay := NewAliRelay(make(chan []byte), log, "", "", "test-model")
	relay.aliSend = aliSendChan

	frontendMsg := FrontendMessage{
		Type:    FrontendStopType,
		Payload: json.RawMessage("{}"),
	}

	msg, err := json.Marshal(frontendMsg)
	if err != nil {
		t.Fatalf("failed to marshal message: %v", err)
	}

	if err := relay.ProcessClientMessage(msg); err != nil {
		t.Fatalf("failed to process stop message: %v", err)
	}

	select {
	case aliMsg := <-aliSendChan:
		if aliMsg.Type != AliAudioBufferCommitType {
			t.Errorf("expected type %s, got %s", AliAudioBufferCommitType, aliMsg.Type)
		}
	default:
		t.Fatal("expected message in aliSend channel")
	}
}

func TestInvalidBase64Audio(t *testing.T) {
	log := logger.NewLogger()
	relay := NewAliRelay(make(chan []byte), log, "", "", "test-model")

	chunk := AudioChunkPayload{
		Audio: "not-valid-base64!!!",
	}

	payload, err := json.Marshal(chunk)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	frontendMsg := FrontendMessage{
		Type:    FrontendAudioChunkType,
		Payload: payload,
	}

	msg, err := json.Marshal(frontendMsg)
	if err != nil {
		t.Fatalf("failed to marshal message: %v", err)
	}

	err = relay.ProcessClientMessage(msg)
	if err == nil {
		t.Fatal("expected error for invalid base64")
	}
}

func TestTranslateTranscriptResponse(t *testing.T) {
	log := logger.NewLogger()
	clientSendChan := make(chan []byte, 1)
	relay := NewAliRelay(clientSendChan, log, "", "", "test-model")

	aliMsg := map[string]interface{}{
		"type":       string(AliTranscriptionCompletedType),
		"transcript": "hello world",
	}

	if err := relay.handleAliMessage(map[string]interface{}{
		"type":       "conversation.item.input_audio_transcription.completed",
		"transcript": "hello world",
	}); err != nil {
		t.Fatalf("failed to handle transcript: %v", err)
	}

	select {
	case clientMsg := <-clientSendChan:
		var frontendEvent FrontendTranscriptEvent
		if err := json.Unmarshal(clientMsg, &frontendEvent); err != nil {
			t.Fatalf("failed to unmarshal frontend event: %v", err)
		}

		if frontendEvent.Type != "transcript" {
			t.Errorf("expected type transcript, got %s", frontendEvent.Type)
		}

		if frontendEvent.Data.Text != "hello world" {
			t.Errorf("expected text 'hello world', got '%s'", frontendEvent.Data.Text)
		}

		if frontendEvent.Data.Status != "final" {
			t.Errorf("expected status 'final', got '%s'", frontendEvent.Data.Status)
		}
	default:
		t.Fatal("expected message in clientSend channel")
	}
}

func TestTranslateTranscriptDelta(t *testing.T) {
	log := logger.NewLogger()
	clientSendChan := make(chan []byte, 1)
	relay := NewAliRelay(clientSendChan, log, "", "", "test-model")

	if err := relay.handleAliMessage(map[string]interface{}{
		"type":  "response.audio_transcript.delta",
		"delta": "hello",
	}); err != nil {
		t.Fatalf("failed to handle transcript delta: %v", err)
	}

	select {
	case clientMsg := <-clientSendChan:
		var frontendEvent FrontendTranscriptEvent
		if err := json.Unmarshal(clientMsg, &frontendEvent); err != nil {
			t.Fatalf("failed to unmarshal frontend event: %v", err)
		}

		if frontendEvent.Type != "transcript" {
			t.Errorf("expected type transcript, got %s", frontendEvent.Type)
		}

		if frontendEvent.Data.Text != "hello" {
			t.Errorf("expected text 'hello', got '%s'", frontendEvent.Data.Text)
		}

		if frontendEvent.Data.Status != "interim" {
			t.Errorf("expected status 'interim', got '%s'", frontendEvent.Data.Status)
		}
	default:
		t.Fatal("expected message in clientSend channel")
	}
}

func TestValidBase64(t *testing.T) {
	tests := []struct {
		name    string
		data    string
		wantErr bool
	}{
		{
			name:    "valid base64",
			data:    base64.StdEncoding.EncodeToString([]byte("test")),
			wantErr: false,
		},
		{
			name:    "empty string",
			data:    "",
			wantErr: false,
		},
		{
			name:    "invalid base64",
			data:    "!!!invalid!!!",
			wantErr: true,
		},
		{
			name:    "partial base64",
			data:    "dGVz",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateBase64(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateBase64() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEventIDGeneration(t *testing.T) {
	log := logger.NewLogger()
	relay := NewAliRelay(make(chan []byte), log, "", "", "test-model")

	id1 := relay.nextEventID()
	id2 := relay.nextEventID()

	if id1 == id2 {
		t.Errorf("event IDs should be unique: %s and %s", id1, id2)
	}

	if id1 != "event_1" {
		t.Errorf("expected first event ID to be 'event_1', got %s", id1)
	}

	if id2 != "event_2" {
		t.Errorf("expected second event ID to be 'event_2', got %s", id2)
	}
}
