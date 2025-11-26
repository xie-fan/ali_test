package websocket

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/example/ws-proxy/internal/logger"
	"github.com/gorilla/websocket"
)

const (
	heartbeatInterval = 30 * time.Second
	reconnectAttempts = 3
	reconnectDelay    = 1 * time.Second
	writeTimeout      = 10 * time.Second
	readTimeout       = 15 * time.Second
)

type AliRelay struct {
	aliConn         *websocket.Conn
	aliConnMux      sync.Mutex
	clientSend      chan []byte
	aliSend         chan *AliMessage
	done            chan struct{}
	logger          *logger.Logger
	baseURL         string
	apiKey          string
	model           string
	sessionConfig   *SessionConfig
	sessionMux      sync.RWMutex
	eventIDCounter  int
	eventIDMux      sync.Mutex
}

func NewAliRelay(clientSend chan []byte, logger *logger.Logger, baseURL, apiKey, model string) *AliRelay {
	return &AliRelay{
		clientSend:     clientSend,
		aliSend:        make(chan *AliMessage, 64),
		done:           make(chan struct{}),
		logger:         logger,
		baseURL:        baseURL,
		apiKey:         apiKey,
		model:          model,
		eventIDCounter: 0,
	}
}

func (r *AliRelay) Start(ctx context.Context) error {
	if err := r.connectToAli(); err != nil {
		return fmt.Errorf("failed to connect to Ali: %w", err)
	}

	go r.aliReadPump()
	go r.aliWritePump()
	go r.heartbeatPump()

	return nil
}

func (r *AliRelay) Stop() {
	close(r.done)
	r.disconnectFromAli()
	close(r.aliSend)
}

func (r *AliRelay) ProcessClientMessage(msg []byte) error {
	var frontendMsg FrontendMessage
	if err := json.Unmarshal(msg, &frontendMsg); err != nil {
		return fmt.Errorf("failed to parse frontend message: %w", err)
	}

	switch frontendMsg.Type {
	case FrontendConfigType:
		return r.handleConfig(frontendMsg.Payload)
	case FrontendAudioChunkType:
		return r.handleAudioChunk(frontendMsg.Payload)
	case FrontendStopType:
		return r.handleStop()
	default:
		return fmt.Errorf("unknown message type: %s", frontendMsg.Type)
	}
}

func (r *AliRelay) handleConfig(payload json.RawMessage) error {
	var config ConfigPayload
	if err := json.Unmarshal(payload, &config); err != nil {
		return fmt.Errorf("failed to parse config payload: %w", err)
	}

	sessionConfig := &SessionConfig{
		Modalities:       config.Modalities,
		InputAudioFormat: config.InputAudioFormat,
		SampleRate:       config.SampleRate,
		TurnDetection:    config.TurnDetection,
	}

	if config.InputAudioTranscription.Language != "" {
		sessionConfig.InputAudioTranscription = &InputAudioTranscription{
			Language: config.InputAudioTranscription.Language,
		}
	}

	r.sessionMux.Lock()
	r.sessionConfig = sessionConfig
	r.sessionMux.Unlock()

	aliMsg := &AliMessage{
		EventID: r.nextEventID(),
		Type:    AliSessionUpdateType,
		Session: sessionConfig,
	}

	select {
	case r.aliSend <- aliMsg:
		r.logger.Debugf("queued session.update to Ali")
	case <-r.done:
		return fmt.Errorf("relay stopped")
	}

	return nil
}

func (r *AliRelay) handleAudioChunk(payload json.RawMessage) error {
	var chunk AudioChunkPayload
	if err := json.Unmarshal(payload, &chunk); err != nil {
		return fmt.Errorf("failed to parse audio chunk payload: %w", err)
	}

	if chunk.Audio == "" {
		return fmt.Errorf("audio chunk is empty")
	}

	if err := validateBase64(chunk.Audio); err != nil {
		return fmt.Errorf("invalid base64 audio: %w", err)
	}

	aliMsg := &AliMessage{
		EventID: r.nextEventID(),
		Type:    AliAudioBufferAppendType,
		Audio:   chunk.Audio,
	}

	select {
	case r.aliSend <- aliMsg:
		r.logger.Debugf("queued audio chunk to Ali (size: %d bytes)", len(chunk.Audio))
	case <-r.done:
		return fmt.Errorf("relay stopped")
	}

	return nil
}

func (r *AliRelay) handleStop() error {
	aliMsg := &AliMessage{
		EventID: r.nextEventID(),
		Type:    AliAudioBufferCommitType,
	}

	select {
	case r.aliSend <- aliMsg:
		r.logger.Debugf("queued input_audio_buffer.commit to Ali")
	case <-r.done:
		return fmt.Errorf("relay stopped")
	}

	return nil
}

func (r *AliRelay) connectToAli() error {
	r.aliConnMux.Lock()
	defer r.aliConnMux.Unlock()

	wsURL := fmt.Sprintf("%s?model=%s", r.baseURL, r.model)

	header := http.Header{}
	header.Set("Authorization", fmt.Sprintf("Bearer %s", r.apiKey))
	header.Set("OpenAI-Beta", "realtime=v1")

	dialer := &websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.Dial(wsURL, header)
	if err != nil {
		return fmt.Errorf("websocket dial failed: %w", err)
	}

	conn.SetReadDeadline(time.Time{})
	conn.SetReadLimit(512000)
	r.aliConn = conn
	r.logger.Infof("connected to Ali ASR service")

	return nil
}

