package websocket

import (
	"encoding/json"
	"time"
)

type FrontendMessageType string
type AliMessageType string

const (
	FrontendConfigType     FrontendMessageType = "config"
	FrontendAudioChunkType FrontendMessageType = "audio_chunk"
	FrontendStopType       FrontendMessageType = "stop"

	AliSessionUpdateType                AliMessageType = "session.update"
	AliAudioBufferAppendType            AliMessageType = "input_audio_buffer.append"
	AliAudioBufferCommitType            AliMessageType = "input_audio_buffer.commit"
	AliTranscriptionCompletedType       AliMessageType = "conversation.item.input_audio_transcription.completed"
	AliConversationItemCreatedType      AliMessageType = "conversation.item.created"
	AliInputAudioBufferCommittedType    AliMessageType = "input_audio_buffer.committed"
	AliSessionCreatedType               AliMessageType = "session.created"
	AliResponseAudioTranscriptDeltaType AliMessageType = "response.audio_transcript.delta"
)

type FrontendMessage struct {
	Type    FrontendMessageType `json:"type"`
	Payload json.RawMessage     `json:"payload"`
}

type ConfigPayload struct {
	Modalities              []string                `json:"modalities,omitempty"`
	InputAudioFormat        string                  `json:"input_audio_format,omitempty"`
	SampleRate              int                     `json:"sample_rate,omitempty"`
	InputAudioTranscription InputAudioTranscription `json:"input_audio_transcription,omitempty"`
	TurnDetection           *TurnDetection          `json:"turn_detection,omitempty"`
	Language                string                  `json:"language,omitempty"`
}

type InputAudioTranscription struct {
	Language string `json:"language,omitempty"`
}

type TurnDetection struct {
	Type                string `json:"type,omitempty"`
	Threshold           float64 `json:"threshold,omitempty"`
	SilenceDurationMs   int    `json:"silence_duration_ms,omitempty"`
}

type AudioChunkPayload struct {
	Audio string `json:"audio"`
}

type AliMessage struct {
	EventID string          `json:"event_id"`
	Type    AliMessageType  `json:"type"`
	Session *SessionConfig  `json:"session,omitempty"`
	Audio   string          `json:"audio,omitempty"`
	Transcript string       `json:"transcript,omitempty"`
}

type SessionConfig struct {
	Modalities              []string                `json:"modalities,omitempty"`
	InputAudioFormat        string                  `json:"input_audio_format,omitempty"`
	SampleRate              int                     `json:"sample_rate,omitempty"`
	InputAudioTranscription *InputAudioTranscription `json:"input_audio_transcription,omitempty"`
	TurnDetection           *TurnDetection          `json:"turn_detection,omitempty"`
}

type FrontendTranscriptEvent struct {
	Type string                  `json:"type"`
	Data FrontendTranscriptData  `json:"data"`
}

type FrontendTranscriptData struct {
	Text   string `json:"text"`
	Status string `json:"status"`
}

func newEventID() string {
	return "event_" + string(rune(time.Now().UnixMilli()))
}
