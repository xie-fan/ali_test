package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	APIKey       string
	BaseURL      string
	Model        string
	ListenAddr   string
}

func Load() *Config {
	return &Config{
		APIKey:     getEnv("DASHSCOPE_API_KEY", "sk-default-key"),
		BaseURL:    getEnv("DASHSCOPE_BASE_URL", "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"),
		Model:      getEnv("QWEN_MODEL", "qwen3-asr-flash-realtime"),
		ListenAddr: getEnv("LISTEN_ADDR", "localhost:8080"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func (c *Config) Validate() error {
	if c.APIKey == "" {
		return fmt.Errorf("DASHSCOPE_API_KEY is required")
	}
	if c.BaseURL == "" {
		return fmt.Errorf("DASHSCOPE_BASE_URL is required")
	}
	if c.Model == "" {
		return fmt.Errorf("QWEN_MODEL is required")
	}
	if c.ListenAddr == "" {
		return fmt.Errorf("LISTEN_ADDR is required")
	}
	return nil
}
