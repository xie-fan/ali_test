package main

import (
	"fmt"
	"os"

	"github.com/example/ws-proxy/internal/config"
	"github.com/example/ws-proxy/internal/logger"
	"github.com/example/ws-proxy/internal/server"
)

func main() {
	log := logger.NewLogger()

	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Errorf("configuration error: %v", err)
		fmt.Fprintf(os.Stderr, "configuration error: %v\n", err)
		os.Exit(1)
	}

	log.Infof("loaded configuration:")
	log.Infof("  APIKey: %s", maskAPIKey(cfg.APIKey))
	log.Infof("  BaseURL: %s", cfg.BaseURL)
	log.Infof("  Model: %s", cfg.Model)
	log.Infof("  ListenAddr: %s", cfg.ListenAddr)

	srv := server.NewServer(cfg, log)
	if err := srv.Start(); err != nil {
		log.Errorf("failed to start server: %v", err)
		fmt.Fprintf(os.Stderr, "failed to start server: %v\n", err)
		os.Exit(1)
	}

	log.Info("server started successfully")
	srv.WaitForShutdown()
}

func maskAPIKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
