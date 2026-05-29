package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServerURL      string        // wss://host/ws/agent
	EnrollToken    string        // one-time token (used during first boot)
	AgentToken     string        // long-lived JWT (set after enrollment)
	WorkstationID  string        // UUID (set after enrollment)
	SendInterval   time.Duration // how often to collect + send metrics
	StateFile      string        // path to persist AgentToken + WorkstationID
}

func Load() *Config {
	interval := 10 * time.Second
	if s := os.Getenv("WMS_INTERVAL"); s != "" {
		if d, err := time.ParseDuration(s); err == nil {
			interval = d
		}
	}
	_ = strconv.Itoa // suppress unused import

	return &Config{
		ServerURL:     getEnv("WMS_SERVER_URL", "wss://localhost/ws/agent"),
		EnrollToken:   os.Getenv("WMS_ENROLL_TOKEN"),
		AgentToken:    os.Getenv("WMS_AGENT_TOKEN"),
		WorkstationID: os.Getenv("WMS_WORKSTATION_ID"),
		SendInterval:  interval,
		StateFile:     getEnv("WMS_STATE_FILE", "/etc/wms-agent/state.json"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