func (r *AliRelay) disconnectFromAli() {
	r.aliConnMux.Lock()
	defer r.aliConnMux.Unlock()

	if r.aliConn != nil {
		r.aliConn.Close()
		r.aliConn = nil
		r.logger.Infof("disconnected from Ali ASR service")
	}
}

func (r *AliRelay) aliReadPump() {
	defer func() {
		r.logger.Debugf("Ali read pump ended")
		r.disconnectFromAli()
	}()

	for {
		select {
		case <-r.done:
			return
		default:
		}

		r.aliConnMux.Lock()
		conn := r.aliConn
		r.aliConnMux.Unlock()

		if conn == nil {
			r.logger.Warnf("Ali connection is nil, attempting to reconnect")
			if err := r.reconnectToAli(); err != nil {
				r.logger.Errorf("failed to reconnect to Ali: %v", err)
				time.Sleep(reconnectDelay)
				continue
			}
			continue
		}

		conn.SetReadDeadline(time.Now().Add(readTimeout))
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				r.logger.Errorf("Ali websocket error: %v", err)
			}
			r.disconnectFromAli()

			if err := r.reconnectToAli(); err != nil {
				r.logger.Errorf("failed to reconnect to Ali: %v", err)
				time.Sleep(reconnectDelay)
			}
			continue
		}

		if err := r.handleAliMessage(message); err != nil {
			r.logger.Errorf("failed to handle Ali message: %v", err)
		}
	}
}

func (r *AliRelay) aliWritePump() {
	defer func() {
		r.logger.Debugf("Ali write pump ended")
	}()

	for {
		select {
		case <-r.done:
			return
		case msg, ok := <-r.aliSend:
			if !ok {
				return
			}

			r.aliConnMux.Lock()
			conn := r.aliConn
			r.aliConnMux.Unlock()

			if conn == nil {
				r.logger.Warnf("dropping message due to missing Ali connection")
				continue
			}

			jsonMsg, err := json.Marshal(msg)
			if err != nil {
				r.logger.Errorf("failed to marshal Ali message: %v", err)
				continue
			}

			conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := conn.WriteMessage(websocket.TextMessage, jsonMsg); err != nil {
				r.logger.Errorf("failed to write message to Ali: %v", err)
				r.disconnectFromAli()
				if err := r.reconnectToAli(); err != nil {
					r.logger.Errorf("failed to reconnect after write error: %v", err)
				}
			}
		}
	}
}

func (r *AliRelay) heartbeatPump() {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-r.done:
			return
		case <-ticker.C:
			r.aliConnMux.Lock()
			conn := r.aliConn
			r.aliConnMux.Unlock()

			if conn != nil {
				conn.SetWriteDeadline(time.Now().Add(writeTimeout))
				if err := conn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
					r.logger.Debugf("heartbeat ping failed: %v", err)
					r.disconnectFromAli()
					if err := r.reconnectToAli(); err != nil {
						r.logger.Errorf("failed to reconnect after heartbeat error: %v", err)
					}
				}
			}
		}
	}
}

func (r *AliRelay) handleAliMessage(message []byte) error {
	var aliMsg map[string]interface{}
	if err := json.Unmarshal(message, &aliMsg); err != nil {
		return fmt.Errorf("failed to parse Ali message: %w", err)
	}

	msgType, ok := aliMsg["type"].(string)
	if !ok {
		return fmt.Errorf("message type not found")
	}

	switch AliMessageType(msgType) {
	case AliTranscriptionCompletedType:
		return r.handleTranscriptionCompleted(aliMsg)
	case AliResponseAudioTranscriptDeltaType:
		return r.handleTranscriptDelta(aliMsg)
	default:
		r.logger.Debugf("ignoring Ali message type: %s", msgType)
	}

	return nil
}

func (r *AliRelay) handleTranscriptionCompleted(aliMsg map[string]interface{}) error {
	transcript, _ := aliMsg["transcript"].(string)

	frontendMsg := FrontendTranscriptEvent{
		Type: "transcript",
		Data: FrontendTranscriptData{
			Text:   transcript,
			Status: "final",
		},
	}

	jsonMsg, err := json.Marshal(frontendMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal frontend message: %w", err)
	}

	select {
	case r.clientSend <- jsonMsg:
		r.logger.Debugf("sent final transcript to client")
	case <-r.done:
		return fmt.Errorf("relay stopped")
	}

	return nil
}

func (r *AliRelay) handleTranscriptDelta(aliMsg map[string]interface{}) error {
	delta, _ := aliMsg["delta"].(string)

	frontendMsg := FrontendTranscriptEvent{
		Type: "transcript",
		Data: FrontendTranscriptData{
			Text:   delta,
			Status: "interim",
		},
	}

	jsonMsg, err := json.Marshal(frontendMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal frontend message: %w", err)
	}

	select {
	case r.clientSend <- jsonMsg:
		r.logger.Debugf("sent interim transcript delta to client")
	case <-r.done:
		return fmt.Errorf("relay stopped")
	}

	return nil
}

func (r *AliRelay) reconnectToAli() error {
	for attempt := 0; attempt < reconnectAttempts; attempt++ {
		if err := r.connectToAli(); err == nil {
			return nil
		}
		time.Sleep(reconnectDelay)
	}
	return fmt.Errorf("failed to reconnect after %d attempts", reconnectAttempts)
}

func (r *AliRelay) nextEventID() string {
	r.eventIDMux.Lock()
	defer r.eventIDMux.Unlock()
	r.eventIDCounter++
	return fmt.Sprintf("event_%d", r.eventIDCounter)
}

func validateBase64(s string) error {
	_, err := base64.StdEncoding.DecodeString(s)
	return err
}
