package websocket

import (
	"time"

	"github.com/example/ws-proxy/internal/logger"
	"github.com/gorilla/websocket"
	"net/http"
)

type Handler struct {
	logger   *logger.Logger
	upgrader *websocket.Upgrader
}

func NewHandler(logger *logger.Logger) *Handler {
	return &Handler{
		logger: logger,
		upgrader: &websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

type Client struct {
	conn   *websocket.Conn
	logger *logger.Logger
	send   chan []byte
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Errorf("failed to upgrade connection: %v", err)
		return
	}

	client := &Client{
		conn:   conn,
		logger: h.logger,
		send:   make(chan []byte, 256),
	}

	h.logger.Infof("client connected from %s", conn.RemoteAddr())

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.conn.Close()
		c.logger.Infof("client %s disconnected", c.conn.RemoteAddr())
	}()

	c.conn.SetReadDeadline(time.Time{})
	c.conn.SetReadLimit(512000)

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.Errorf("websocket error: %v", err)
			}
			break
		}

		c.logger.Debugf("received message from client: %d bytes", len(message))
		c.send <- message
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				c.logger.Errorf("failed to write message: %v", err)
				return
			}
		}
	}
}
