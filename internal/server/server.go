package server

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/example/ws-proxy/internal/config"
	"github.com/example/ws-proxy/internal/logger"
	"github.com/example/ws-proxy/internal/websocket"
)

type Server struct {
	config *config.Config
	logger *logger.Logger
	http   *http.Server
}

func NewServer(cfg *config.Config, logger *logger.Logger) *Server {
	mux := http.NewServeMux()
	wsHandler := websocket.NewHandler(logger)

	mux.HandleFunc("/ws", wsHandler.ServeWS)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	})

	httpServer := &http.Server{
		Addr:           cfg.ListenAddr,
		Handler:        mux,
		ReadTimeout:    15 * time.Second,
		WriteTimeout:   15 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	return &Server{
		config: cfg,
		logger: logger,
		http:   httpServer,
	}
}

func (s *Server) Start() error {
	s.logger.Infof("starting server on %s", s.config.ListenAddr)
	s.logger.Infof("websocket endpoint: ws://%s/ws", s.config.ListenAddr)
	s.logger.Infof("health check endpoint: http://%s/health", s.config.ListenAddr)

	listener, err := net.Listen("tcp", s.config.ListenAddr)
	if err != nil {
		return fmt.Errorf("failed to create listener: %w", err)
	}
	defer listener.Close()

	go func() {
		if err := s.http.Serve(listener); err != nil && err != http.ErrServerClosed {
			s.logger.Errorf("server error: %v", err)
		}
	}()

	return nil
}

func (s *Server) WaitForShutdown() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan
	s.logger.Info("shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.http.Shutdown(ctx); err != nil {
		s.logger.Errorf("error during shutdown: %v", err)
	}

	s.logger.Info("server stopped")
}
