package websocket

import (
    "context"
    "time"

    "github.com/example/ws-proxy/internal/logger"
    "github.com/gorilla/websocket"
    "net/http"
)

type Handler struct {
    logger     *logger.Logger
    upgrader   *websocket.Upgrader
    baseURL    string
    apiKey     string
    model      string
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

func NewHandlerWithConfig(logger *logger.Logger, baseURL, apiKey, model string) *Handler {
    return &Handler{
        logger:  logger,
        baseURL: baseURL,
        apiKey:  apiKey,
        model:   model,
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
    conn      *websocket.Conn
    logger    *logger.Logger
    send      chan []byte
    relay     *AliRelay
    ctx       context.Context
    cancel    context.CancelFunc
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
    conn, err := h.upgrader.Upgrade(w, r, nil)
    if err != nil {
        h.logger.Errorf("failed to upgrade connection: %v", err)
        return
    }

    sendChan := make(chan []byte, 256)
    client := &Client{
        conn:   conn,
        logger: h.logger,
        send:   sendChan,
    }

    client.ctx, client.cancel = context.WithCancel(context.Background())
    h.logger.Infof("client connected from %s", conn.RemoteAddr())

    if h.baseURL != "" && h.apiKey != "" && h.model != "" {
        relay := NewAliRelay(sendChan, h.logger, h.baseURL, h.apiKey, h.model)
        if err := relay.Start(client.ctx); err != nil {
            h.logger.Errorf("failed to start Ali relay: %v", err)
            client.cancel()
            conn.Close()
            return
        }
        client.relay = relay
    }

    go client.writePump()
    go client.readPump()
}

func (c *Client) readPump() {
    defer func() {
        c.cancel()
        if c.relay != nil {
            c.relay.Stop()
        }
        close(c.send)
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

        if c.relay != nil {
            if err := c.relay.ProcessClientMessage(message); err != nil {
                c.logger.Errorf("failed to process message through relay: %v", err)
            }
        }
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
